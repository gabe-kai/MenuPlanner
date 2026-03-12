import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

import { useRealAuth } from "@/lib/auth/authGateway";
import { parseSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth/sessionCookie";
import { getActorFromStoreState } from "@/lib/auth/actors";
import { useAuthAndFamilyStore } from "@/stores/authAndFamilyStore";
import { log } from "@/lib/log";

function isSchoolLunchRoute(pathname: string) {
  return pathname === "/school-lunch" || pathname.startsWith("/school-lunch/");
}

function isAdultRoute(pathname: string) {
  return pathname.startsWith("/school-lunch/adult");
}

function isAccountRoute(pathname: string) {
  return pathname === "/account";
}

async function getActorFromSession(request: NextRequest, sessionCookie: string | undefined) {
  const state = useAuthAndFamilyStore.getState();
  if (useRealAuth) {
    const token = await getToken({ req: request });
    const tokenUserId = typeof token?.userId === "string" ? token.userId : null;
    const tokenFamilyId = typeof token?.familyId === "string" ? token.familyId : null;
    const tokenRole =
      token?.role === "adult" || token?.role === "child" ? token.role : null;

    if (!tokenUserId || !tokenFamilyId) {
      if (token) {
        log.warn({
          module: "auth",
          message: "auth.tokenInvalid",
          data: { reason: "next_auth_token_missing_claims" },
        });
      }
      return null;
    }

    if (tokenRole) {
      const tokenName =
        typeof token?.name === "string" && token.name.trim().length > 0
          ? token.name
          : tokenUserId;
      return {
        user: {
          id: tokenUserId,
          name: tokenName,
          role: tokenRole,
        },
        family: {
          id: tokenFamilyId,
          name: "Household",
          memberIds: [tokenUserId],
        },
        userId: tokenUserId,
        familyId: tokenFamilyId,
        isAdult: tokenRole === "adult",
        editPolicy: "free",
      };
    }

    const actor = getActorFromStoreState(
      tokenUserId,
      tokenFamilyId,
      state.users,
      state.families,
      state.memberships,
    );
    if (!actor) {
      if (token) {
        log.warn({
          module: "auth",
          message: "auth.tokenInvalid",
          data: { reason: "next_auth_token_invalid" },
        });
      }
      return null;
    }
    return actor;
  }

  const actor = parseSessionCookie(sessionCookie);
  if (!actor) {
    if (sessionCookie) {
      log.warn({
        module: "auth",
        message: "auth.tokenInvalid",
        data: { reason: "invalid_or_expired_session_cookie" },
      });
    }
    return null;
  }
  return getActorFromStoreState(
    actor.userId,
    actor.familyId,
    state.users,
    state.families,
    state.memberships,
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!isSchoolLunchRoute(pathname) && !isAccountRoute(pathname)) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const actor = await getActorFromSession(request, sessionCookie);

  if (!actor) {
    const login = new URL("/login", request.url);
    login.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(login);
  }

  if (isAdultRoute(pathname) && !actor.isAdult) {
    return NextResponse.redirect(new URL("/school-lunch/child", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/school-lunch/:path*", "/account"],
};
