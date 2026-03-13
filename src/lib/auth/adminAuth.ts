export type SystemRole = "admin" | "user";

const ADMIN_USER_IDS_ENV = "MENU_ADMIN_USER_IDS";

function normalizeUserId(rawUserId: string) {
  return rawUserId.trim().toLowerCase();
}

function readAdminUserIds() {
  const raw = process.env[ADMIN_USER_IDS_ENV];
  if (!raw) return [];
  return raw
    .split(",")
    .map((value) => normalizeUserId(value))
    .filter((value) => value.length > 0);
}

export function isSystemAdminUser(userId: string | null | undefined): boolean {
  if (!userId) return false;
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) return false;
  return readAdminUserIds().includes(normalizedUserId);
}

export function getSystemRoleForUser(userId: string | null | undefined): SystemRole {
  return isSystemAdminUser(userId) ? "admin" : "user";
}
