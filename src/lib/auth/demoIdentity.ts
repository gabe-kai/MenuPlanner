import type { ChildEditPolicy, Membership, User } from "@/stores/authAndFamilyStore";

export interface DemoIdentityUser extends User {
  familyId: string;
  editPolicy?: ChildEditPolicy;
}

export interface DemoIdentityRecord {
  userId: string;
  name: string;
  role: User["role"];
  familyId: string;
  password: string;
  editPolicy?: ChildEditPolicy;
}

export const DEMO_AUTH_PASSWORD =
  process.env.NEXT_PUBLIC_DEMO_AUTH_PASSWORD ?? process.env.NEXTAUTH_DEMO_PASSWORD ?? "menuplanner";
const DEMO_IDENTITY_CREDENTIALS = parseDemoIdentityCredentials(
  process.env.NEXTAUTH_IDENTITY_CREDENTIALS ?? process.env.NEXT_PUBLIC_IDENTITY_CREDENTIALS,
);

const DEFAULT_FAMILY_ID = "fam-1";
const DEFAULT_FAMILY_NAME = "Household";
const DEMO_IDENTITY_DIRECTORY_KEY = "__menuplanner_demo_identity_directory_v1";

type DemoIdentityStore = {
  directory: DemoIdentityRecord[];
};

const demoIdentityStore = (() => {
  const globalScope = globalThis as typeof globalThis & {
    [DEMO_IDENTITY_DIRECTORY_KEY]?: DemoIdentityStore;
  };
  if (!globalScope[DEMO_IDENTITY_DIRECTORY_KEY]) {
    globalScope[DEMO_IDENTITY_DIRECTORY_KEY] = { directory: initialDemoIdentities() };
  }
  return globalScope[DEMO_IDENTITY_DIRECTORY_KEY] as DemoIdentityStore;
})();

function initialDemoIdentities(): DemoIdentityRecord[] {
  return [
  {
    userId: "mom",
    name: "Mom",
    role: "adult",
    familyId: DEFAULT_FAMILY_ID,
    password: getPasswordForUser("mom"),
  },
  {
    userId: "dad",
    name: "Dad",
    role: "adult",
    familyId: DEFAULT_FAMILY_ID,
    password: getPasswordForUser("dad"),
  },
  {
    userId: "sarah",
    name: "Sarah",
    role: "child",
    familyId: DEFAULT_FAMILY_ID,
    password: getPasswordForUser("sarah"),
    editPolicy: "approval_required",
  },
  {
    userId: "elizabeth",
    name: "Elizabeth",
    role: "child",
    familyId: DEFAULT_FAMILY_ID,
    password: getPasswordForUser("elizabeth"),
    editPolicy: "approval_required",
  },
  {
    userId: "daniel",
    name: "Daniel",
    role: "child",
    familyId: DEFAULT_FAMILY_ID,
    password: getPasswordForUser("daniel"),
    editPolicy: "no_edit",
  },
  {
    userId: "elijah",
    name: "Elijah",
    role: "child",
    familyId: DEFAULT_FAMILY_ID,
    password: getPasswordForUser("elijah"),
    editPolicy: "free",
  },
  ] as DemoIdentityRecord[];
}

type DemoIdentityCredentialMap = Record<string, string>;

export function getDemoUsers() {
  return demoIdentityStore.directory.map((identity) => ({
    id: identity.userId,
    name: identity.name,
    role: identity.role,
  }));
}

export function getDemoFamily() {
  return {
    id: DEFAULT_FAMILY_ID,
    name: DEFAULT_FAMILY_NAME,
    memberIds: demoIdentityStore.directory.map((identity) => identity.userId),
  };
}

export function getDemoMemberships() {
  return demoIdentityStore.directory.map((identity) => {
    const membership = { userId: identity.userId, familyId: identity.familyId } as {
      userId: string;
      familyId: string;
      editPolicy?: ChildEditPolicy;
    };
    if (identity.editPolicy !== undefined) {
      membership.editPolicy = identity.editPolicy;
    }
    return membership;
  });
}

export interface RegisteredIdentityInput {
  userId: string;
  name: string;
  role: User["role"];
  password: string;
  familyId?: string;
  editPolicy?: ChildEditPolicy | undefined;
}

export function registerDemoIdentity(input: RegisteredIdentityInput) {
  const canonicalUserId = normalizeUserId(input.userId);
  const existing = getDemoIdentityByUserId(canonicalUserId);
  if (existing) {
    return { ok: false as const, reason: "already_exists" };
  }

  const targetFamilyId = (input.familyId ?? DEFAULT_FAMILY_ID).trim();
  if (targetFamilyId.trim().length === 0) {
    return { ok: false as const, reason: "missing_family" };
  }

  demoIdentityStore.directory.push({
    userId: canonicalUserId,
    name: input.name,
    role: input.role,
    familyId: targetFamilyId,
    password: input.password,
    ...(input.editPolicy === undefined ? {} : { editPolicy: input.editPolicy }),
  });

  return { ok: true as const };
}

export function getDemoActorByUserId(userId: string, familyId?: string | null) {
  const identity = getDemoIdentityByUserId(userId);
  if (!identity) return null;
  const canonicalFamilyId = familyId?.trim();
  const targetFamilyId = canonicalFamilyId ?? identity.familyId;
  if (!targetFamilyId) return null;
  const normalizedUserId = normalizeUserId(userId);
  if (identity.familyId !== targetFamilyId && !isFamilyMember(normalizedUserId, targetFamilyId)) return null;

  const family = getDemoFamily();
  if (family.id !== targetFamilyId) return null;
  const membership = getDemoMemberships().find(
    (entry) => entry.userId === normalizedUserId && entry.familyId === targetFamilyId,
  );

  return {
    user: {
      id: identity.id,
      name: identity.name,
      role: identity.role,
    },
    family,
    userId: normalizedUserId,
    familyId: targetFamilyId,
    isAdult: identity.role === "adult",
    editPolicy: membership?.editPolicy ?? "free",
    ...(membership ? { membership } : {}),
  };
}

function isFamilyMember(userId: string, familyId: string) {
  const normalizedUserId = normalizeUserId(userId);
  return demoIdentityStore.directory.some(
    (entry) => entry.userId === normalizedUserId && entry.familyId === familyId,
  );
}

function parseDemoIdentityCredentials(rawValue: string | undefined) {
  if (!rawValue) return {};
  try {
    const parsed = JSON.parse(rawValue) as DemoIdentityCredentialMap;
    if (typeof parsed !== "object" || parsed === null) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([userId, value]) => typeof userId === "string" && typeof value === "string" && userId.length > 0,
      ),
    ) as DemoIdentityCredentialMap;
  } catch {
    return {};
  }
}

function getPasswordForUser(userId: string) {
  return DEMO_IDENTITY_CREDENTIALS[userId] ?? DEMO_AUTH_PASSWORD;
}

export function getDemoIdentityByUserId(userId: string) {
  const normalizedUserId = normalizeUserId(userId);
  const user = demoIdentityStore.directory.find((candidate) => candidate.userId === normalizedUserId);
  if (!user) return null;
  return {
    id: user.userId,
    name: user.name,
    role: user.role,
    familyId: user.familyId,
    ...(user.editPolicy ? { editPolicy: user.editPolicy } : {}),
    password: user.password,
  } as DemoIdentityUser & { password: string };
}

export function verifyDemoIdentityCredentials(userId: string, password: string) {
  const identity = getDemoIdentityByUserId(userId);
  if (!identity || identity.password !== password) return null;
  return identity;
}

function normalizeUserId(rawUserId: string) {
  return rawUserId.trim().toLowerCase();
}

