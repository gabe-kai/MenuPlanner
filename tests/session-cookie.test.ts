import {
  clearSessionCookie,
  encodeSessionCookie,
  parseSessionCookie,
  SESSION_COOKIE_NAME,
  writeSessionCookie,
} from "@/lib/auth/sessionCookie";

describe("session cookie helpers", () => {
  const session = { userId: "mom", familyId: "fam-1" };

  it("serializes and parses a valid session", () => {
    const encoded = encodeSessionCookie(session);
    const parsed = parseSessionCookie(encoded);
    expect(parsed).toMatchObject(session);
  });

  it("returns null for bad payloads", () => {
    expect(parseSessionCookie("this is not json")).toBeNull();
    expect(parseSessionCookie(undefined)).toBeNull();
  });

  it("returns null for expired sessions", () => {
    const expiredSession = {
      userId: "mom",
      familyId: "fam-1",
      expiresAt: Date.now() - 1000,
    };
    const encoded = encodeSessionCookie(expiredSession);
    expect(parseSessionCookie(encoded)).toBeNull();
  });

  it("writes and clears session cookies in the browser", () => {
    writeSessionCookie(session);
    expect(document.cookie.includes(`${SESSION_COOKIE_NAME}=`)).toBe(true);

    clearSessionCookie();
    expect(parseSessionCookie(document.cookie)).toBeNull();
  });
});
