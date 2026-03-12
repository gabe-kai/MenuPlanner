import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { log } from "@/lib/log";
import { getActorFromStoreState } from "@/lib/auth/actors";
import { authOptions } from "@/lib/auth/nextAuth";
import { parseSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth/sessionCookie";
import { useAuthAndFamilyStore } from "@/stores/authAndFamilyStore";
import { useRealAuth } from "@/lib/auth/authGateway";
import { updateAuthIdentityPassword } from "@/lib/auth/authIdentity.server";

type AccountActor = {
  userId: string;
  familyId: string;
};

type PasswordPayload = {
  currentPassword?: unknown;
  nextPassword?: unknown;
};

async function getRequestActor(request: NextRequest): Promise<AccountActor | null> {
  const state = useAuthAndFamilyStore.getState();
  if (useRealAuth) {
    const session = await getServerSession(authOptions);
    const userId = session?.user && (session.user as { id?: string }).id;
    const familyId = session?.user && (session.user as { familyId?: string }).familyId;
    if (!userId || !familyId) {
      return null;
    }
    return { userId, familyId };
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
  if (!actor) return null;
  return { userId: actor.user.id, familyId: actor.family.id };
}

function parsePasswordPayload(payload: unknown): {
  currentPassword: string;
  nextPassword: string;
} | null {
  if (typeof payload !== "object" || payload === null) return null;
  const raw = payload as PasswordPayload;
  if (typeof raw.currentPassword !== "string" || typeof raw.nextPassword !== "string") return null;
  if (!raw.currentPassword || !raw.nextPassword) return null;
  return {
    currentPassword: raw.currentPassword,
    nextPassword: raw.nextPassword,
  };
}

export async function POST(request: NextRequest) {
  const actor = await getRequestActor(request);
  if (!actor) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rawPayload = await request.json().catch(() => null);
  const parsed = parsePasswordPayload(rawPayload);
  if (!parsed) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const result = await updateAuthIdentityPassword({
    userId: actor.userId,
    currentPassword: parsed.currentPassword,
    nextPassword: parsed.nextPassword,
  });

  if (!result.ok) {
    if (result.reason === "invalid_password") {
      return NextResponse.json({ error: "invalid current password" }, { status: 403 });
    }
    if (result.reason === "invalid_payload") {
      return NextResponse.json({ error: "invalid payload" }, { status: 400 });
    }
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  log.info({
    module: "account",
    message: "account.passwordChanged",
    data: { userId: actor.userId, familyId: actor.familyId },
  });

  return NextResponse.json({ ok: true, userId: actor.userId });
}

