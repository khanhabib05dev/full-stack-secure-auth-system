import type { Request, Response } from "express";
import { envConfig } from "../../config/env";
import { getGoogleAuthUrl } from "../../utils/google";
import { sendSuccess } from "../../utils/apiResponse";
import { asyncHandler } from "../../utils/asyncHandler";
import { CookieUtils } from "../../utils/cookie";
import { getRequestContext } from "../../utils/deviceInfo";
import {
  clearAuthCookies,
  REFRESH_COOKIE_NAME,
  setAccessTokenCookie,
  setRefreshTokenCookie,
} from "../../utils/token";
import { AppError } from "../../utils/AppError";
import { authServices } from "./auth.service";
import { verifyRefreshToken } from "../../utils/jwt";

// ---------------- REGISTER ----------------
const register = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password, role, agreeTerms } = req.body;
  const result = await authServices.registerUser({ name, email, password, role, agreeTerms });
  sendSuccess(res, {
    statusCode: 201,
    message: "Registration successful. Please verify your email.",
    data: result,
  });
});

// ---------------- VERIFY EMAIL ----------------
const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const { token, otp } = req.body;
  const result = await authServices.verifyEmail({ token, otp });
  sendSuccess(res, { data: result });
});

const resendVerification = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;
  const result = await authServices.resendVerification(email);
  sendSuccess(res, { message: "If the email exists, a new code has been sent.", data: result });
});

// ---------------- LOGIN ----------------
const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const ctx = getRequestContext(req);
  const result = await authServices.loginUser({ email, password }, ctx);

  if (result.require2FA) {
    sendSuccess(res, {
      message: "2FA required",
      data: { require2FA: true, tempToken: result.tempToken },
    });
    return;
  }

  setAccessTokenCookie(res, result.accessToken);
  setRefreshTokenCookie(res, result.refreshToken);
  sendSuccess(res, {
    message: "Logged in successfully",
    data: { user: result.user, requires2FA: false },
  });
});

// ---------------- VERIFY 2FA ----------------
const verify2FA = asyncHandler(async (req: Request, res: Response) => {
  const { tempToken, otp } = req.body;
  const ctx = getRequestContext(req);
  const result = await authServices.verify2FA({ tempToken, otp }, ctx);
  setAccessTokenCookie(res, result.accessToken);
  setRefreshTokenCookie(res, result.refreshToken);
  sendSuccess(res, { message: "2FA verified", data: { user: result.user } });
});

// ---------------- REFRESH ----------------
const refresh = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = CookieUtils.getCookie(req, REFRESH_COOKIE_NAME);
  if (!refreshToken) throw new AppError("Refresh token missing", 401);
  const ctx = getRequestContext(req);
  const result = await authServices.refreshTokens(refreshToken, ctx);
  setAccessTokenCookie(res, result.accessToken);
  setRefreshTokenCookie(res, result.refreshToken);
  sendSuccess(res, { message: "Tokens refreshed" });
});

// ---------------- LOGOUT ----------------
const logout = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = CookieUtils.getCookie(req, REFRESH_COOKIE_NAME);
  await authServices.logout({
    refreshToken,
    accessJti: req.auth?.jti,
    accessExp: req.auth?.accessTokenExp,
  });
  clearAuthCookies(res);
  sendSuccess(res, { message: "Logged out successfully" });
});

const logoutAll = asyncHandler(async (req: Request, res: Response) => {
  if (!req.auth) throw new AppError("Unauthorized", 401);
  // Find current session id from refresh token (if present)
  let currentSessionId: string | undefined;
  const refreshToken = CookieUtils.getCookie(req, REFRESH_COOKIE_NAME);
  if (refreshToken) {
    try {
      currentSessionId = verifyRefreshToken(refreshToken).sessionId;
    } catch {
      currentSessionId = undefined;
    }
  }
  await authServices.logoutAll(req.auth.userId, currentSessionId);
  sendSuccess(res, { message: "Logged out from all other devices" });
});

// ---------------- SESSIONS ----------------
const listSessions = asyncHandler(async (req: Request, res: Response) => {
  if (!req.auth) throw new AppError("Unauthorized", 401);
  let currentSessionId: string | undefined;
  const refreshToken = CookieUtils.getCookie(req, REFRESH_COOKIE_NAME);
  if (refreshToken) {
    try {
      currentSessionId = verifyRefreshToken(refreshToken).sessionId;
    } catch {
      currentSessionId = undefined;
    }
  }
  const sessions = await authServices.getSessions(req.auth.userId, currentSessionId);
  sendSuccess(res, { data: sessions });
});

const revokeSession = asyncHandler(async (req: Request, res: Response) => {
  if (!req.auth) throw new AppError("Unauthorized", 401);
  const sessionId = String(req.params.sessionId ?? "");
  const result = await authServices.revokeSession(req.auth.userId, sessionId);
  sendSuccess(res, { data: result });
});

// ---------------- FORGOT / RESET / CHANGE ----------------
const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;
  const result = await authServices.forgotPassword(email, { clientUrl: envConfig.CLIENT_URL });
  sendSuccess(res, { data: result });
});

const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;
  const result = await authServices.resetPassword({ token, newPassword });
  sendSuccess(res, { data: result });
});

const changePassword = asyncHandler(async (req: Request, res: Response) => {
  if (!req.auth) throw new AppError("Unauthorized", 401);
  const { currentPassword, newPassword } = req.body;
  let currentSessionId: string | undefined;
  const refreshToken = CookieUtils.getCookie(req, REFRESH_COOKIE_NAME);
  if (refreshToken) {
    try {
      currentSessionId = verifyRefreshToken(refreshToken).sessionId;
    } catch {
      currentSessionId = undefined;
    }
  }
  const result = await authServices.changePassword(
    req.auth.userId,
    { currentPassword, newPassword },
    currentSessionId
  );
  sendSuccess(res, { data: result });
});

// ---------------- PROFILE ----------------
const getMe = asyncHandler(async (req: Request, res: Response) => {
  if (!req.auth) throw new AppError("Unauthorized", 401);
  const user = await authServices.getMe(req.auth.userId);
  sendSuccess(res, { data: user });
});

const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  if (!req.auth) throw new AppError("Unauthorized", 401);
  const { name, avatarUrl } = req.body;
  const updated = await authServices.updateProfile(req.auth.userId, { name, avatarUrl });
  sendSuccess(res, { data: updated });
});

// ---------------- GOOGLE OAUTH ----------------
const googleRedirect = asyncHandler(async (_req: Request, res: Response) => {
  const url = getGoogleAuthUrl();
  console.log("main url",url);
  
  res.redirect(url);
});

const googleCallback = asyncHandler(async (req: Request, res: Response) => {
  const code = req.query.code as string | undefined;
  if (!code) {
    res.redirect(`${envConfig.CLIENT_URL}/login?error=oauth_missing_code`);
    return;
  }
  try {
    const ctx = getRequestContext(req);
    const result = await authServices.googleOAuthCallback(code, ctx);
    setAccessTokenCookie(res, result.accessToken);
    setRefreshTokenCookie(res, result.refreshToken);
    res.redirect(`${envConfig.CLIENT_URL}/dashboard`);
  } catch (err) {
    const msg = err instanceof Error ? encodeURIComponent(err.message) : "oauth_failed";
    res.redirect(`${envConfig.CLIENT_URL}/login?error=${msg}`);
  }
});

const linkPassword = asyncHandler(async (req: Request, res: Response) => {
  if (!req.auth) throw new AppError("Unauthorized", 401);
  const { newPassword } = req.body;
  const result = await authServices.linkPassword(req.auth.userId, newPassword);
  sendSuccess(res, { data: result });
});

export const authControllers = {
  register,
  verifyEmail,
  resendVerification,
  login,
  verify2FA,
  refresh,
  logout,
  logoutAll,
  listSessions,
  revokeSession,
  forgotPassword,
  resetPassword,
  changePassword,
  getMe,
  updateProfile,
  googleRedirect,
  googleCallback,
  linkPassword,
};
