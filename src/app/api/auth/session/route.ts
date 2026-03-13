import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import {
  getAuthEditPolicyForUser,
  getAuthIdentityByUserId,
} from "@/lib/auth/authIdentity.server";
import { authOptions } from "@/lib/auth/nextAuth";
import { isSystemAdminUser } from "@/lib/auth/adminAuth";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ session: null });
  }

  const sessionUser = session.user as {
    id?: string;
    familyId?: string;
    role?: string;
    name?: string;
    systemRole?: string;
    mustChangePassword?: boolean;
  };
  const userId = sessionUser.id;
  const familyId = sessionUser.familyId;
  if (!userId || !familyId) {
    return NextResponse.json({ session: null }, { status: 401 });
  }

  const identity = await getAuthIdentityByUserId(userId);
  if (!identity || identity.familyId !== familyId) {
    return NextResponse.json({ session: null }, { status: 401 });
  }
  const editPolicy = await getAuthEditPolicyForUser(userId);

  const parsedExpiresAt = session.expires ? new Date(session.expires).getTime() : Number.NaN;
  const fallbackExpiresAt = Date.now() + 60 * 60 * 24 * 30 * 1000;
  const expiresAt = Number.isFinite(parsedExpiresAt) ? parsedExpiresAt : fallbackExpiresAt;
  const issuedAt = Date.now();
  const systemRole =
    sessionUser.systemRole === "admin" ? "admin" : isSystemAdminUser(userId) ? "admin" : "user";

  return NextResponse.json({
    session: {
      userId,
      familyId,
      issuedAt,
      expiresAt,
      name: identity.name,
      role: identity.role,
      systemRole,
      editPolicy,
      mustChangePassword: sessionUser.mustChangePassword ?? identity.mustChangePassword,
    },
  });
}
