import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { log } from "@/lib/log";
import { getActorFromStoreState } from "@/lib/auth/actors";
import { authOptions } from "@/lib/auth/nextAuth";
import { parseSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth/sessionCookie";
import { useAuthAndFamilyStore } from "@/stores/authAndFamilyStore";
import { useRealAuth } from "@/lib/auth/authGateway";
import { isSystemAdminUser } from "@/lib/auth/adminAuth";
import {
  setAuthIdentityTemporaryPassword,
  setPasswordChangeRequired,
} from "@/lib/auth/authIdentity.server";

type PasswordResetPayload = {
  temporaryPassword?: unknown;
};

type RequestActor = {
  userId: string;
  familyId: string;
  isAdmin: boolean;
};

async function getRequestActor(request: NextRequest): Promise<RequestActor | null> {
  const state = useAuthAndFamilyStore.getState();
  if (useRealAuth) {
    const session = await getServerSession(authOptions);
    const userId = session?.user && (session.user as { id?: string }).id;
    const familyId = session?.user && (session.user as { familyId?: string }).familyId;
    const systemRole = session?.user && (session.user as { systemRole?: string }).systemRole;
    const isAdmin = systemRole === "admin" || isSystemAdminUser(userId);
    if (!userId || !familyId || !isAdmin) {
      return null;
    }
    return { userId, familyId, isAdmin: true };
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const sessionActor = parseSessionCookie(sessionCookie);
  if (!sessionActor) return null;

  const actor = getActorFromStoreState(
    sessionActor.userId,
    sessionActor.familyId,
    state.users,
    state.families,
    state.memberships,
  );
  if (!actor || !actor.isAdmin) return null;
  return { userId: actor.user.id, familyId: actor.family.id, isAdmin: actor.isAdmin };
}

function parseResetPayload(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const record = payload as PasswordResetPayload;
  if (typeof record.temporaryPassword !== "string") return null;
  return record.temporaryPassword;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  const params = await context.params;
  const actor = await getRequestActor(request);
  if (!actor || !actor.isAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const targetUserId = (params?.userId || "").trim().toLowerCase();
  if (!targetUserId) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }
  if (targetUserId === actor.userId) {
    return NextResponse.json({ error: "cannot modify own account" }, { status: 400 });
  }

  const payload = await request.json().catch(() => null);
  const temporaryPassword = parseResetPayload(payload);
  if (temporaryPassword === null) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }
  if (temporaryPassword.length > 0 && temporaryPassword.length < 8) {
    return NextResponse.json(
      { error: "temporaryPassword must be at least 8 characters" },
      { status: 400 },
    );
  }

  if (temporaryPassword.length > 0) {
    const updatedPassword = await setAuthIdentityTemporaryPassword({
      userId: targetUserId,
      temporaryPassword,
    });
    if (!updatedPassword) {
      return NextResponse.json({ error: "target not found" }, { status: 404 });
    }
  }

  const required = await setPasswordChangeRequired(targetUserId, true);
  if (!required) {
    return NextResponse.json({ error: "target not found" }, { status: 404 });
  }

  log.info({
    module: "admin",
    message: "admin.userPasswordReset",
    data: {
      actorUserId: actor.userId,
      targetUserId,
      hasTemporaryPassword: temporaryPassword.length > 0,
    },
  });

  return NextResponse.json({
    ok: true,
    userId: targetUserId,
    mustChangePassword: true,
    hasTemporaryPassword: temporaryPassword.length > 0,
  });
}
