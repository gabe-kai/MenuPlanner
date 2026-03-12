import { create } from "zustand";
import { getDemoFamily, getDemoMemberships, getDemoUsers } from "@/lib/auth/demoIdentity";

export type UserRole = "adult" | "child";

export interface User {
  id: string;
  name: string;
  role: UserRole;
}

export interface FamilyGroup {
  id: string;
  name: string;
  memberIds: string[];
}

export type ChildEditPolicy = "free" | "approval_required" | "no_edit";

export interface Membership {
  userId: string;
  familyId: string;
  editPolicy?: ChildEditPolicy;
}

export interface AuthAndFamilyState {
  users: User[];
  families: FamilyGroup[];
  memberships: Membership[];
  currentUserId: string | null;
  currentFamilyId: string | null;
  isAuthenticated: boolean;
  setCurrentUser: (userId: string | null) => void;
  setCurrentFamilyId: (familyId: string | null) => void;
  setIsAuthenticated: (value: boolean) => void;
  upsertUserContext: (input: {
    userId: string;
    familyId: string;
    name?: string;
    role?: UserRole;
  }) => void;
  setMembershipEditPolicy: (
    userId: string,
    familyId: string,
    editPolicy: ChildEditPolicy,
  ) => void;
  getUserById: (userId: string) => User | undefined;
  getFamilyById: (familyId: string) => FamilyGroup | undefined;
  getMembershipForUser: (userId: string) => Membership | undefined;
}

export const useAuthAndFamilyStore = create<AuthAndFamilyState>((set, get) => ({
  users: getDemoUsers(),
  families: [getDemoFamily()],
  memberships: getDemoMemberships(),
  currentUserId: null,
  currentFamilyId: null,
  isAuthenticated: false,
  setCurrentUser: (currentUserId) => {
    const newCurrentFamilyId =
      currentUserId === null ? null : getFamilyIdForUser(get(), currentUserId);
    set({
      currentUserId,
      currentFamilyId: newCurrentFamilyId,
      isAuthenticated: currentUserId !== null,
    });
  },
  setCurrentFamilyId: (currentFamilyId) => set({ currentFamilyId }),
  setIsAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
  upsertUserContext: ({ userId, familyId, name, role }) =>
    set((state) => {
      const trimmedName = typeof name === "string" && name.trim().length > 0 ? name.trim() : undefined;

      let users = state.users;
      const userIndex = users.findIndex((user) => user.id === userId);
      if (userIndex === -1) {
        users = [
          ...users,
          {
            id: userId,
            name: trimmedName ?? userId,
            role: role ?? "adult",
          },
        ];
      } else {
        const existingUser = users[userIndex];
        if (existingUser) {
          const nextName = trimmedName ?? existingUser.name;
          const nextRole = role ?? existingUser.role;
          if (nextName !== existingUser.name || nextRole !== existingUser.role) {
            users = [...users];
            users[userIndex] = {
              ...existingUser,
              name: nextName,
              role: nextRole,
            };
          }
        }
      }

      let families = state.families;
      const familyIndex = families.findIndex((family) => family.id === familyId);
      if (familyIndex === -1) {
        families = [
          ...families,
          {
            id: familyId,
            name: state.families[0]?.name ?? "Household",
            memberIds: [userId],
          },
        ];
      } else {
        const existingFamily = families[familyIndex];
        if (existingFamily && !existingFamily.memberIds.includes(userId)) {
          families = [...families];
          families[familyIndex] = {
            ...existingFamily,
            memberIds: [...existingFamily.memberIds, userId],
          };
        }
      }

      let memberships = state.memberships;
      const hasMembership = memberships.some(
        (membership) => membership.userId === userId && membership.familyId === familyId,
      );
      if (!hasMembership) {
        memberships = [...memberships, { userId, familyId }];
      }

      return { users, families, memberships };
    }),
  setMembershipEditPolicy: (userId, familyId, editPolicy) =>
    set((state) => {
      const normalizedUserId = userId.trim().toLowerCase();
      const normalizedFamilyId = familyId.trim().toLowerCase();
      if (!normalizedUserId || !normalizedFamilyId) {
        return {};
      }

      const memberships = [...state.memberships];
      const index = memberships.findIndex(
        (membership) =>
          membership.userId === normalizedUserId &&
          membership.familyId === normalizedFamilyId,
      );
      if (index === -1) {
        memberships.push({
          userId: normalizedUserId,
          familyId: normalizedFamilyId,
          editPolicy,
        });
        return { memberships };
      }

      const existing = memberships[index];
      if (!existing || existing.editPolicy === editPolicy) {
        return {};
      }
      memberships[index] = { ...existing, editPolicy };
      return { memberships };
    }),
  getUserById: (userId) => get().users.find((user) => user.id === userId),
  getFamilyById: (familyId) =>
    get().families.find((family) => family.id === familyId),
  getMembershipForUser: (userId) =>
    get().memberships.find((membership) => membership.userId === userId),
}));

function getFamilyIdForUser(state: AuthAndFamilyState, userId: string): string | null {
  const membership = state.memberships.find((item) => item.userId === userId);
  return membership?.familyId ?? state.currentFamilyId;
}

