import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { log } from "@/lib/log";
import { getActorFromStoreState } from "@/lib/auth/actors";
import { authOptions } from "@/lib/auth/nextAuth";
import { parseSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth/sessionCookie";
import { useAuthAndFamilyStore } from "@/stores/authAndFamilyStore";
import { useRealAuth } from "@/lib/auth/authGateway";
import { isSystemAdminUser } from "@/lib/auth/adminAuth";
import {
  getAuthEditPolicyForUser,
  getAuthIdentityByUserId,
  setAuthEditPolicyForUser,
} from "@/lib/auth/authIdentity.server";

type ChildEditPolicy = "free" | "approval_required" | "no_edit";

type PolicyPayload = {
  userId: string;
  editPolicy: string;
};

type RequestActor = {
  userId: string;
  familyId: string;
  role: "adult";
  isAdmin: boolean;
};

function isChildEditPolicy(raw: string): raw is ChildEditPolicy {
  return raw === "free" || raw === "approval_required" || raw === "no_edit";
}

async function getRequestActor(request: NextRequest): Promise<RequestActor | null> {
  const state = useAuthAndFamilyStore.getState();
  if (useRealAuth) {
    const session = await getServerSession(authOptions);
    const userId = session?.user && (session.user as { id?: string }).id;
    const familyId = session?.user && (session.user as { familyId?: string }).familyId;
    const role = session?.user && (session.user as { role?: string }).role;
    const isAdmin = isSystemAdminUser(userId);
    if (!userId || !familyId || (role !== "adult" && !isAdmin)) {
      return null;
    }
    return { userId, familyId, role: "adult", isAdmin };
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
  if (!actor || !actor.isAdult) return null;
  return { userId: actor.user.id, familyId: actor.family.id, role: "adult", isAdmin: actor.isAdmin };
}

async function getChildTargetForPolicyUpdate(
  actorFamilyId: string,
  targetUserId: string,
  actorIsAdmin: boolean,
) {
  const normalizedTargetUserId = targetUserId.trim().toLowerCase();
  if (!normalizedTargetUserId) return null;

  if (useRealAuth) {
    const identity = await getAuthIdentityByUserId(normalizedTargetUserId);
    if (!identity || identity.role !== "child") {
      return null;
    }
    if (!actorIsAdmin && identity.familyId !== actorFamilyId) {
      return null;
    }
    return {
      userId: normalizedTargetUserId,
      previousPolicy: (await getAuthEditPolicyForUser(normalizedTargetUserId)) ?? "free",
    };
  }

  const state = useAuthAndFamilyStore.getState();
  const actor = getActorFromStoreState(
    normalizedTargetUserId,
    actorIsAdmin ? null : actorFamilyId,
    state.users,
    state.families,
    state.memberships,
  );
  if (!actor || actor.user.role !== "child") {
    return null;
  }
  if (!actorIsAdmin && actor.familyId !== actorFamilyId) {
    return null;
  }

  return {
    userId: normalizedTargetUserId,
    previousPolicy: (await getAuthEditPolicyForUser(normalizedTargetUserId)) ?? "free",
  };
}

export async function PUT(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as PolicyPayload | null;
  if (!payload || typeof payload.userId !== "string" || typeof payload.editPolicy !== "string") {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }
  if (!isChildEditPolicy(payload.editPolicy)) {
    return NextResponse.json({ error: "invalid editPolicy" }, { status: 400 });
  }

  const actor = await getRequestActor(request);
  if (!actor) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const target = await getChildTargetForPolicyUpdate(
    actor.familyId,
    payload.userId,
    actor.isAdmin,
  );
  if (!target) {
    return NextResponse.json({ error: "target unavailable" }, { status: 400 });
  }

  const updated = await setAuthEditPolicyForUser(target.userId, payload.editPolicy);
  if (!updated) {
    return NextResponse.json({ error: "target not found" }, { status: 400 });
  }

  log.info({
    module: "auth",
    message: "policy.updated",
    data: {
      actorUserId: actor.userId,
      targetUserId: target.userId,
      previousPolicy: target.previousPolicy,
      nextPolicy: payload.editPolicy,
    },
  });

  return NextResponse.json({
    ok: true,
    userId: target.userId,
    editPolicy: payload.editPolicy,
  });
}
