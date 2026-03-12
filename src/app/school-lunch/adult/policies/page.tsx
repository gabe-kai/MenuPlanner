"use client";

import { useMemo, useState } from "react";

import { getSessionActor } from "@/lib/auth/actors";
import { log } from "@/lib/log";
import { useAuthAndFamilyStore } from "@/stores/authAndFamilyStore";

type ChildEditPolicy = "free" | "approval_required" | "no_edit";

type ChildRecord = {
  id: string;
  name: string;
  policy: ChildEditPolicy;
};

function buildChildRows(
  users: Array<{ id: string; name: string; role: "adult" | "child" }>,
  memberships: Array<{ userId: string; familyId: string; editPolicy?: ChildEditPolicy }>,
  familyId: string,
): ChildRecord[] {
  return users
    .filter((user) => user.role === "child")
    .map((user) => ({
      id: user.id,
      name: user.name,
      policy:
        memberships.find(
          (membership) => membership.userId === user.id && membership.familyId === familyId,
        )?.editPolicy ?? "free",
    }))
    .filter((child) =>
      familyId ? memberships.some((membership) => membership.userId === child.id && membership.familyId === familyId) : true,
    );
}

export default function PolicyManagementPage() {
  const { users, memberships, currentUserId, currentFamilyId, isAuthenticated } =
    useAuthAndFamilyStore();
  const actor = useMemo(
    () => getSessionActor(),
    [users, currentUserId, currentFamilyId, isAuthenticated],
  );

  const familyId = actor?.familyId ?? "";
  const children = useMemo(
    () => buildChildRows(users, memberships, familyId),
    [users, memberships, familyId],
  );

  const [selectedPolicyByUser, setSelectedPolicyByUser] = useState<Record<string, ChildEditPolicy>>({});
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [isUpdatingByUser, setIsUpdatingByUser] = useState<Record<string, boolean>>({});

  const statusMessage = messages["__global__"] ?? "";

  const setRowBusy = (userId: string, isBusy: boolean) => {
    setIsUpdatingByUser((previous) => ({ ...previous, [userId]: isBusy }));
  };

  if (!isAuthenticated || !actor || !actor.isAdult) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Policy management</h2>
        <p className="text-sm text-slate-400">Sign in as an adult to manage family policies.</p>
      </div>
    );
  }

  const updatePolicy = async (childId: string) => {
    setRowBusy(childId, true);
    setMessages((previous) => ({ ...previous, [childId]: "" }));

    const targetPolicy =
      selectedPolicyByUser[childId] ??
      children.find((child) => child.id === childId)?.policy ??
      "free";
    const response = await fetch("/api/auth/policy", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userId: childId,
        editPolicy: targetPolicy,
      }),
    });

    if (!response.ok) {
      const reason = (await response.json().catch(() => ({ error: "unknown_error" }))).error;
      const message = `Failed to update policy: ${reason}`;
      setMessages((previous) => ({ ...previous, [childId]: message }));
      log.warn({ module: "auth", message: "policy.updateFailed", data: { actor: actor.userId, childId, targetPolicy } });
      setRowBusy(childId, false);
      return;
    }

    useAuthAndFamilyStore.getState().setMembershipEditPolicy(
      childId,
      actor.familyId,
      targetPolicy,
    );
    setMessages((previous) => ({
      ...previous,
      [childId]: "Policy updated.",
      __global__: `Policy update applied for ${childId}`,
    }));
    setRowBusy(childId, false);
  };

  return (
    <div className="space-y-4">
      <section className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">Child policy management</h2>
        <p className="text-sm text-slate-400">
          Assign child edit permissions for this family. Policy changes apply to School Lunch behavior.
        </p>
      </section>

      {statusMessage ? (
        <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-2 text-xs text-emerald-200">
          {statusMessage}
        </p>
      ) : null}

      {!children.length ? (
        <p className="text-sm text-slate-400">No children found for this family.</p>
      ) : null}

      {children.map((child) => {
        const selected = selectedPolicyByUser[child.id] ?? child.policy;
        return (
          <div
            key={child.id}
            className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-slate-100">{child.name}</p>
              <p className="text-[11px] text-slate-400">Current: {child.policy}</p>
            </div>
            <label className="block">
              <span className="mb-1 block text-slate-400">Edit policy</span>
              <select
                value={selected}
                onChange={(event) =>
                  setSelectedPolicyByUser((state) => ({
                    ...state,
                    [child.id]: event.target.value as ChildEditPolicy,
                  }))
                }
                className="w-full max-w-xs rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
              >
                <option value="free">Free</option>
                <option value="approval_required">Approval required</option>
                <option value="no_edit">No edit</option>
              </select>
            </label>
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => void updatePolicy(child.id)}
                disabled={isUpdatingByUser[child.id]}
                className="rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 disabled:bg-slate-600"
              >
                {isUpdatingByUser[child.id] ? "Saving..." : "Save policy"}
              </button>
              <p className="text-[11px] text-slate-400">
                {messages[child.id] ?? "Pending change"}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
