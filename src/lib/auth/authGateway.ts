import { log } from "@/lib/log";

export interface AuthSessionRecord {
  userId: string;
  familyId: string;
  name?: string;
  role?: "adult" | "child";
  editPolicy?: "free" | "approval_required" | "no_edit";
  issuedAt?: number;
  expiresAt?: number;
}

export interface SignInInput {
  userId: string;
  familyId: string;
}

export interface AuthGateway {
  restoreSession(): Promise<AuthSessionRecord | null>;
  signIn(input: SignInInput): Promise<AuthSessionRecord>;
  signOut(): Promise<void>;
}

export const SESSION_STORAGE_KEY = "menuplanner.auth.session.v1";

function readFromStorage(): AuthSessionRecord | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AuthSessionRecord;
    if (typeof parsed.userId !== "string" || typeof parsed.familyId !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeToStorage(session: AuthSessionRecord | null) {
  if (typeof window === "undefined") return;
  if (session === null) {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export const useRealAuth = process.env.NEXT_PUBLIC_USE_REAL_AUTH === "true";
const AUTH_API_BASE = "/api/auth";
const SESSION_REFRESH_WINDOW_MS = 5 * 60 * 1000;

type AuthApiPayload = { session?: AuthSessionRecord | null };

async function requestAuthApi(
  path: string,
  options: RequestInit = {},
): Promise<{ ok: boolean; payload: AuthApiPayload }> {
  try {
    const response = await fetch(`${AUTH_API_BASE}/${path}`, {
      credentials: "include",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      return { ok: false, payload: {} };
    }

    try {
      const payload = (await response.json()) as AuthApiPayload;
      return { ok: true, payload };
    } catch {
      return { ok: false, payload: {} };
    }
  } catch {
    return { ok: false, payload: {} };
  }
}

function isSessionNearExpiry(session: AuthSessionRecord) {
  if (typeof session.expiresAt !== "number" || !Number.isFinite(session.expiresAt)) {
    return false;
  }
  return session.expiresAt - Date.now() < SESSION_REFRESH_WINDOW_MS;
}

async function refreshSessionIfNeeded(session: AuthSessionRecord): Promise<AuthSessionRecord | null> {
  if (!isSessionNearExpiry(session)) return session;

  const result = await requestAuthApi("refresh", {
    method: "POST",
    body: JSON.stringify({
      userId: session.userId,
      familyId: session.familyId,
    }),
  });
  if (!result.ok || !result.payload.session) {
    log.warn({
      module: "auth",
      message: "auth.tokenInvalid",
      data: {
        userId: session.userId,
        familyId: session.familyId,
        reason: "refresh_failed",
      },
    });
    return null;
  }

  log.info({
    module: "auth",
    message: "auth.refresh",
    data: {
      userId: result.payload.session.userId,
      familyId: result.payload.session.familyId,
    },
  });

  return result.payload.session;
}

export const mockAuthGateway: AuthGateway = {
  async restoreSession() {
    return readFromStorage();
  },
  async signIn(input: SignInInput) {
    writeToStorage(input);
    return input;
  },
  async signOut() {
    writeToStorage(null);
  },
};

export const realAuthGateway: AuthGateway = {
  async restoreSession() {
    if (typeof window === "undefined") return null;
    const result = await requestAuthApi("session");
    if (!result.ok) return null;
    if (!result.payload.session) {
      log.warn({
        module: "auth",
        message: "auth.tokenInvalid",
        data: { reason: "missing_session" },
      });
      return null;
    }

    const refreshed = await refreshSessionIfNeeded(result.payload.session);
    return refreshed ?? null;
  },
  async signIn(input: SignInInput) {
    if (typeof window === "undefined") return input;
    const result = await requestAuthApi("signin", {
      method: "POST",
      body: JSON.stringify(input),
    });
    if (!result.ok || !result.payload.session) {
      log.warn({
        module: "auth",
        message: "auth.signInFailure",
        data: { userId: input.userId, familyId: input.familyId, reason: "api_signin_failed" },
      });
      throw new Error("Unable to complete sign in");
    }
    return result.payload.session;
  },
  async signOut() {
    if (typeof window === "undefined") return;
    await requestAuthApi("signout", {
      method: "POST",
    });
  },
};

export const activeAuthGateway: AuthGateway = useRealAuth ? realAuthGateway : mockAuthGateway;
