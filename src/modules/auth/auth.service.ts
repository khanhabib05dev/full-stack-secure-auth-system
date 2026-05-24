import { AuthProvider, UserStatus } from "../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { emailQueue } from "../../queue/emailQueue";
import { AppError } from "../../utils/AppError";
import { hashPassword, verifyPassword } from "../../utils/bcrypt";
import {
  generateJti,
  generateRandomToken,
  safeEqual,
  sha256,
} from "../../utils/crypto";
import {
  emailTypes,
  generateOTP,
  getExpiry,
  hashOTP,
  verifyOTP,
} from "../../utils/email.utils";
import { exchangeCodeForProfile } from "../../utils/google";
import {
  createAccessToken,
  createEmailVerifyToken,
  createRefreshToken,
  createTemp2FAToken,
  verifyEmailToken,
  verifyRefreshToken,
  verifyTemp2FAToken,
} from "../../utils/jwt";
import {
  blacklistJti,
  clearCachedUser,
  setCachedUser,
  type CachedUser,
} from "../../utils/redisAuth";
import type {
  IChangePasswordPayload,
  ILoginPayload,
  IRegisterPayload,
  IRequestContext,
  IResetPasswordPayload,
  IUpdateProfilePayload,
  IVerify2FAPayload,
  IVerifyEmailPayload,
} from "./auth.interface";

// ---------------- helpers ----------------
const sanitizeUser = (user: {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  authProvider: string;
  avatarUrl: string | null;
}): CachedUser => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  status: user.status,
  emailVerified: user.emailVerified,
  twoFactorEnabled: user.twoFactorEnabled,
  authProvider: user.authProvider,
  avatarUrl: user.avatarUrl,
});

interface TokenIssuanceResult {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  user: CachedUser;
}

const issueTokensAndSession = async (
  userId: string,
  role: string,
  ctx: IRequestContext
): Promise<TokenIssuanceResult> => {
  // Generate refresh token/session first (need sessionId inside refresh payload)
  const sessionId = generateJti();
  const refreshJti = generateJti();
  const { token: refreshToken, expiresAt } = createRefreshToken({
    userId,
    sessionId,
    jti: refreshJti,
  });

  const session = await prisma.session.create({
    data: {
      id: sessionId,
      userId,
      refreshToken: sha256(refreshToken),
      jti: refreshJti,
      deviceInfo: ctx.deviceInfo as unknown as object,
      ipAddress: ctx.ipAddress ?? null,
      userAgent: ctx.userAgent,
      expiresAt,
      isActive: true,
    },
    include: { user: true },
  });

  const { token: accessToken } = createAccessToken({ userId, role });

  const user = sanitizeUser(session.user);
  await setCachedUser(user);

  // Update lastLoginAt (fire-and-forget)
  prisma.user
    .update({ where: { id: userId }, data: { lastLoginAt: new Date() } })
    .catch(() => void 0);

  return { accessToken, refreshToken, sessionId: session.id, user };
};

// ---------------- REGISTER ----------------
const registerUser = async (payload: IRegisterPayload) => {
  const existing = await prisma.user.findUnique({ where: { email: payload.email } });
  if (existing) {
    if (existing.deletedAt) {
      throw new AppError("This email was used by a deleted account. Contact support.", 400);
    }
    throw new AppError("An account with this email already exists.", 400);
  }

  const passwordHash = await hashPassword(payload.password);

  const user = await prisma.user.create({
    data: {
      email: payload.email,
      name: payload.name,
      password: passwordHash,
      authProvider: AuthProvider.local,
      status: UserStatus.active,
      role: payload.role ?? "customer",
      emailVerified: false,
    },
  });

  // Generate OTP + verification token + DB record
  const otp = generateOTP();
  const otpHash = await hashOTP(otp);
  const verificationToken = createEmailVerifyToken({ userId: user.id, email: user.email });
  const tokenHash = sha256(verificationToken);

  await prisma.emailVerification.create({
    data: {
      userId: user.id,
      otp: otpHash,
      token: tokenHash,
      expiresAt: getExpiry(10),
    },
  });

  await emailQueue.add(emailTypes.verifyEmail, {
    email: user.email,
    name: user.name,
    otp,
    expiryMinutes: 10,
  });

  return {
    user: { id: user.id, email: user.email, name: user.name },
    redirectUrl: `/verify-email?token=${verificationToken}`,
  };
};

// ---------------- VERIFY EMAIL ----------------
const verifyEmail = async (payload: IVerifyEmailPayload) => {
  let decoded;
  try {
    decoded = verifyEmailToken(payload.token);
  } catch {
    throw new AppError("Invalid or expired verification link", 400);
  }

  const tokenHash = sha256(payload.token);
  const record = await prisma.emailVerification.findFirst({
    where: { token: tokenHash, userId: decoded.sub },
    orderBy: { createdAt: "desc" },
  });
  if (!record) throw new AppError("Invalid verification token", 400);
  if (record.used) throw new AppError("Verification token has already been used", 400);
  if (record.expiresAt < new Date()) throw new AppError("Verification token has expired", 400);
  if (record.attempts >= 5) throw new AppError("Too many failed attempts. Please request a new code.", 429);

  const otpMatches = await verifyOTP(payload.otp, record.otp);
  if (!otpMatches) {
    await prisma.emailVerification.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    throw new AppError("Invalid OTP", 400);
  }

  await prisma.$transaction([
    prisma.emailVerification.update({
      where: { id: record.id },
      data: { used: true },
    }),
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerified: true },
    }),
  ]);

  await clearCachedUser(record.userId);
  return { message: "Email verified successfully. You can now log in." };
};

// ---------------- RESEND VERIFICATION ----------------
const resendVerification = async (email: string) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.deletedAt) {
    // Do not reveal whether the email exists
    return { redirectUrl: null };
  }
  if (user.emailVerified) {
    throw new AppError("Email is already verified", 400);
  }

  const otp = generateOTP();
  const otpHash = await hashOTP(otp);
  const verificationToken = createEmailVerifyToken({ userId: user.id, email: user.email });
  const tokenHash = sha256(verificationToken);

  await prisma.emailVerification.create({
    data: {
      userId: user.id,
      otp: otpHash,
      token: tokenHash,
      expiresAt: getExpiry(10),
    },
  });

  await emailQueue.add(emailTypes.verifyEmail, {
    email: user.email,
    name: user.name,
    otp,
    expiryMinutes: 10,
  });

  return { redirectUrl: `/verify-email?token=${verificationToken}` };
};

// ---------------- LOGIN ----------------
const loginUser = async (payload: ILoginPayload, ctx: IRequestContext) => {
  const user = await prisma.user.findUnique({ where: { email: payload.email } });
  if (!user || user.deletedAt) {
    throw new AppError("Invalid email or password", 400);
  }
  if (user.status === UserStatus.banned) {
    throw new AppError("This account is banned", 403);
  }
  if (!user.password) {
    throw new AppError(
      "This account was created with Google. Please sign in with Google or set a password first.",
      400
    );
  }
  const passwordOk = await verifyPassword(payload.password, user.password);
  if (!passwordOk) {
    throw new AppError("Invalid email or password", 400);
  }
  if (!user.emailVerified) {
    throw new AppError("Please verify your email before logging in.", 403);
  }

  if (user.twoFactorEnabled) {
    // Send OTP via email for 2FA step
    const otp = generateOTP();
    const otpHash = await hashOTP(otp);
    // Reuse email_verifications table-like pattern via fresh EmailVerification for 2FA purposes
    await prisma.emailVerification.create({
      data: {
        userId: user.id,
        otp: otpHash,
        token: sha256(`2fa:${user.id}:${Date.now()}`),
        expiresAt: getExpiry(5),
      },
    });
    await emailQueue.add(emailTypes.twoFactor, {
      email: user.email,
      name: user.name,
      otp,
      expiryMinutes: 5,
    });
    const tempToken = createTemp2FAToken(user.id);
    return { require2FA: true as const, tempToken };
  }

  const issued = await issueTokensAndSession(user.id, user.role, ctx);
  return { require2FA: false as const, ...issued };
};

// ---------------- VERIFY 2FA ----------------
const verify2FA = async (payload: IVerify2FAPayload, ctx: IRequestContext) => {
  let decoded;
  try {
    decoded = verifyTemp2FAToken(payload.tempToken);
  } catch {
    throw new AppError("Invalid or expired 2FA session", 401);
  }
  const userId = decoded.sub;

  const record = await prisma.emailVerification.findFirst({
    where: { userId, used: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!record) throw new AppError("2FA code expired, please login again", 401);
  if (record.attempts >= 5) throw new AppError("Too many failed attempts", 429);

  const ok = await verifyOTP(payload.otp, record.otp);
  if (!ok) {
    await prisma.emailVerification.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    throw new AppError("Invalid 2FA code", 400);
  }
  await prisma.emailVerification.update({ where: { id: record.id }, data: { used: true } });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt) throw new AppError("User not found", 404);

  return issueTokensAndSession(user.id, user.role, ctx);
};

// ---------------- REFRESH TOKEN (with rotation + reuse detection) ----------------
const refreshTokens = async (refreshToken: string, ctx: IRequestContext) => {
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError("Invalid refresh token", 401);
  }

  const presentedHash = sha256(refreshToken);
  const session = await prisma.session.findUnique({ where: { id: decoded.sessionId } });

  if (!session) throw new AppError("Session not found", 401);

  // Reuse detection: if session is no longer active but jti matches an old one OR hash mismatch.
  if (!session.isActive) {
    // Treat any request on a revoked session as token theft.
    await prisma.session.updateMany({
      where: { userId: session.userId, isActive: true },
      data: { isActive: false, revokedAt: new Date(), revokeReason: "token_theft" },
    });
    await clearCachedUser(session.userId);
    throw new AppError("Refresh token reuse detected. All sessions invalidated.", 401);
  }

  if (!safeEqual(session.refreshToken, presentedHash)) {
    // Hash mismatch on active session = theft.
    await prisma.session.updateMany({
      where: { userId: session.userId, isActive: true },
      data: { isActive: false, revokedAt: new Date(), revokeReason: "token_theft" },
    });
    await clearCachedUser(session.userId);
    throw new AppError("Refresh token mismatch. All sessions invalidated.", 401);
  }

  if (session.expiresAt < new Date()) {
    await prisma.session.update({
      where: { id: session.id },
      data: { isActive: false, revokedAt: new Date(), revokeReason: "expired" },
    });
    throw new AppError("Refresh token expired", 401);
  }

  const user = await prisma.user.findFirst({ where: { id: session.userId, deletedAt: null } });
  if (!user) throw new AppError("User not found", 401);
  if (user.status === UserStatus.banned) throw new AppError("Account banned", 403);

  // Rotate: revoke this session, create a new one.
  const newSessionId = generateJti();
  const newJti = generateJti();
  const { token: newRefresh, expiresAt } = createRefreshToken({
    userId: user.id,
    sessionId: newSessionId,
    jti: newJti,
  });

  await prisma.$transaction([
    prisma.session.update({
      where: { id: session.id },
      data: { isActive: false, revokedAt: new Date(), revokeReason: "rotated" },
    }),
    prisma.session.create({
      data: {
        id: newSessionId,
        userId: user.id,
        refreshToken: sha256(newRefresh),
        jti: newJti,
        deviceInfo: ctx.deviceInfo as unknown as object,
        ipAddress: ctx.ipAddress ?? null,
        userAgent: ctx.userAgent,
        expiresAt,
        isActive: true,
      },
    }),
  ]);

  const { token: accessToken } = createAccessToken({ userId: user.id, role: user.role });
  return { accessToken, refreshToken: newRefresh, sessionId: newSessionId, userId: user.id };
};

// ---------------- LOGOUT ----------------
const logout = async (
  opts: {
    refreshToken: string | undefined;
    accessJti: string | undefined;
    accessExp: number | undefined;
  }
) => {
  // Revoke session(s) matching this refresh token, if present
  if (opts.refreshToken) {
    const hash = sha256(opts.refreshToken);
    await prisma.session.updateMany({
      where: { refreshToken: hash, isActive: true },
      data: { isActive: false, revokedAt: new Date(), revokeReason: "logout" },
    });
  }
  // Blacklist the current access token jti for its remaining life
  if (opts.accessJti && opts.accessExp) {
    const ttl = opts.accessExp - Math.floor(Date.now() / 1000);
    if (ttl > 0) await blacklistJti(opts.accessJti, ttl);
  }
  return { message: "Logged out successfully" };
};

const logoutAll = async (userId: string, keepSessionId?: string) => {
  await prisma.session.updateMany({
    where: {
      userId,
      isActive: true,
      ...(keepSessionId ? { NOT: { id: keepSessionId } } : {}),
    },
    data: { isActive: false, revokedAt: new Date(), revokeReason: "logout_all" },
  });
  return { message: "Logged out from all devices" };
};

// ---------------- SESSIONS ----------------
const getSessions = async (userId: string, currentSessionId?: string) => {
  const sessions = await prisma.session.findMany({
    where: { userId, isActive: true, expiresAt: { gt: new Date() } },
    orderBy: { lastActiveAt: "desc" },
    select: {
      id: true,
      deviceInfo: true,
      ipAddress: true,
      userAgent: true,
      createdAt: true,
      lastActiveAt: true,
      expiresAt: true,
    },
  });
  return sessions.map((s) => ({ ...s, isCurrent: s.id === currentSessionId }));
};

const revokeSession = async (userId: string, sessionId: string) => {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session || session.userId !== userId) {
    throw new AppError("Session not found", 404);
  }
  await prisma.session.update({
    where: { id: session.id },
    data: { isActive: false, revokedAt: new Date(), revokeReason: "logout" },
  });
  return { message: "Session revoked" };
};

// ---------------- FORGOT / RESET PASSWORD ----------------
const forgotPassword = async (email: string, ctx: { clientUrl: string }) => {
  const user = await prisma.user.findUnique({ where: { email } });
  // Always succeed (don't leak existence)
  if (!user || user.deletedAt || !user.password) return { message: "If that email exists, a reset link has been sent." };

  const rawToken = generateRandomToken(32);
  const tokenHash = sha256(rawToken);

  await prisma.passwordReset.create({
    data: { userId: user.id, token: tokenHash, expiresAt: getExpiry(15) },
  });

  const resetUrl = `${ctx.clientUrl}/reset-password?token=${rawToken}`;
  await emailQueue.add(emailTypes.resetPassword, {
    email: user.email,
    name: user.name,
    resetUrl,
    expiryMinutes: 15,
  });
  return { message: "If that email exists, a reset link has been sent." };
};

const resetPassword = async (payload: IResetPasswordPayload) => {
  const tokenHash = sha256(payload.token);
  const record = await prisma.passwordReset.findFirst({
    where: { token: tokenHash, used: false, expiresAt: { gt: new Date() } },
  });
  if (!record) throw new AppError("Invalid or expired reset token", 400);

  const passwordHash = await hashPassword(payload.newPassword);

  await prisma.$transaction([
    prisma.passwordReset.update({ where: { id: record.id }, data: { used: true } }),
    prisma.passwordReset.updateMany({
      where: { userId: record.userId, used: false },
      data: { used: true },
    }),
    prisma.user.update({
      where: { id: record.userId },
      data: { password: passwordHash, authProvider: AuthProvider.local },
    }),
    prisma.session.updateMany({
      where: { userId: record.userId, isActive: true },
      data: { isActive: false, revokedAt: new Date(), revokeReason: "password_reset" },
    }),
  ]);
  await clearCachedUser(record.userId);
  return { message: "Password reset successfully. Please log in with your new password." };
};

// ---------------- CHANGE PASSWORD ----------------
const changePassword = async (
  userId: string,
  payload: IChangePasswordPayload,
  currentSessionId?: string
) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt) throw new AppError("User not found", 404);
  if (!user.password) throw new AppError("No password is set on this account. Use link-password first.", 400);

  const ok = await verifyPassword(payload.currentPassword, user.password);
  if (!ok) throw new AppError("Current password is incorrect", 400);

  const newHash = await hashPassword(payload.newPassword);

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { password: newHash } }),
    prisma.session.updateMany({
      where: {
        userId,
        isActive: true,
        ...(currentSessionId ? { NOT: { id: currentSessionId } } : {}),
      },
      data: { isActive: false, revokedAt: new Date(), revokeReason: "password_change" },
    }),
  ]);
  await clearCachedUser(userId);
  return { message: "Password changed successfully" };
};

// ---------------- PROFILE ----------------
const getMe = async (userId: string) => {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      emailVerified: true,
      twoFactorEnabled: true,
      authProvider: true,
      avatarUrl: true,
      createdAt: true,
      lastLoginAt: true,
    },
  });
  if (!user) throw new AppError("User not found", 404);
  return user;
};

const updateProfile = async (userId: string, payload: IUpdateProfilePayload) => {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(payload.name !== undefined ? { name: payload.name } : {}),
      ...(payload.avatarUrl !== undefined ? { avatarUrl: payload.avatarUrl } : {}),
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      emailVerified: true,
      twoFactorEnabled: true,
      authProvider: true,
      avatarUrl: true,
    },
  });
  await clearCachedUser(userId);
  return updated;
};

// ---------------- GOOGLE OAUTH ----------------
const googleOAuthCallback = async (code: string, ctx: IRequestContext) => {
  const profile = await exchangeCodeForProfile(code);

  let user = await prisma.user.findFirst({
    where: { OR: [{ googleId: profile.googleId }, { email: profile.email }], deletedAt: null },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: profile.email,
        name: profile.name,
        googleId: profile.googleId,
        authProvider: AuthProvider.google,
        emailVerified: true, // Google verified
        status: UserStatus.active,
        avatarUrl: profile.picture ?? null,
        role: "customer",
      },
    });
  } else {
    // Existing user: link googleId if missing
    if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: profile.googleId,
          emailVerified: true,
          // Keep existing authProvider (may be local) so user keeps password login
        },
      });
    }
  }

  if (user.status === UserStatus.banned) throw new AppError("Account banned", 403);

  return issueTokensAndSession(user.id, user.role, ctx);
};

// ---------------- LINK PASSWORD ----------------
const linkPassword = async (userId: string, newPassword: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt) throw new AppError("User not found", 404);
  if (user.password) throw new AppError("Password already set on this account", 400);

  const hash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { password: hash, authProvider: AuthProvider.local },
  });
  await clearCachedUser(userId);
  return { message: "Password set successfully. You can now log in with email and password." };
};

export const authServices = {
  registerUser,
  verifyEmail,
  resendVerification,
  loginUser,
  verify2FA,
  refreshTokens,
  logout,
  logoutAll,
  getSessions,
  revokeSession,
  forgotPassword,
  resetPassword,
  changePassword,
  getMe,
  updateProfile,
  googleOAuthCallback,
  linkPassword,
};
