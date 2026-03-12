import type { AuthSessionRecord } from "@/lib/auth/authGateway";

export const SESSION_COOKIE_NAME = "menuplanner.auth.session.v1";
export const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
export const SESSION_COOKIE_MAX_AGE_MILLISECONDS = SESSION_COOKIE_MAX_AGE_SECONDS * 1000;

export function encodeSessionCookie(session: AuthSessionRecord): string {
  const now = Date.now();
  const normalized = {
    ...session,
    issuedAt: session.issuedAt ?? now,
    expiresAt: session.expiresAt ?? now + SESSION_COOKIE_MAX_AGE_MILLISECONDS,
  };
  return encodeURIComponent(JSON.stringify(normalized));
}

function buildCookieFlags() {
  const secureFlag = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `Path=/; Max-Age=${SESSION_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secureFlag}`;
}

export function parseSessionCookie(raw: string | null | undefined): AuthSessionRecord | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as AuthSessionRecord;
    if (typeof parsed.userId !== "string" || typeof parsed.familyId !== "string") {
      return null;
    }
    if (parsed.expiresAt !== undefined) {
      if (typeof parsed.expiresAt !== "number" || parsed.expiresAt <= Date.now()) {
        return null;
      }
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeSessionCookie(session: AuthSessionRecord) {
  if (typeof document === "undefined") return;
  const cookieValue = encodeSessionCookie(session);
  document.cookie = `${SESSION_COOKIE_NAME}=${cookieValue}; ${buildCookieFlags()}`;
}

export function clearSessionCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${SESSION_COOKIE_NAME}=; ${buildCookieFlags().replace(/Max-Age=\d+/, "Max-Age=0")}`;
}
