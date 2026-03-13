import {
  activeAuthGateway,
  type AuthSessionRecord,
  type SignInInput,
  useRealAuth,
} from "@/lib/auth/authGateway";
import { getActorByUserId } from "@/lib/auth/actors";
import { useAuthAndFamilyStore } from "@/stores/authAndFamilyStore";
import { log } from "@/lib/log";
import {
  clearSessionCookie,
  SESSION_COOKIE_MAX_AGE_MILLISECONDS,
  writeSessionCookie,
} from "@/lib/auth/sessionCookie";
import { DEMO_AUTH_PASSWORD } from "@/lib/auth/demoIdentity";

export interface ActiveSessionState {
  userId: string | null;
  familyId: string | null;
  systemRole: "admin" | "user" | null;
  isAuthenticated: boolean;
}

export function getActiveSession(): ActiveSessionState {
  const state = useAuthAndFamilyStore.getState();
  return {
    userId: state.currentUserId,
    familyId: state.currentFamilyId,
    systemRole: state.currentSystemRole,
    isAuthenticated: state.isAuthenticated,
  };
}

export async function hydrateSessionFromStorage() {
  const state = useAuthAndFamilyStore.getState();
  const persisted = await activeAuthGateway.restoreSession();

  if (persisted) {
    const applied = applySession(persisted);
    if (applied) {
      log.info({
        module: "auth",
        message: "session restored",
        data: {
          userId: persisted.userId,
          familyId: persisted.familyId,
          source: "storage",
        },
      });
      if (!useRealAuth) {
        writeSessionCookie(persisted);
      }
      state.setCurrentSystemRole(useRealAuth ? persisted.systemRole ?? null : null);
      return;
    }
    log.warn({
      module: "auth",
      message: "auth.tokenInvalid",
      data: {
        userId: persisted.userId,
        familyId: persisted.familyId,
        reason: "apply_session_failed",
      },
    });
    await activeAuthGateway.signOut();
    state.setCurrentUser(null);
    state.setCurrentFamilyId(null);
    state.setIsAuthenticated(false);
    state.setCurrentSystemRole(null);
    if (!useRealAuth) {
      clearSessionCookie();
    }
    return;
  }
  if (state.currentUserId !== null || state.currentFamilyId !== null || state.isAuthenticated) {
    if (useRealAuth) {
      await activeAuthGateway.signOut();
    }
    if (state.currentUserId) {
      log.warn({
        module: "auth",
        message: "auth.tokenInvalid",
        data: {
          userId: state.currentUserId,
          familyId: state.currentFamilyId ?? null,
          reason: "no_persisted_session",
        },
      });
    }
    state.setCurrentUser(null);
    state.setCurrentFamilyId(null);
    state.setIsAuthenticated(false);
    state.setCurrentSystemRole(null);
  }
  if (!useRealAuth) {
    clearSessionCookie();
  }
}

export async function signInUser(userId: string, password?: string) {
  const state = useAuthAndFamilyStore.getState();
  const normalizedUserId = userId.trim().toLowerCase();
  const actor = getActorByUserId(normalizedUserId);
  const familyId = actor?.familyId ?? state.currentFamilyId ?? (useRealAuth ? "fam-1" : null);
  if (!useRealAuth && !familyId) {
    log.warn({
      module: "auth",
      message: "sign in blocked: no family",
      data: { userId: normalizedUserId },
    });
    return null;
  }
  const input: SignInInput = {
    userId: normalizedUserId,
    familyId: familyId || "",
  };
  if (useRealAuth) {
    const { signIn: nextAuthSignIn } = await import("next-auth/react");
    const result = await nextAuthSignIn("credentials", {
      username: normalizedUserId,
      password: password ?? DEMO_AUTH_PASSWORD,
      redirect: false,
      callbackUrl: "/",
    });
    log.info({
      module: "auth",
      message: "auth.nextAuthSignInResult",
      data: {
        userId: normalizedUserId,
        ok: result?.ok,
        error: result?.error,
        status: result?.status,
        hasUrl: Boolean(result?.url),
      },
    });
    if (result?.error) {
      log.warn({
        module: "auth",
        message: "auth.signInFailure",
        data: { userId: normalizedUserId, familyId, reason: result.error },
      });
      throw new Error("Unable to complete sign in");
    }
    let current = await activeAuthGateway.restoreSession();
    if (!current) {
      await new Promise((resolve) => setTimeout(resolve, 75));
      current = await activeAuthGateway.restoreSession();
    }
    if (!current) {
      current = {
        userId: normalizedUserId,
        familyId: familyId || "",
        issuedAt: Date.now(),
        expiresAt: Date.now() + SESSION_COOKIE_MAX_AGE_MILLISECONDS,
      };
    }

    const applied = applySession(current);
    if (!applied) {
      log.warn({
        module: "auth",
        message: "auth.tokenInvalid",
        data: { userId: normalizedUserId, familyId, reason: "actor_mismatch" },
      });
      await activeAuthGateway.signOut();
      return null;
    }

    log.info({
      module: "auth",
      message: "session signed in",
      data: { userId: input.userId, familyId: input.familyId },
    });
    return current;
  }
  let session: AuthSessionRecord;
  try {
    session = await activeAuthGateway.signIn(input);
  } catch (error) {
    log.warn({
      module: "auth",
      message: "auth.signInFailure",
      data: {
        userId: normalizedUserId,
        familyId,
        reason: error instanceof Error ? error.message : "unknown_error",
      },
    });
    throw error;
  }

  const applied = applySession(session);
  if (!applied) {
    log.warn({
      module: "auth",
      message: "auth.tokenInvalid",
      data: { userId: normalizedUserId, familyId, reason: "actor_mismatch" },
    });
    await activeAuthGateway.signOut();
    return null;
  }

  if (!useRealAuth) {
    writeSessionCookie(session);
  }
  log.info({
    module: "auth",
    message: "session signed in",
    data: { userId: input.userId, familyId: input.familyId },
  });
  return session;
}

export async function signOutUser() {
  const state = useAuthAndFamilyStore.getState();
  const previousUserId = state.currentUserId;
  await activeAuthGateway.signOut();
  state.setCurrentUser(null);
  state.setCurrentFamilyId(null);
  state.setIsAuthenticated(false);
  state.setCurrentSystemRole(null);
  if (!useRealAuth) {
    clearSessionCookie();
  }
  log.info({
    module: "auth",
    message: "session signed out",
    data: { userId: previousUserId },
  });
}

function applySession(session: AuthSessionRecord) {
  const state = useAuthAndFamilyStore.getState();
  let actor = getActorByUserId(session.userId);
  if (!actor && useRealAuth) {
    state.upsertUserContext({
      userId: session.userId,
      familyId: session.familyId,
      ...(session.name ? { name: session.name } : {}),
      ...(session.role ? { role: session.role } : {}),
    });
    actor = getActorByUserId(session.userId);
    if (actor && actor.user.role === "child" && session.editPolicy) {
      state.setMembershipEditPolicy(session.userId, session.familyId, session.editPolicy);
    }
  }
  if (!actor && session.editPolicy && useRealAuth) {
    state.setMembershipEditPolicy(session.userId, session.familyId, session.editPolicy);
    actor = getActorByUserId(session.userId);
  }
  if (!actor) return false;
  if (actor.family.id !== session.familyId) {
    if (!useRealAuth) return false;
    state.upsertUserContext({
      userId: session.userId,
      familyId: session.familyId,
      ...(session.name ? { name: session.name } : {}),
      ...(session.role ? { role: session.role } : {}),
    });
    if (actor.user.role === "child" && session.editPolicy) {
      state.setMembershipEditPolicy(session.userId, session.familyId, session.editPolicy);
    }
    actor = getActorByUserId(session.userId);
    if (!actor || actor.family.id !== session.familyId) {
      return false;
    }
  }
  state.setCurrentUser(session.userId);
  state.setCurrentFamilyId(session.familyId);
  state.setIsAuthenticated(true);
  state.setCurrentSystemRole(useRealAuth ? session.systemRole ?? null : null);
  return true;
}
