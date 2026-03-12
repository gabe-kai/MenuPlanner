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
const DEFAULT_FAMILY_ID = "fam-1";
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
}

export interface RegisterAuthIdentityInput {
  userId: string;
  name: string;
  role: "adult" | "child";
  password: string;
  familyId?: string;
}

export type RegisterAuthIdentityResult =
  | { ok: true; userId: string }
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
  };
}

async function ensureIdentityExists(input: {
  userId: string;
  name: string;
  role: "adult" | "child";
  password: string;
  familyId?: string;
  editPolicy?: ChildEditPolicy;
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

  const passwordHash = await hash(password, PASSWORD_HASH_ROUNDS);
  await prisma.authUser.create({
    data: {
      userId: normalizedUserId,
      name: normalizedName,
      role: toDbRole(input.role),
      familyId: input.familyId?.trim() || DEFAULT_FAMILY_ID,
      passwordHash,
    },
  });
  const policyState = getPolicyState();
  policyState.policies[normalizedUserId] = "free";

  return { ok: true, userId: normalizedUserId };
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

export async function getAuthIdentitySnapshot(userId: string) {
  return getAuthIdentityByUserId(userId);
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
    data: { passwordHash },
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
