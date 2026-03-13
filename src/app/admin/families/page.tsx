"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useRealAuth } from "@/lib/auth/authGateway";
import { useAuthAndFamilyStore } from "@/stores/authAndFamilyStore";

type DirectoryFamily = {
  id: string;
  name: string;
};

type DirectoryUser = {
  userId: string;
  name: string;
  familyId: string;
  editPolicy?: "free" | "approval_required" | "no_edit";
  role?: "adult" | "child";
};

type DirectoryPayload = {
  ok: true;
  users: DirectoryUser[];
  families: DirectoryFamily[];
};

export default function AdminFamiliesPage() {
  const {
    families,
    memberships,
    users,
    currentUserId,
    renameFamily,
    createFamily,
    deleteFamily,
    moveUserToFamily,
    setAdminDirectory,
  } = useAuthAndFamilyStore();
  const [isLoadingDirectory, setIsLoadingDirectory] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

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

      setAdminDirectory({
        users: payload.users.map((entry) => ({
          id: entry.userId,
          name: entry.name,
          role: entry.role ?? "adult",
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
      setErrorMessage("");
    } catch {
      setErrorMessage("Unable to load admin directory.");
    } finally {
      setIsLoadingDirectory(false);
    }
  }, [setAdminDirectory]);

  useEffect(() => {
    void syncDirectory();
  }, [syncDirectory]);

  const rows = useMemo(() => {
    return families.map((family) => {
      const memberIds = memberships
        .filter((entry) => entry.familyId === family.id)
        .map((entry) => entry.userId);
      const memberNames = memberIds
        .map((memberId) => users.find((user) => user.id === memberId)?.name ?? memberId)
        .sort();

      return {
        familyId: family.id,
        familyName: family.name,
        members: memberNames.join(", ") || "No members",
        memberCount: memberIds.length,
      };
    });
  }, [families, memberships, users]);

  async function handleRenameFamily(familyId: string, currentName: string) {
    if (!currentUserId) return;
    const nextName = window.prompt("Rename family", currentName);
    if (!nextName) return;
    const normalized = nextName.trim();
    if (!normalized || normalized === currentName) return;
    if (!window.confirm(`Rename ${familyId} to ${normalized}?`)) return;

    if (useRealAuth) {
      const response = await fetch(`/api/admin/families/${encodeURIComponent(familyId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: normalized }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string };
        setActionMessage(payload?.error ? `Unable to rename family: ${payload.error}` : "Unable to rename that family.");
        return;
      }
      setActionMessage(`Renamed ${currentName} to ${normalized}.`);
      await syncDirectory();
      return;
    }

    renameFamily(familyId, normalized, currentUserId);
  }

  async function handleCreateFamily() {
    if (!currentUserId) return;
    const nextName = window.prompt("New family name");
    if (!nextName) return;
    const normalized = nextName.trim();
    if (!normalized) return;
    if (useRealAuth) {
      const response = await fetch("/api/admin/families", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: normalized }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string };
        setActionMessage(payload?.error ? `Unable to create family: ${payload.error}` : "Unable to create that family.");
        return;
      }
      setActionMessage(`Created family ${normalized}.`);
      await syncDirectory();
      return;
    }

    createFamily(normalized, currentUserId);
  }

  function handleDeleteFamily(familyId: string, familyName: string, hasMembers: boolean) {
    if (!currentUserId) return;
    if (hasMembers) {
      setActionMessage(
        `Family ${familyName} cannot be deleted while users are still assigned. Move users first.`,
      );
      return;
    }
    if (!window.confirm(`Delete ${familyName}?`)) return;
    deleteFamily(familyId, currentUserId);
  }

  async function handleBootstrapAdminFamily() {
    if (!currentUserId) return;
    const familyName = window.prompt("Create a dedicated admin family", "Admin Family");
    if (!familyName) return;
    const normalized = familyName.trim();
    if (!normalized) return;

    let newFamilyId: string | null;
    if (useRealAuth) {
      const response = await fetch("/api/admin/families", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: normalized }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string };
        setActionMessage(payload?.error ? `Unable to create family: ${payload.error}` : "Unable to create that family.");
        return;
      }
      const payload = (await response.json().catch(() => null)) as { familyId?: string } | null;
      newFamilyId = payload?.familyId ?? null;
      if (!newFamilyId) {
        setActionMessage("Unable to create that family.");
        return;
      }
    } else {
      newFamilyId = createFamily(normalized, currentUserId);
    }
    if (!newFamilyId) return;
    const currentMember = memberships.find((entry) => entry.userId === currentUserId);
    const currentFamilyId = currentMember?.familyId;
    if (currentFamilyId && currentFamilyId !== newFamilyId) {
      if (useRealAuth) {
        const response = await fetch(`/api/admin/users/${encodeURIComponent(currentUserId)}/family`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ familyId: newFamilyId }),
        });
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string };
          setActionMessage(payload?.error ? `Unable to move admin account: ${payload.error}` : "Unable to move admin account to the new family.");
          return;
        }
      } else {
        moveUserToFamily(currentUserId, newFamilyId, currentUserId);
      }
    }

    if (useRealAuth) {
      await syncDirectory();
    }
  }

  async function handleSeedFirstUsersFromFamilyOne() {
    if (!currentUserId) return;
    const defaultMembers = memberships.filter((entry) => entry.familyId === "fam-1" && entry.userId !== currentUserId);
    if (defaultMembers.length === 0) {
      setActionMessage("No other fam-1 users to seed.");
      return;
    }
    const nextFamilyName = window.prompt("Create a first-user family name", "Starter Family");
    if (!nextFamilyName) return;
    const normalized = nextFamilyName.trim();
    if (!normalized) return;

    let newFamilyId: string | null;
    if (useRealAuth) {
      const response = await fetch("/api/admin/families", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: normalized }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string };
        setActionMessage(payload?.error ? `Unable to create family: ${payload.error}` : "Unable to create that family.");
        return;
      }
      const payload = (await response.json().catch(() => null)) as { familyId?: string } | null;
      newFamilyId = payload?.familyId ?? null;
      if (!newFamilyId) {
        setActionMessage("Unable to create that family.");
        return;
      }
    } else {
      newFamilyId = createFamily(normalized, currentUserId);
    }
    if (!newFamilyId) return;

    if (useRealAuth) {
      for (const member of defaultMembers) {
        const response = await fetch(`/api/admin/users/${encodeURIComponent(member.userId)}/family`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ familyId: newFamilyId }),
        });
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string };
          setActionMessage(
            payload?.error
              ? `Unable to move ${member.userId}: ${payload.error}`
              : `Unable to move ${member.userId}.`,
          );
          return;
        }
      }
      setActionMessage(`Moved ${defaultMembers.length} users from fam-1.`);
      await syncDirectory();
      return;
    }

    for (const member of defaultMembers) {
      moveUserToFamily(member.userId, newFamilyId, currentUserId);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">Families directory</h2>
        <Link href="/admin" className="text-sm text-emerald-300 hover:text-emerald-200">
          Back to dashboard
        </Link>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-full border border-emerald-500 px-3 py-1 text-xs text-emerald-200 hover:bg-emerald-500/20"
          onClick={handleCreateFamily}
          disabled={!currentUserId}
        >
          Create family
        </button>
        <button
          type="button"
          className="rounded-full border border-emerald-500 px-3 py-1 text-xs text-emerald-200 hover:bg-emerald-500/20"
          onClick={handleBootstrapAdminFamily}
          disabled={!currentUserId}
        >
          Create admin family
        </button>
        <button
          type="button"
          className="rounded-full border border-emerald-500 px-3 py-1 text-xs text-emerald-200 hover:bg-emerald-500/20"
          onClick={handleSeedFirstUsersFromFamilyOne}
          disabled={!currentUserId}
        >
          Move first users from fam-1
        </button>
      </div>
      {errorMessage.length > 0 ? (
        <p className="rounded border border-rose-500/50 bg-rose-500/10 p-2 text-xs text-rose-200">
          {errorMessage}
        </p>
      ) : null}
      {isLoadingDirectory && families.length === 0 ? (
        <p className="rounded border border-slate-700 bg-slate-900 p-2 text-xs text-slate-400">
          Loading directory from admin source...
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs text-slate-400">
              <th className="border-b border-slate-700 pb-2 pr-3">Family ID</th>
              <th className="border-b border-slate-700 pb-2 pr-3">Name</th>
              <th className="border-b border-slate-700 pb-2 pr-3">Members</th>
              <th className="border-b border-slate-700 pb-2 pr-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="py-2 text-slate-500" colSpan={4}>
                  No families found.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.familyId}>
                  <td className="border-b border-slate-800 py-2 pr-3 text-slate-200">{row.familyId}</td>
                  <td className="border-b border-slate-800 py-2 pr-3 text-slate-200">{row.familyName}</td>
                  <td className="border-b border-slate-800 py-2 pr-3 text-slate-200">{row.members}</td>
                  <td className="border-b border-slate-800 py-2 pr-3 text-slate-200">
                    <button
                      type="button"
                      className="rounded-full border border-emerald-500 px-2 py-1 text-xs text-emerald-200 hover:bg-emerald-500/20"
                      onClick={() => handleRenameFamily(row.familyId, row.familyName)}
                      disabled={!currentUserId}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className="ml-2 rounded-full border border-rose-500 px-2 py-1 text-xs text-rose-200 hover:bg-rose-500/20"
                      onClick={() => handleDeleteFamily(row.familyId, row.familyName, row.memberCount > 0)}
                      disabled={!currentUserId || row.memberCount > 0}
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
