"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useRealAuth } from "@/lib/auth/authGateway";
import {
  type UserRole,
  useAuthAndFamilyStore,
} from "@/stores/authAndFamilyStore";

type DirectoryFamily = {
  id: string;
  name: string;
};

type DirectoryUser = {
  userId: string;
  name: string;
  role: UserRole;
  familyId: string;
  editPolicy: "free" | "approval_required" | "no_edit";
  mustChangePassword: boolean;
};

type DirectoryPayload = {
  ok: true;
  users: DirectoryUser[];
  families: DirectoryFamily[];
};

function normalizeRole(candidate: string): UserRole | null {
  return candidate === "adult" || candidate === "child" ? candidate : null;
}

export default function AdminUsersPage() {
  const {
    users,
    families,
    memberships,
    currentUserId,
    setUserRole,
    moveUserToFamily,
    setAdminDirectory,
    deleteUser,
  } = useAuthAndFamilyStore();
  const [isLoadingDirectory, setIsLoadingDirectory] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [mustChangeByUserId, setMustChangeByUserId] = useState<Record<string, boolean>>({});

  function setActionMessage(message: string) {
    setErrorMessage(message);
  }

  const syncDirectory = useCallback(async () => {
    if (!useRealAuth) return;
    setIsLoadingDirectory(true);
    try {
      const response = await fetch("/api/admin/directory");
      if (!response.ok) {
        setErrorMessage("Unable to load admin directory.");
        return;
      }

      const payload = (await response.json().catch(() => null)) as DirectoryPayload | null;
      if (!payload || payload.ok !== true || !Array.isArray(payload.users) || !Array.isArray(payload.families)) {
        setErrorMessage("Unable to load admin directory.");
        return;
      }

      setErrorMessage("");
      setMustChangeByUserId(
        Object.fromEntries(payload.users.map((entry) => [entry.userId, entry.mustChangePassword])),
      );
      setAdminDirectory({
        users: payload.users.map((entry) => ({
          id: entry.userId,
          name: entry.name,
          role: entry.role,
        })),
        families: payload.families.map((entry) => ({
          id: entry.id,
          name: entry.name,
          memberIds: [],
        })),
        memberships: payload.users.map((entry) => ({
          userId: entry.userId,
          familyId: entry.familyId,
          ...(entry.editPolicy ? { editPolicy: entry.editPolicy } : {}),
        })),
      });
    } catch {
      setErrorMessage("Unable to load admin directory.");
    } finally {
      setIsLoadingDirectory(false);
    }
  }, [setAdminDirectory]);

  useEffect(() => {
    void syncDirectory();
  }, [syncDirectory]);

  useEffect(() => {
    if (!useRealAuth || users.length > 0) {
      return;
    }
    void syncDirectory();
  }, [syncDirectory, useRealAuth, users.length]);

  async function handleRoleChange(userId: string, rawRole: string) {
    const role = normalizeRole(rawRole);
    if (!role || !currentUserId) return;

    const row = rows.find((entry) => entry.userId === userId);
    if (!row || row.role === role) return;

    if (!window.confirm(`Change ${row.name} (${userId}) role to ${role}?`)) return;
    setUserRole(userId, role, currentUserId);
  }

  async function handleFamilyChange(userId: string, familyId: string) {
    if (!familyId || !currentUserId) return;
    const row = rows.find((entry) => entry.userId === userId);
    if (!row || row.familyId === familyId) return;

    const targetFamilyName = families.find((family) => family.id === familyId)?.name ?? familyId;
    if (!window.confirm(`Move ${row.name} (${userId}) to ${targetFamilyName}?`)) return;
    moveUserToFamily(userId, familyId, currentUserId);
  }

  async function handleForceReset(userId: string, name: string) {
    if (!currentUserId) return;
    if (!useRealAuth) {
      setActionMessage("Password reset is only available while real auth is enabled.");
      return;
    }
    if (userId === currentUserId) {
      setActionMessage("You cannot force a password reset for your own account.");
      return;
    }
    const temporaryPassword = window.prompt(
      `Set an optional temporary password for ${name} (${userId}).\n` +
        "Leave blank to force password change on next login without a temporary password.",
      "",
    );
    if (temporaryPassword === null) return;

    const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        temporaryPassword: temporaryPassword.trim().length > 0 ? temporaryPassword : "",
      }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string };
      setActionMessage(payload?.error ? `Unable to reset password: ${payload.error}` : "Unable to force a password reset for that user.");
      return;
    }
    setActionMessage("Password reset requirements were updated.");
    await syncDirectory();
  }

  async function handleDeleteUser(userId: string, name: string) {
    if (!currentUserId) return;
    if (userId === currentUserId) {
      setActionMessage("You cannot delete your own account.");
      return;
    }
    if (!window.confirm(`Delete user ${name} (${userId})? This action cannot be undone.`)) return;

    if (useRealAuth) {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string };
        setActionMessage(payload?.error ? `Unable to delete user: ${payload.error}` : "Unable to delete user.");
        return;
      }
      setActionMessage(`Deleted ${name} from admin directory.`);
      await syncDirectory();
      return;
    }

    const deleted = deleteUser(userId);
    if (!deleted) {
      setActionMessage("Unable to delete user.");
    } else {
      setActionMessage(`Deleted ${name} from local demo directory.`);
    }
  }

  const familyIds = families.map((family) => family.id);

  const rows = useMemo(() => {
    return users.map((user) => {
      const membership = memberships.find((entry) => entry.userId === user.id);
      const family = families.find((item) => item.id === membership?.familyId);
      return {
        userId: user.id,
        name: user.name,
        role: user.role,
        familyId: membership?.familyId ?? "",
        familyName: family?.name ?? membership?.familyId ?? "Unassigned",
        policy: membership?.editPolicy ?? "n/a",
        mustChangePassword: mustChangeByUserId[user.id] ?? false,
      };
    });
  }, [families, memberships, users, mustChangeByUserId]);

  const displayError = errorMessage.length > 0 ? errorMessage : "";

  const shouldShowLoading = isLoadingDirectory && users.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">Users directory</h2>
        <Link href="/admin" className="text-sm text-emerald-300 hover:text-emerald-200">
          Back to dashboard
        </Link>
      </div>
      {displayError.length > 0 ? (
        <p className="rounded border border-rose-500/50 bg-rose-500/10 p-2 text-xs text-rose-200">
          {displayError}
        </p>
      ) : null}
      {shouldShowLoading ? (
        <p className="rounded border border-slate-700 bg-slate-900 p-2 text-xs text-slate-400">
          Loading directory from admin source...
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs text-slate-400">
              <th className="border-b border-slate-700 pb-2 pr-3">User ID</th>
              <th className="border-b border-slate-700 pb-2 pr-3">Name</th>
              <th className="border-b border-slate-700 pb-2 pr-3">Role</th>
              <th className="border-b border-slate-700 pb-2 pr-3">Family</th>
              <th className="border-b border-slate-700 pb-2 pr-3">Child policy</th>
              <th className="border-b border-slate-700 pb-2 pr-3">Password reset required</th>
              <th className="border-b border-slate-700 pb-2 pr-3">Admin actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="py-2 text-slate-500" colSpan={7}>
                  No users found.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
              <tr key={row.userId}>
                  <td className="border-b border-slate-800 py-2 pr-3 text-slate-200">{row.userId}</td>
                  <td className="border-b border-slate-800 py-2 pr-3 text-slate-200">{row.name}</td>
                <td className="border-b border-slate-800 py-2 pr-3 text-slate-200">
                  <select
                    value={row.role}
                    onChange={(event) => handleRoleChange(row.userId, event.target.value)}
                    className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                    disabled={!currentUserId}
                  >
                    <option value="adult">adult</option>
                    <option value="child">child</option>
                  </select>
                </td>
                <td className="border-b border-slate-800 py-2 pr-3 text-slate-200">
                  <select
                    value={row.familyId || ""}
                    onChange={(event) => handleFamilyChange(row.userId, event.target.value)}
                    className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                    disabled={!currentUserId}
                  >
                    <option value="">Unassigned</option>
                    {familyIds.map((familyId) => {
                      return (
                        <option key={familyId} value={familyId}>
                          {families.find((family) => family.id === familyId)?.name ?? familyId}
                        </option>
                      );
                    })}
                  </select>
                </td>
                  <td className="border-b border-slate-800 py-2 pr-3 text-slate-200">{row.policy}</td>
                  <td className="border-b border-slate-800 py-2 pr-3 text-slate-200">
                    {row.mustChangePassword ? "Yes" : "No"}
                  </td>
                  <td className="border-b border-slate-800 py-2 pr-3 text-slate-200">
                    <button
                      type="button"
                      className="mr-2 rounded-full border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
                      onClick={() => void handleForceReset(row.userId, row.name)}
                      disabled={!currentUserId}
                    >
                      Force reset password
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-rose-500 px-2 py-1 text-xs text-rose-200 hover:bg-rose-500/20"
                      onClick={() => void handleDeleteUser(row.userId, row.name)}
                      disabled={!currentUserId || row.userId === currentUserId}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
