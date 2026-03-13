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
import { createAuthFamily } from "@/lib/auth/authIdentity.server";

type FamilyCreatePayload = {
  name?: unknown;
  preferredFamilyId?: unknown;
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

function parseFamilyCreatePayload(payload: unknown) {
  if (typeof payload !== "object" || payload === null) return null;
  const record = payload as FamilyCreatePayload;

  if (typeof record.name !== "string") return null;
  const name = record.name.trim();
  if (!name) return null;

  if (record.preferredFamilyId !== undefined && typeof record.preferredFamilyId !== "string") return null;

  return {
    name,
    preferredFamilyId: record.preferredFamilyId === undefined ? undefined : record.preferredFamilyId.trim(),
  };
}

export async function POST(request: NextRequest) {
  const actor = await getRequestActor(request);
  if (!actor || !actor.isAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = parseFamilyCreatePayload(payload);
  if (!parsed) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const familyId = await createAuthFamily({
    name: parsed.name,
    ...(parsed.preferredFamilyId ? { preferredFamilyId: parsed.preferredFamilyId } : {}),
  });
  if (!familyId) {
    return NextResponse.json({ error: "unable to create family" }, { status: 400 });
  }

  log.info({
    module: "admin",
    message: "admin.familyCreated",
    data: {
      actorUserId: actor.userId,
      familyId,
      familyName: parsed.name,
    },
  });

  return NextResponse.json({ ok: true, familyId, name: parsed.name });
}
