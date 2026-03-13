import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";

import { log } from "@/lib/log";
import { getActorFromStoreState } from "@/lib/auth/actors";
import { authOptions } from "@/lib/auth/nextAuth";
import { parseSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth/sessionCookie";
import { useAuthAndFamilyStore } from "@/stores/authAndFamilyStore";
import { useRealAuth } from "@/lib/auth/authGateway";
import { isSystemAdminUser } from "@/lib/auth/adminAuth";
import {
  listAuthFamilies,
  listAuthIdentities,
  type AdminDirectoryFamily,
  type AdminDirectoryUser,
} from "@/lib/auth/authIdentity.server";

type DirectoryUserResponse = Omit<AdminDirectoryUser, "editPolicy"> & {
  editPolicy: "free" | "approval_required" | "no_edit";
};

type DirectoryFamilyResponse = AdminDirectoryFamily;

type DirectoryResponse = {
  ok: true;
  users: DirectoryUserResponse[];
  families: DirectoryFamilyResponse[];
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

export async function GET(request: NextRequest) {
  const actor = await getRequestActor(request);
  if (!actor || !actor.isAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const identities = await listAuthIdentities();
  const families = await listAuthFamilies();

  const users: DirectoryUserResponse[] = identities.map((identity) => ({
    userId: identity.userId,
    name: identity.name,
    role: identity.role,
    familyId: identity.familyId,
    editPolicy: identity.editPolicy,
    mustChangePassword: identity.mustChangePassword,
  }));

  log.info({
    module: "admin",
    message: "admin.directoryRead",
    data: { actorUserId: actor.userId, familyId: actor.familyId, count: users.length },
  });

  const response: DirectoryResponse = {
    ok: true,
    users,
    families,
  };
  return NextResponse.json(response);
}
