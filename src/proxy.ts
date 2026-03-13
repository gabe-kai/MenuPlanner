import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

import { useRealAuth } from "@/lib/auth/authGateway";
import { parseSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth/sessionCookie";
import { getActorFromStoreState } from "@/lib/auth/actors";
import { isSystemAdminUser } from "@/lib/auth/adminAuth";
import { useAuthAndFamilyStore } from "@/stores/authAndFamilyStore";

function isSchoolLunchRoute(pathname: string) {
  return pathname === "/school-lunch" || pathname.startsWith("/school-lunch/");
}

function isAdultRoute(pathname: string) {
  return pathname.startsWith("/school-lunch/adult");
}

function isAccountRoute(pathname: string) {
  return pathname === "/account";
}

function isPlannerRoute(pathname: string) {
  return pathname === "/planner";
}

function isRecipesRoute(pathname: string) {
  return pathname === "/recipes" || pathname.startsWith("/recipes/");
}

function isAdminRoute(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

async function getActorFromSession(request: NextRequest, sessionCookie: string | undefined) {
  const state = useAuthAndFamilyStore.getState();
  if (useRealAuth) {
    const token = await getToken({ req: request });
    const tokenUserId = typeof token?.userId === "string" ? token.userId : null;
    const tokenFamilyId = typeof token?.familyId === "string" ? token.familyId : null;
    const tokenRole =
      token?.role === "adult" || token?.role === "child" ? token.role : null;
    const mustChangePassword =
      token?.mustChangePassword === true || token?.mustChangePassword === false ? token.mustChangePassword : false;

    if (!tokenUserId || !tokenFamilyId) {
      if (token) {
        // eslint-disable-next-line no-console
        console.warn("auth.tokenInvalid: next_auth_token_missing_claims");
      }
      return null;
    }

    if (tokenRole) {
      const isAdmin = isSystemAdminUser(tokenUserId);
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
        isAdmin,
        editPolicy: "free",
        mustChangePassword,
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
        // eslint-disable-next-line no-console
        console.warn("auth.tokenInvalid: next_auth_token_invalid");
      }
      return null;
    }
    return {
      ...actor,
      mustChangePassword,
    };
  }

  const actor = parseSessionCookie(sessionCookie);
  if (!actor) {
    if (sessionCookie) {
      // eslint-disable-next-line no-console
      console.warn("auth.tokenInvalid: invalid_or_expired_session_cookie");
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
  if (
    !isSchoolLunchRoute(pathname) &&
    !isAccountRoute(pathname) &&
    !isAdminRoute(pathname) &&
    !isPlannerRoute(pathname) &&
    !isRecipesRoute(pathname)
  ) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const actor = await getActorFromSession(request, sessionCookie);

  if (!actor) {
    // eslint-disable-next-line no-console
    console.warn("auth.sessionMissing", pathname);
    const login = new URL("/login", request.url);
    login.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(login);
  }

  if (isAdminRoute(pathname) && !actor.isAdmin) {
    // eslint-disable-next-line no-console
    console.warn("auth.nonAdminRedirect", pathname, actor.userId);
    return NextResponse.redirect(new URL("/planner", request.url));
  }
  if (!isAccountRoute(pathname) && actor.mustChangePassword) {
    // eslint-disable-next-line no-console
    console.info("auth.mustChangePasswordRedirect", pathname, actor.userId);
    return NextResponse.redirect(new URL("/account", request.url));
  }

  if (isAdultRoute(pathname) && !actor.isAdult) {
    return NextResponse.redirect(new URL("/school-lunch/child", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/school-lunch/:path*",
    "/account",
    "/admin/:path*",
    "/planner",
    "/recipes",
    "/recipes/:path*",
  ],
};
