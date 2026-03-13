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
  getAuthIdentityByUserId,
  getAuthIdentitySnapshot,
  updateAuthIdentityName,
  getAuthEditPolicyForUser,
} from "@/lib/auth/authIdentity.server";

type AccountActor = {
  userId: string;
  familyId: string;
  isAdmin: boolean;
};

type AccountPayload = {
  userId: string;
  name: string;
  familyId: string;
  role: "adult" | "child";
  editPolicy?: "free" | "approval_required" | "no_edit";
  mustChangePassword?: boolean;
  systemRole?: "admin" | "user";
};

type ProfileUpdatePayload = {
  name?: unknown;
};

async function getRequestActor(request: NextRequest): Promise<AccountActor | null> {
  const state = useAuthAndFamilyStore.getState();
  if (useRealAuth) {
    const session = await getServerSession(authOptions);
    const userId = session?.user && (session.user as { id?: string }).id;
    const familyId = session?.user && (session.user as { familyId?: string }).familyId;
    const role = session?.user && (session.user as { role?: string }).role;
    const systemRole = session?.user && (session.user as { systemRole?: string }).systemRole;
    if (!userId || !familyId || role !== "adult" && role !== "child") {
      return null;
    }
    return {
      userId,
      familyId,
      isAdmin: systemRole === "admin" || isSystemAdminUser(userId),
    };
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
  return { userId: actor.user.id, familyId: actor.family.id, isAdmin: actor.isAdmin };
}

function parseUpdateNamePayload(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const record = payload as ProfileUpdatePayload;
  if (typeof record.name !== "string") return null;
  const name = record.name.trim();
  if (!name) return null;
  return name;
}

export async function GET(request: NextRequest) {
  const actor = await getRequestActor(request);
  if (!actor) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const identity = await getAuthIdentitySnapshot(actor.userId);
  if (!identity || identity.familyId !== actor.familyId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const editPolicy = await getAuthEditPolicyForUser(identity.userId);
  const payload: AccountPayload = {
    userId: identity.userId,
    name: identity.name,
    familyId: identity.familyId,
    role: identity.role,
    systemRole: actor.isAdmin ? "admin" : "user",
    ...(identity.mustChangePassword ? { mustChangePassword: true } : {}),
    ...(editPolicy ? { editPolicy } : {}),
  };

  return NextResponse.json(payload);
}

export async function PUT(request: NextRequest) {
  const actor = await getRequestActor(request);
  if (!actor) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rawPayload = await request.json().catch(() => null);
  const nextName = parseUpdateNamePayload(rawPayload);
  if (!nextName) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const identity = await getAuthIdentityByUserId(actor.userId);
  if (!identity || identity.familyId !== actor.familyId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const updated = await updateAuthIdentityName({ userId: actor.userId, name: nextName });
  if (!updated) {
    return NextResponse.json({ error: "update failed" }, { status: 500 });
  }

  log.info({
    module: "account",
    message: "account.profileUpdated",
    data: { userId: actor.userId, familyId: actor.familyId, name: nextName },
  });

  return NextResponse.json({ ok: true, userId: actor.userId, name: nextName });
}

