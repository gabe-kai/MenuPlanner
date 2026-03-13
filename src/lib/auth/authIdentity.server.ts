import "server-only";

import { compare, hash } from "bcryptjs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { getDemoIdentityByUserId, getDemoUsers } from "@/lib/auth/demoIdentity";
import { prisma } from "@/lib/db/prisma";
import { log } from "@/lib/log";

const BOOTSTRAP_KEY = "__menuplanner_auth_identity_bootstrap_v1";
const BOOTSTRAP_PROMISE_KEY = "__menuplanner_auth_identity_bootstrap_promise_v1";
const POLICY_STATE_KEY = "__menuplanner_auth_identity_policy_state_v1";
const FAMILY_NAME_STATE_KEY = "__menuplanner_auth_family_name_state_v1";
const DEFAULT_FAMILY_ID = "fam-1";
const DEFAULT_FAMILY_NAME_PREFIX = "family";
const PASSWORD_HASH_ROUNDS = 10;
const LEGACY_DEMO_DIRECTORY_FILE = path.join(
  process.cwd(),
  ".data",
  "demo-identities.json",
);

export type ChildEditPolicy = "free" | "approval_required" | "no_edit";

export interface AuthIdentityRecord {
  userId: string;
  name: string;
  role: "adult" | "child";
  familyId: string;
  mustChangePassword: boolean;
}

export interface AdminDirectoryUser extends AuthIdentityRecord {
  editPolicy: ChildEditPolicy;
}

export interface AdminDirectoryFamily {
  id: string;
  name: string;
}

export interface RegisterAuthIdentityInput {
  userId: string;
  name: string;
  role: "adult" | "child";
  password: string;
  familyId?: string;
  familyName?: string;
  familyMode?: "create" | "join";
  mustChangePassword?: boolean;
}

export type RegisterAuthIdentityResult =
  | { ok: true; userId: string; familyId: string }
  | { ok: false; reason: "already_exists" | "invalid_payload" };

export interface UpdateAuthIdentityNameInput {
  userId: string;
  name: string;
}

export interface UpdateAuthIdentityPasswordInput {
  userId: string;
  currentPassword: string;
  nextPassword: string;
}

export interface UpdateAdminPasswordInput {
  userId: string;
  temporaryPassword: string;
}

export type UpdateAuthIdentityPasswordResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "invalid_password" | "invalid_payload" };

type LegacyDemoIdentityRecord = {
  userId: string;
  name: string;
  role: "adult" | "child";
  password: string;
  familyId?: string;
};

function normalizeUserId(rawUserId: string) {
  return rawUserId.trim().toLowerCase();
}

function toDbRole(role: "adult" | "child") {
  return role === "adult" ? "ADULT" : "CHILD";
}

function toAppRole(role: string): "adult" | "child" {
  return role === "ADULT" ? "adult" : "child";
}

function mapAuthIdentity(
  record: Awaited<ReturnType<typeof prisma.authUser.findUnique>>,
): AuthIdentityRecord | null {
  if (!record) return null;
  return {
    userId: record.userId,
    name: record.name,
    role: toAppRole(record.role),
    familyId: record.familyId,
    mustChangePassword: record.mustChangePassword,
  };
}

function normalizeFamilyName(rawFamilyName: string) {
  return rawFamilyName.trim();
}

function createFamilyIdFromName(rawFamilyName: string) {
  const normalized = normalizeFamilyName(rawFamilyName).toLowerCase();
  const slug = normalized
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/(^-+)|(-+$)/g, "")
    .replace(/-+/g, "-");
  return slug.length > 0 ? slug : DEFAULT_FAMILY_NAME_PREFIX;
}

async function getAllFamilyIds() {
  const identities = await prisma.authUser.findMany({
    select: { familyId: true },
    distinct: ["familyId"],
  });
  return new Set(identities.map((entry) => entry.familyId));
}

async function resolveFamilyIdForRegistration(
  mode: "create" | "join",
  familyId?: string,
  familyName?: string,
) {
  if (mode === "join") {
    const trimmedFamilyId = familyId?.trim();
    return trimmedFamilyId && trimmedFamilyId.length > 0 ? trimmedFamilyId : DEFAULT_FAMILY_ID;
  }

  const baseFamilyId = createFamilyIdFromName(familyName ?? "");
  const allFamilyIds = await getAllFamilyIds();
  if (!allFamilyIds.has(baseFamilyId)) {
    return baseFamilyId;
  }

  let suffix = 2;
  let nextFamilyId = `${baseFamilyId}-${suffix}`;
  while (allFamilyIds.has(nextFamilyId)) {
    suffix += 1;
    nextFamilyId = `${baseFamilyId}-${suffix}`;
  }
  return nextFamilyId;
}

async function ensureIdentityExists(input: {
  userId: string;
  name: string;
  role: "adult" | "child";
  password: string;
  familyId?: string;
  editPolicy?: ChildEditPolicy;
  mustChangePassword?: boolean;
}) {
  const normalizedUserId = normalizeUserId(input.userId);
  if (!normalizedUserId) return;

  const existing = await prisma.authUser.findUnique({
    where: { userId: normalizedUserId },
    select: { id: true },
  });
  if (existing) return;

  const passwordHash = await hash(input.password, PASSWORD_HASH_ROUNDS);
  await prisma.authUser.create({
    data: {
      userId: normalizedUserId,
      name: input.name.trim(),
      role: toDbRole(input.role),
      familyId: input.familyId?.trim() || DEFAULT_FAMILY_ID,
      passwordHash,
      mustChangePassword: input.mustChangePassword ?? false,
    },
  });
  const policy = input.editPolicy ?? "free";
  const policyState = getPolicyState();
  policyState.policies[normalizedUserId] = policy;
}

async function importSeededDemoIdentities() {
  const users = getDemoUsers();
  for (const user of users) {
    const identity = getDemoIdentityByUserId(user.id);
    if (!identity) continue;
    const candidateEditPolicy = identity.editPolicy ?? "";
    const editPolicy = isChildEditPolicy(candidateEditPolicy) ? candidateEditPolicy : undefined;
    await ensureIdentityExists({
      userId: identity.id,
      name: identity.name,
      role: identity.role,
      familyId: identity.familyId,
      password: identity.password,
      ...(editPolicy ? { editPolicy } : {}),
    });
  }
}

function parseLegacyDemoIdentity(raw: unknown): LegacyDemoIdentityRecord | null {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as Record<string, unknown>;

  const userId = typeof record.userId === "string" ? normalizeUserId(record.userId) : "";
  const name = typeof record.name === "string" ? record.name.trim() : "";
  const role = record.role;
  const password = typeof record.password === "string" ? record.password : "";
  const familyId =
    typeof record.familyId === "string" && record.familyId.trim().length > 0
      ? record.familyId.trim()
      : undefined;

  if (!userId || !name || !password || (role !== "adult" && role !== "child")) {
    return null;
  }

  return {
    userId,
    name,
    role,
    password,
    ...(familyId ? { familyId } : {}),
  };
}

async function importLegacyDemoDirectoryFile() {
  try {
    const raw = await readFile(LEGACY_DEMO_DIRECTORY_FILE, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return;

    for (const entry of parsed) {
      const legacyIdentity = parseLegacyDemoIdentity(entry);
      if (!legacyIdentity) continue;
      await ensureIdentityExists({
        userId: legacyIdentity.userId,
        name: legacyIdentity.name,
        role: legacyIdentity.role,
        password: legacyIdentity.password,
        ...(legacyIdentity.familyId ? { familyId: legacyIdentity.familyId } : {}),
      });
    }
  } catch (error) {
    const nodeError = error as { code?: string };
    if (nodeError.code === "ENOENT") return;
    log.warn({
      module: "auth",
      message: "auth.legacyIdentityImportFailed",
      data: { reason: nodeError.code ?? "unknown_error" },
    });
  }
}

function isChildEditPolicy(raw: string): raw is ChildEditPolicy {
  return raw === "free" || raw === "approval_required" || raw === "no_edit";
}

type FamilyNameState = {
  names: Record<string, string>;
};

function getFamilyNameState() {
  const globalScope = globalThis as typeof globalThis & {
    [FAMILY_NAME_STATE_KEY]?: FamilyNameState;
  };
  if (!globalScope[FAMILY_NAME_STATE_KEY]) {
    globalScope[FAMILY_NAME_STATE_KEY] = { names: {} };
  }
  return globalScope[FAMILY_NAME_STATE_KEY];
}

function getKnownFamilyName(familyId: string) {
  const normalizedFamilyId = familyId.trim();
  if (!normalizedFamilyId) return null;
  const familyNameState = getFamilyNameState();
  return familyNameState.names[normalizedFamilyId] ?? null;
}

function setKnownFamilyName(familyId: string, familyName: string) {
  const normalizedFamilyId = familyId.trim();
  const normalizedFamilyName = normalizeFamilyName(familyName);
  if (!normalizedFamilyId || !normalizedFamilyName) {
    return false;
  }
  const familyNameState = getFamilyNameState();
  familyNameState.names[normalizedFamilyId] = normalizedFamilyName;
  return true;
}

function normalizeFamilyId(rawFamilyId: string) {
  return rawFamilyId.trim().toLowerCase();
}

function getPolicyState() {
  const globalScope = globalThis as typeof globalThis & {
    [POLICY_STATE_KEY]?: {
      policies: Record<string, ChildEditPolicy>;
    };
  };
  if (!globalScope[POLICY_STATE_KEY]) {
    globalScope[POLICY_STATE_KEY] = { policies: {} };
  }
  return globalScope[POLICY_STATE_KEY];
}

function getCachedAuthEditPolicy(userId: string) {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) return "free";
  const policyState = getPolicyState();
  return policyState.policies[normalizedUserId] ?? "free";
}

function getBootstrapState() {
  const globalScope = globalThis as typeof globalThis & {
    [BOOTSTRAP_KEY]?: boolean;
    [BOOTSTRAP_PROMISE_KEY]?: Promise<void>;
  };
  return globalScope;
}

export async function ensureAuthIdentityBootstrap() {
  const state = getBootstrapState();
  if (state[BOOTSTRAP_KEY]) return;
  if (!state[BOOTSTRAP_PROMISE_KEY]) {
    state[BOOTSTRAP_PROMISE_KEY] = (async () => {
      await importSeededDemoIdentities();
      await importLegacyDemoDirectoryFile();
      state[BOOTSTRAP_KEY] = true;
    })();
  }
  try {
    await state[BOOTSTRAP_PROMISE_KEY];
  } finally {
    delete state[BOOTSTRAP_PROMISE_KEY];
  }
}

export async function registerAuthIdentity(
  input: RegisterAuthIdentityInput,
): Promise<RegisterAuthIdentityResult> {
  await ensureAuthIdentityBootstrap();

  const normalizedUserId = normalizeUserId(input.userId);
  const normalizedName = input.name.trim();
  const password = input.password;
  const familyMode = input.familyMode === "create" ? "create" : "join";
  const normalizedFamilyName = input.familyName?.trim() ?? "";
  if (familyMode === "create" && normalizedFamilyName.length === 0) {
    return { ok: false, reason: "invalid_payload" };
  }

  if (!normalizedUserId || !normalizedName || !password) {
    return { ok: false, reason: "invalid_payload" };
  }

  const existing = await prisma.authUser.findUnique({
    where: { userId: normalizedUserId },
    select: { id: true },
  });
  if (existing) {
    return { ok: false, reason: "already_exists" };
  }

  const resolvedFamilyId = await resolveFamilyIdForRegistration(
    familyMode,
    input.familyId,
    normalizedFamilyName,
  );
  const passwordHash = await hash(password, PASSWORD_HASH_ROUNDS);
  await prisma.authUser.create({
    data: {
      userId: normalizedUserId,
      name: normalizedName,
      role: toDbRole(input.role),
      familyId: resolvedFamilyId,
      passwordHash,
      mustChangePassword: input.mustChangePassword ?? false,
    },
  });
  const policyState = getPolicyState();
  policyState.policies[normalizedUserId] = "free";

  return { ok: true, userId: normalizedUserId, familyId: resolvedFamilyId };
}

export async function getAuthIdentityByUserId(userId: string) {
  await ensureAuthIdentityBootstrap();

  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) return null;

  const identity = await prisma.authUser.findUnique({
    where: { userId: normalizedUserId },
  });
  return mapAuthIdentity(identity);
}

export async function listAuthIdentities(): Promise<AdminDirectoryUser[]> {
  await ensureAuthIdentityBootstrap();

  const identities = await prisma.authUser.findMany({
    select: {
      userId: true,
      name: true,
      role: true,
      familyId: true,
      mustChangePassword: true,
    },
    orderBy: { userId: "asc" },
  });

  return identities.map((identity) => ({
    userId: identity.userId,
    name: identity.name,
    role: toAppRole(identity.role),
    familyId: identity.familyId,
    mustChangePassword: identity.mustChangePassword,
    editPolicy: getCachedAuthEditPolicy(identity.userId),
  }));
}

export async function listAuthFamilies(): Promise<AdminDirectoryFamily[]> {
  await ensureAuthIdentityBootstrap();

  const identities = await prisma.authUser.findMany({
    select: { familyId: true },
    distinct: ["familyId"],
    orderBy: { familyId: "asc" },
  });
  const knownFamilyNames = getFamilyNameState();
  const familyIds = new Set<string>(identities.map((entry) => entry.familyId));
  for (const familyId of Object.keys(knownFamilyNames.names)) {
    familyIds.add(familyId);
  }

  return [...familyIds]
    .sort()
    .map((familyId) => ({
      id: familyId,
      name: knownFamilyNames.names[familyId] || `Family ${familyId}`,
    }));
}

export async function setAuthIdentityFamily(userId: string, familyId: string): Promise<boolean> {
  await ensureAuthIdentityBootstrap();

  const normalizedUserId = normalizeUserId(userId);
  const normalizedFamilyId = normalizeFamilyId(familyId);
  if (!normalizedUserId || !normalizedFamilyId) return false;

  const identity = await prisma.authUser.findUnique({
    where: { userId: normalizedUserId },
    select: { id: true, familyId: true },
  });
  if (!identity) return false;
  if (identity.familyId === normalizedFamilyId) return true;

  await prisma.authUser.update({
    where: { userId: normalizedUserId },
    data: { familyId: normalizedFamilyId },
  });
  return true;
}

export async function createAuthFamily(input: { name: string; preferredFamilyId?: string }): Promise<string | null> {
  await ensureAuthIdentityBootstrap();

  const normalizedName = normalizeFamilyName(input.name);
  if (!normalizedName) return null;
  const preferred = normalizeFamilyId(input.preferredFamilyId ?? "");

  const seedFamilyId =
    preferred && preferred.length > 0
      ? preferred
      : createFamilyIdFromName(normalizedName);
  const identities = await getAllFamilyIds();
  const familyNameState = getFamilyNameState();
  const familyIds = new Set<string>([...identities, ...Object.keys(familyNameState.names)]);

  let familyId = seedFamilyId;
  if (familyIds.has(familyId)) {
    let suffix = 2;
    let nextFamilyId = `${familyId}-${suffix}`;
    while (familyIds.has(nextFamilyId)) {
      suffix += 1;
      nextFamilyId = `${familyId}-${suffix}`;
    }
    familyId = nextFamilyId;
  }

  familyNameState.names[familyId] = normalizedName;
  return familyId;
}

export async function setAuthFamilyName(familyId: string, familyName: string): Promise<boolean> {
  await ensureAuthIdentityBootstrap();

  const normalizedFamilyId = normalizeFamilyId(familyId);
  const normalizedFamilyName = normalizeFamilyName(familyName);
  if (!normalizedFamilyId || !normalizedFamilyName) return false;

  const membership = await prisma.authUser.findFirst({
    where: { familyId: normalizedFamilyId },
    select: { id: true },
  });
  if (!membership && getKnownFamilyName(normalizedFamilyId) === null) {
    return false;
  }

  return setKnownFamilyName(normalizedFamilyId, normalizedFamilyName);
}

export async function setAuthIdentityTemporaryPassword(input: UpdateAdminPasswordInput): Promise<boolean> {
  await ensureAuthIdentityBootstrap();

  const normalizedUserId = normalizeUserId(input.userId);
  const temporaryPassword = input.temporaryPassword.trim();
  if (!normalizedUserId || !temporaryPassword) {
    return false;
  }

  const identity = await prisma.authUser.findUnique({
    where: { userId: normalizedUserId },
    select: { id: true },
  });
  if (!identity) return false;

  const passwordHash = await hash(temporaryPassword, PASSWORD_HASH_ROUNDS);
  await prisma.authUser.update({
    where: { userId: normalizedUserId },
    data: { passwordHash, mustChangePassword: true },
  });
  return true;
}

export async function deleteAuthIdentity(userId: string): Promise<boolean> {
  await ensureAuthIdentityBootstrap();
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) return false;

  const identity = await prisma.authUser.findUnique({
    where: { userId: normalizedUserId },
    select: { id: true },
  });
  if (!identity) return false;

  await prisma.authUser.delete({ where: { userId: normalizedUserId } });
  const policyState = getPolicyState();
  delete policyState.policies[normalizedUserId];
  return true;
}

export async function getAuthIdentitySnapshot(userId: string) {
  return getAuthIdentityByUserId(userId);
}

export async function setPasswordChangeRequired(
  userId: string,
  mustChangePassword: boolean,
): Promise<boolean> {
  await ensureAuthIdentityBootstrap();

  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) return false;

  const identity = await prisma.authUser.findUnique({
    where: { userId: normalizedUserId },
    select: { id: true },
  });
  if (!identity) return false;

  await prisma.authUser.update({
    where: { userId: normalizedUserId },
    data: { mustChangePassword },
  });
  return true;
}

export async function updateAuthIdentityName(input: UpdateAuthIdentityNameInput) {
  await ensureAuthIdentityBootstrap();

  const normalizedUserId = normalizeUserId(input.userId);
  const name = input.name.trim();
  if (!normalizedUserId || !name) return false;

  const identity = await prisma.authUser.findUnique({
    where: { userId: normalizedUserId },
    select: { id: true },
  });
  if (!identity) return false;

  await prisma.authUser.update({
    where: { userId: normalizedUserId },
    data: { name },
  });
  return true;
}

export async function updateAuthIdentityPassword(
  input: UpdateAuthIdentityPasswordInput,
): Promise<UpdateAuthIdentityPasswordResult> {
  await ensureAuthIdentityBootstrap();

  const normalizedUserId = normalizeUserId(input.userId);
  if (!normalizedUserId || !input.currentPassword || !input.nextPassword) {
    return { ok: false, reason: "invalid_payload" };
  }

  const identity = await prisma.authUser.findUnique({
    where: { userId: normalizedUserId },
  });
  if (!identity) return { ok: false, reason: "not_found" };

  const isValidPassword = await compare(input.currentPassword, identity.passwordHash);
  if (!isValidPassword) {
    return { ok: false, reason: "invalid_password" };
  }

  const passwordHash = await hash(input.nextPassword, PASSWORD_HASH_ROUNDS);
  await prisma.authUser.update({
    where: { userId: normalizedUserId },
    data: { passwordHash, mustChangePassword: false },
  });
  return { ok: true };
}

export async function getAuthEditPolicyForUser(userId: string) {
  await ensureAuthIdentityBootstrap();
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) return null;

  const identity = await prisma.authUser.findUnique({
    where: { userId: normalizedUserId },
    select: { id: true },
  });
  if (!identity) return null;
  return getCachedAuthEditPolicy(normalizedUserId);
}

export async function setAuthEditPolicyForUser(
  userId: string,
  editPolicy: ChildEditPolicy,
) {
  await ensureAuthIdentityBootstrap();
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId || !isChildEditPolicy(editPolicy)) return false;

  const identity = await prisma.authUser.findUnique({
    where: { userId: normalizedUserId },
    select: { id: true },
  });
  if (!identity) return false;

  const policyState = getPolicyState();
  policyState.policies[normalizedUserId] = editPolicy;
  return true;
}

export async function verifyAuthIdentityCredentials(userId: string, password: string) {
  await ensureAuthIdentityBootstrap();

  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId || !password) return null;

  const identity = await prisma.authUser.findUnique({
    where: { userId: normalizedUserId },
  });
  if (!identity) return null;

  const isValid = await compare(password, identity.passwordHash);
  if (!isValid) return null;

  return mapAuthIdentity(identity);
}
