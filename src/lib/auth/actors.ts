import type { ChildEditPolicy, Membership, User, FamilyGroup } from "@/stores/authAndFamilyStore";
import { useAuthAndFamilyStore } from "@/stores/authAndFamilyStore";
import { getDemoActorByUserId } from "@/lib/auth/demoIdentity";

export interface SessionActor {
  user: User;
  family: FamilyGroup;
  membership?: Membership;
  userId: string;
  familyId: string;
  isAdult: boolean;
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
  if (userId === null) return null;
  const user = users.find((candidate) => candidate.id === userId);
  if (!user) {
    return getDemoActorByUserId(userId, familyId);
  }

  const targetFamilyId = familyId ?? memberships.find((m) => m.userId === user.id)?.familyId;
  if (!targetFamilyId) return null;

  const family = families.find((candidate) => candidate.id === targetFamilyId);
  if (!family) {
    return getDemoActorByUserId(userId, familyId);
  }

  const membership = findMembershipByUserId(
    memberships as Membership[],
    user.id,
    targetFamilyId,
  );
  if (!membership && userId && (user.role === "adult" || user.role === "child")) {
    const demoActor = getDemoActorByUserId(userId, targetFamilyId);
    if (demoActor) return demoActor;
  }
  return {
    user,
    family,
    userId: user.id,
    familyId: targetFamilyId,
    isAdult: user.role === "adult",
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
