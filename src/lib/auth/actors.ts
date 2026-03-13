import type { ChildEditPolicy, Membership, User, FamilyGroup } from "@/stores/authAndFamilyStore";
import { useAuthAndFamilyStore } from "@/stores/authAndFamilyStore";
import { getDemoActorByUserId } from "@/lib/auth/demoIdentity";
import { isSystemAdminUser } from "@/lib/auth/adminAuth";

export interface SessionActor {
  user: User;
  family: FamilyGroup;
  membership?: Membership;
  userId: string;
  familyId: string;
  isAdult: boolean;
  isAdmin: boolean;
  mustChangePassword?: boolean;
  editPolicy: ChildEditPolicy;
}

export const DEFAULT_EDIT_POLICY: ChildEditPolicy = "free";

function findMembershipByUserId(
  memberships: Membership[],
  userId: string,
  familyId: string | null,
): Membership | undefined {
  return memberships.find(
    (membership) =>
      membership.userId === userId &&
      (!familyId || membership.familyId === familyId),
  );
}

export function getActorFromStoreState(
  userId: string | null,
  familyId: string | null,
  users: readonly User[],
  families: readonly FamilyGroup[],
  memberships: readonly Membership[],
): SessionActor | null {
  const normalizedUserId = typeof userId === "string" ? userId.trim().toLowerCase() : "";
  const normalizedFamilyId = typeof familyId === "string" ? familyId.trim() : null;
  if (!normalizedUserId) return null;

  const user = users.find((candidate) => candidate.id === normalizedUserId);
  if (!user) {
    const demoActor = getDemoActorByUserId(normalizedUserId, normalizedFamilyId);
    if (!demoActor) return null;
    return {
      ...demoActor,
      isAdmin: isSystemAdminUser(normalizedUserId),
    };
  }

  const targetFamilyId = normalizedFamilyId ?? memberships.find((m) => m.userId === user.id)?.familyId;
  if (!targetFamilyId) return null;

  const family = families.find((candidate) => candidate.id === targetFamilyId);
  if (!family) {
    const demoActor = getDemoActorByUserId(normalizedUserId, targetFamilyId);
    if (!demoActor) return null;
    return {
      ...demoActor,
      isAdmin: isSystemAdminUser(normalizedUserId),
    };
  }

  const membership = findMembershipByUserId(
    memberships as Membership[],
    user.id,
    targetFamilyId,
  );
  if (!membership && (user.role === "adult" || user.role === "child")) {
    const demoActor = getDemoActorByUserId(normalizedUserId, targetFamilyId);
    if (!demoActor) return null;
    return {
      ...demoActor,
      isAdmin: isSystemAdminUser(normalizedUserId),
    };
  }
  return {
    user,
    family,
    userId: normalizedUserId,
    familyId: targetFamilyId,
    isAdult: user.role === "adult",
    isAdmin: isSystemAdminUser(normalizedUserId),
    editPolicy: membership?.editPolicy ?? DEFAULT_EDIT_POLICY,
    ...(membership ? { membership } : {}),
  };
}

export function getSessionActor(): SessionActor | null {
  const { currentUserId, currentFamilyId, users, families, memberships } =
    useAuthAndFamilyStore.getState();
  return getActorFromStoreState(
    currentUserId,
    currentFamilyId,
    users,
    families,
    memberships,
  );
}

export function getActorByUserId(userId: string): SessionActor | null {
  const { currentFamilyId, users, families, memberships } =
    useAuthAndFamilyStore.getState();
  return getActorFromStoreState(
    userId,
    currentFamilyId,
    users,
    families,
    memberships,
  );
}
