import { create } from "zustand";
import { getDemoFamily, getDemoMemberships, getDemoUsers } from "@/lib/auth/demoIdentity";
import type { SystemRole } from "@/lib/auth/adminAuth";
import { log } from "@/lib/log";

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
  currentSystemRole: SystemRole | null;
  setCurrentUser: (userId: string | null) => void;
  setCurrentFamilyId: (familyId: string | null) => void;
  setIsAuthenticated: (value: boolean) => void;
  setCurrentSystemRole: (systemRole: SystemRole | null) => void;
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
  setAdminDirectory: (input: {
    users: User[];
    families: FamilyGroup[];
    memberships: Membership[];
  }) => void;
  deleteUser: (userId: string) => boolean;
  setUserRole: (userId: string, role: UserRole, actorUserId?: string) => boolean;
  moveUserToFamily: (
    userId: string,
    familyId: string,
    actorUserId?: string,
  ) => boolean;
  createFamily: (
    name: string,
    actorUserId?: string,
    preferredFamilyId?: string,
  ) => string | null;
  deleteFamily: (familyId: string, actorUserId?: string) => boolean;
  renameFamily: (familyId: string, name: string, actorUserId?: string) => boolean;
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
  currentSystemRole: null,
  setCurrentUser: (currentUserId) => {
    const newCurrentFamilyId =
      currentUserId === null ? null : getFamilyIdForUser(get(), currentUserId);
    set({
      currentUserId,
      currentFamilyId: newCurrentFamilyId,
      isAuthenticated: currentUserId !== null,
      currentSystemRole: currentUserId === null ? null : get().currentSystemRole,
    });
  },
  setCurrentFamilyId: (currentFamilyId) => set({ currentFamilyId }),
  setIsAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
  setCurrentSystemRole: (currentSystemRole) => set({ currentSystemRole }),
  createFamily: (name, actorUserId, preferredFamilyId) => {
    const normalizedName = name.trim();
    if (!normalizedName) {
      return null;
    }

    const state = get();
    const sanitizedPreferredFamilyId = preferredFamilyId
      ?.trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-+)|(-+$)/g, "")
      .replace(/-+/g, "-");
    const fallbackFamilyId = normalizedName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-+)|(-+$)/g, "")
      .replace(/-+/g, "-");
    const initialFamilyId =
      sanitizedPreferredFamilyId && sanitizedPreferredFamilyId.length > 0 ? sanitizedPreferredFamilyId : fallbackFamilyId;
    const resolvedInitialFamilyId = initialFamilyId.length > 0 ? initialFamilyId : "family";

    const usedFamilyIds = new Set(state.families.map((candidate) => candidate.id));
    let familyId = resolvedInitialFamilyId;
    let nextSuffix = 2;
    while (usedFamilyIds.has(familyId)) {
      familyId = `${initialFamilyId}-${nextSuffix}`;
      nextSuffix += 1;
    }

    set({
      families: [
        ...state.families,
        {
          id: familyId,
          name: normalizedName,
          memberIds: [],
        },
      ],
    });
    log.info({
      module: "admin",
      message: "admin.familyCreated",
      data: {
        actorUserId,
        familyId,
        name: normalizedName,
      },
    });
    return familyId;
  },
  deleteFamily: (familyId, actorUserId) => {
    const normalizedFamilyId = familyId.trim();
    if (!normalizedFamilyId) {
      return false;
    }

    const state = get();
    const familyIndex = state.families.findIndex((family) => family.id === normalizedFamilyId);
    if (familyIndex < 0) {
      return false;
    }
    const hasMembers = state.memberships.some(
      (membership) => membership.familyId === normalizedFamilyId,
    );
    if (hasMembers) {
      return false;
    }

    const families = state.families.filter((family) => family.id !== normalizedFamilyId);
    const nextCurrentFamilyId =
      state.currentFamilyId === normalizedFamilyId ? null : state.currentFamilyId;
    set({ families, currentFamilyId: nextCurrentFamilyId });

    log.info({
      module: "admin",
      message: "admin.familyDeleted",
      data: {
        actorUserId,
        familyId: normalizedFamilyId,
      },
    });
    return true;
  },
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
  setAdminDirectory: (input) => {
    const normalizedUsers = input.users
      .map((user) => ({
        id: user.id.trim().toLowerCase(),
        name: user.name.trim() || user.id,
        role: user.role,
      }))
      .filter((user) => user.id.length > 0);
    const validUserIds = new Set(normalizedUsers.map((user) => user.id));

    const memberships = input.memberships
      .map((membership) => ({
        userId: membership.userId.trim().toLowerCase(),
        familyId: membership.familyId.trim(),
        ...(membership.editPolicy === undefined ? {} : { editPolicy: membership.editPolicy }),
      }))
      .filter((membership) => validUserIds.has(membership.userId) && membership.familyId.length > 0);
    const membershipFamilyIds = new Set(memberships.map((membership) => membership.familyId));

    const normalizedFamilies = input.families
      .map((family) => ({
        id: family.id.trim(),
        name: family.name.trim() || family.id,
      }))
      .filter((family) => family.id.length > 0);
    const knownFamiliesById = new Map(normalizedFamilies.map((family) => [family.id, family]));
    const extraFamilyIds = [...membershipFamilyIds].filter((familyId) => !knownFamiliesById.has(familyId));
    const fallbackFamilies = extraFamilyIds.map((familyId) => ({
      id: familyId,
      name: `Family ${familyId}`,
    }));

    const families = [...normalizedFamilies, ...fallbackFamilies].map((family) => ({
      id: family.id,
      name: family.name,
      memberIds: [
        ...new Set(
          memberships
            .filter((membership) => membership.familyId === family.id)
            .map((membership) => membership.userId),
        ),
      ],
    }));

    const previousState = get();
    const nextCurrentUserId =
      previousState.currentUserId && validUserIds.has(previousState.currentUserId)
        ? previousState.currentUserId
        : null;
    const nextCurrentFamilyId =
      nextCurrentUserId && membershipFamilyIds.has(previousState.currentFamilyId ?? "")
        ? previousState.currentFamilyId
        : memberships.find((membership) => membership.userId === nextCurrentUserId)?.familyId ??
          previousState.currentFamilyId;

    set({
      users: normalizedUsers,
      families,
      memberships,
      currentUserId: nextCurrentUserId,
      currentFamilyId: nextCurrentFamilyId,
      isAuthenticated: nextCurrentUserId !== null,
      currentSystemRole: nextCurrentUserId !== null ? previousState.currentSystemRole : null,
    });
  },
  deleteUser: (userId) => {
    const normalizedUserId = userId.trim().toLowerCase();
    if (!normalizedUserId) {
      return false;
    }

    const state = get();
    const users = state.users.filter((user) => user.id !== normalizedUserId);
    const memberships = state.memberships.filter((membership) => membership.userId !== normalizedUserId);
    const families = state.families.map((family) => ({
      ...family,
      memberIds: family.memberIds.filter((memberId) => memberId !== normalizedUserId),
    }));
    const nextCurrentUserId = state.currentUserId === normalizedUserId ? null : state.currentUserId;
    const foundUser = state.users.find((user) => user.id === normalizedUserId);
    if (!foundUser) {
      return false;
    }
    const nextCurrentFamilyId =
      nextCurrentUserId === null || !state.currentFamilyId ? null : state.currentFamilyId;

    set({
      users,
      families,
      memberships,
      currentUserId: nextCurrentUserId,
      currentFamilyId: nextCurrentUserId ? nextCurrentFamilyId : null,
      isAuthenticated: nextCurrentUserId ? state.isAuthenticated : false,
      currentSystemRole: nextCurrentUserId ? state.currentSystemRole : null,
    });

    log.info({
      module: "admin",
      message: "admin.userDeleted",
      data: { actorUserId: state.currentUserId, targetUserId: normalizedUserId },
    });
    return true;
  },
    setUserRole: (userId, role, actorUserId) => {
      const normalizedUserId = userId.trim().toLowerCase();
      const nextRole = role === "adult" || role === "child" ? role : null;
      if (!normalizedUserId || !nextRole) {
        return false;
      }

      const state = get();
      const userIndex = state.users.findIndex((candidate) => candidate.id === normalizedUserId);
      if (userIndex < 0) {
        return false;
      }

      const currentUser = state.users[userIndex];
      if (!currentUser || currentUser.role === nextRole) {
        return false;
      }

      const users = [...state.users];
      users[userIndex] = { ...currentUser, role: nextRole };
      set({ users });

      log.info({
        module: "admin",
        message: "admin.userRoleUpdated",
        data: {
          actorUserId,
          targetUserId: normalizedUserId,
          previousRole: currentUser.role,
          nextRole,
        },
      });

      return true;
    },
    moveUserToFamily: (userId, familyId, actorUserId) => {
      const normalizedUserId = userId.trim().toLowerCase();
      const normalizedFamilyId = familyId.trim();
      if (!normalizedUserId || !normalizedFamilyId) {
        return false;
      }

      const state = get();
      const user = state.users.find((candidate) => candidate.id === normalizedUserId);
      if (!user) {
        return false;
      }

      const existingMembership = state.memberships.find(
        (membership) => membership.userId === normalizedUserId,
      );
      const previousFamilyId = existingMembership?.familyId ?? "";
      if (previousFamilyId === normalizedFamilyId) {
        return false;
      }

      const memberships = state.memberships.filter(
        (membership) => membership.userId !== normalizedUserId,
      );
      memberships.push({
        userId: normalizedUserId,
        familyId: normalizedFamilyId,
        ...(existingMembership?.editPolicy === undefined ? {} : { editPolicy: existingMembership.editPolicy }),
      });

      let families = [...state.families];
      const targetFamilyIndex = families.findIndex((family) => family.id === normalizedFamilyId);
      const targetName =
        targetFamilyIndex >= 0
          ? families[targetFamilyIndex]!.name
          : `Family ${normalizedFamilyId}`;

      if (targetFamilyIndex === -1) {
        families = [...families, { id: normalizedFamilyId, name: targetName, memberIds: [] }];
      }

      families = families.map((family) => {
        const withoutUser = family.memberIds.filter((id) => id !== normalizedUserId);
        if (family.id === normalizedFamilyId) {
          return {
            ...family,
            memberIds: withoutUser.includes(normalizedUserId)
              ? withoutUser
              : [...withoutUser, normalizedUserId],
          };
        }
        return { ...family, memberIds: withoutUser };
      });

      const nextCurrentFamilyId =
        state.currentUserId === normalizedUserId ? normalizedFamilyId : state.currentFamilyId;
      set({ families, memberships, currentFamilyId: nextCurrentFamilyId });

      log.info({
        module: "admin",
        message: "admin.userMovedFamily",
        data: {
          actorUserId,
          targetUserId: normalizedUserId,
          previousFamilyId: previousFamilyId || null,
          nextFamilyId: normalizedFamilyId,
        },
      });

      return true;
    },
    renameFamily: (familyId, name, actorUserId) => {
      const normalizedFamilyId = familyId.trim();
      const normalizedName = name.trim();
      if (!normalizedFamilyId || !normalizedName) {
        return false;
      }

      const state = get();
      const familyIndex = state.families.findIndex((candidate) => candidate.id === normalizedFamilyId);
      if (familyIndex < 0) {
        return false;
      }

      const existingFamily = state.families[familyIndex];
      if (!existingFamily) {
        return false;
      }
      if (existingFamily.name === normalizedName) {
        return false;
      }

      const families = [...state.families];
      families[familyIndex] = { ...existingFamily, name: normalizedName };
      set({ families });

      log.info({
        module: "admin",
        message: "admin.familyRenamed",
        data: {
          actorUserId,
          familyId: normalizedFamilyId,
          previousName: existingFamily.name,
          nextName: normalizedName,
        },
      });

      return true;
    },
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

