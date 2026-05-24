import type { CookieOptions, Response } from "express";
import { envConfig } from "../config/env";
import { CookieUtils } from "./cookie";

const isProd = envConfig.NODE_ENV === "production";

export const ACCESS_COOKIE_NAME = "access_token";
export const REFRESH_COOKIE_NAME = "refresh_token";

const ACCESS_TTL_MS = 5 * 60 * 1000; // 15 minutes
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const baseCookie = (maxAge: number, path: string): CookieOptions => ({
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? "strict" : "lax",
  path,
  maxAge,
  ...(envConfig.COOKIE_DOMAIN ? { domain: envConfig.COOKIE_DOMAIN } : {}),
});

export const setAccessTokenCookie = (res: Response, token: string): void => {
  CookieUtils.setCookie(res, ACCESS_COOKIE_NAME, token, baseCookie(ACCESS_TTL_MS, "/"));
};

export const setRefreshTokenCookie = (res: Response, token: string): void => {
  // Tighter path scope: only sent on refresh & logout endpoints
  CookieUtils.setCookie(
    res,
    REFRESH_COOKIE_NAME,
    token,
    baseCookie(REFRESH_TTL_MS, "/api/auth")
  );
};

export const clearAuthCookies = (res: Response): void => {
  const accessOpts = baseCookie(0, "/");
  const refreshOpts = baseCookie(0, "/api/auth");
  CookieUtils.clearCookie(res, ACCESS_COOKIE_NAME, accessOpts);
  CookieUtils.clearCookie(res, REFRESH_COOKIE_NAME, refreshOpts);
};

export const tokenUtils = {
  setAccessTokenCookie,
  setRefreshTokenCookie,
  clearAuthCookies,
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
};
