import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import type { AuthSessionRecord, SignInInput } from "@/lib/auth/authGateway";
import { getActorByUserId } from "@/lib/auth/actors";
import { getDemoIdentityByUserId } from "@/lib/auth/demoIdentity";
import {
  SESSION_COOKIE_MAX_AGE_MILLISECONDS,
  SESSION_COOKIE_MAX_AGE_SECONDS,
  SESSION_COOKIE_NAME,
  encodeSessionCookie,
} from "@/lib/auth/sessionCookie";

function attachSessionCookie(response: NextResponse, session: AuthSessionRecord) {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: encodeSessionCookie(session),
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  });
}

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as SignInInput | null;
  if (!payload || typeof payload.userId !== "string" || typeof payload.familyId !== "string") {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const actor = getActorByUserId(payload.userId);
  if (!actor || actor.family.id !== payload.familyId) {
    return NextResponse.json({ error: "actor not found" }, { status: 400 });
  }

  const identity = getDemoIdentityByUserId(payload.userId);
  if (identity && payload.familyId !== identity.familyId) {
    return NextResponse.json({ error: "actor not found" }, { status: 400 });
  }

  const now = Date.now();
  const session: AuthSessionRecord = {
    userId: actor.userId,
    familyId: actor.family.id,
    issuedAt: now,
    expiresAt: now + SESSION_COOKIE_MAX_AGE_MILLISECONDS,
  };

  const response = NextResponse.json({ session });
  attachSessionCookie(response, session);
  return response;
}

export function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/login", request.url));
}
