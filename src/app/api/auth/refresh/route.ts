import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth/nextAuth";
import {
  getAuthEditPolicyForUser,
  getAuthIdentityByUserId,
} from "@/lib/auth/authIdentity.server";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ session: null }, { status: 401 });
  }

  const userId = (session.user as { id?: string; familyId?: string }).id;
  const familyId = (session.user as { familyId?: string }).familyId;
  if (!userId || !familyId) {
    return NextResponse.json({ session: null }, { status: 401 });
  }

  const identity = await getAuthIdentityByUserId(userId);
  if (!identity || identity.familyId !== familyId) {
    return NextResponse.json({ session: null }, { status: 401 });
  }
  const editPolicy = await getAuthEditPolicyForUser(userId);

  const now = Date.now();
  const parsedExpiresAt = session.expires ? new Date(session.expires).getTime() : Number.NaN;
  const fallbackExpiresAt = now + 60 * 60 * 24 * 30 * 1000;
  const expiresAt = Number.isFinite(parsedExpiresAt) ? parsedExpiresAt : fallbackExpiresAt;
  const refreshedSession = {
    userId,
    familyId,
    issuedAt: now,
    expiresAt,
    name: identity.name,
    role: identity.role,
    editPolicy,
  };

  return NextResponse.json({ session: refreshedSession });
}

