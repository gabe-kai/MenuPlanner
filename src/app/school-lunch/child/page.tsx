"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuthAndFamilyStore } from "@/stores/authAndFamilyStore";
import {
  useSchoolLunchStore,
  type SchoolLunchChoice,
  type SchoolLunchDay,
} from "@/stores/schoolLunchStore";
import { getSessionActor } from "@/lib/auth/actors";

export default function ChildSchoolLunchPage() {
  const { users, memberships, currentUserId, currentFamilyId, isAuthenticated } =
    useAuthAndFamilyStore();
  const { plans, setDayChoice, submitPlan } = useSchoolLunchStore();
  const actor = useMemo(
    () => getSessionActor(),
    [users, currentUserId, currentFamilyId, isAuthenticated],
  );

  const children = useMemo(
    () => users.filter((u) => u.role === "child"),
    [users],
  );

  const [selectedChildId, setSelectedChildId] = useState<string>(() => {
    if (actor?.isAdult) {
      return children[0]?.id ?? "";
    }
    return actor?.user.id ?? "";
  });

  useEffect(() => {
    if (actor?.isAdult) {
      if (!children.some((child) => child.id === selectedChildId)) {
        setSelectedChildId(children[0]?.id ?? "");
      }
    } else if (actor?.user.id) {
      setSelectedChildId(actor.user.id);
    } else if (!selectedChildId) {
      setSelectedChildId(children[0]?.id ?? "");
    }
  }, [actor?.isAdult, actor?.user.id, children, selectedChildId]);

  const selectedChild = children.find((child) => child.id === selectedChildId);
  const selectedChildPolicy =
    memberships.find((membership) => membership.userId === selectedChildId)
      ?.editPolicy ?? "free";
  const canEdit = actor?.isAdult || selectedChildPolicy !== "no_edit";
  const needsReview = actor?.isAdult
    ? false
    : selectedChildPolicy === "approval_required";

  const plan = plans.find((p) => p.childId === selectedChildId);

  if (!isAuthenticated || !actor) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">
          School Lunch requires sign-in
        </h2>
        <p className="text-sm text-slate-400">
          Please <Link href="/login">sign in</Link> to view or edit a school lunch
          plan.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            School Lunch – Child View
          </h2>
          <p className="text-sm text-slate-400">
            Pick School Lunch or Home Lunch for each school day this week.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <label className="text-slate-400">Child</label>
          <select
            value={selectedChildId}
            onChange={(event) => setSelectedChildId(event.target.value)}
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100 focus:border-emerald-500 focus:outline-none"
          >
            {children.map((child) => (
              <option key={child.id} value={child.id}>
                {child.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      {!canEdit ? (
        <p className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          This child is in <span className="font-semibold">no-edit</span> mode, so
          school lunch entries cannot be edited from here.
        </p>
      ) : null}

      {plan ? (
        <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-200">
              Week {plan.weekKey}
            </span>
            <span className="rounded-full border border-slate-700 px-2 py-1 text-[10px] uppercase tracking-wide text-slate-300">
              Status: {plan.status}
            </span>
          </div>
          <div className="grid gap-2 md:grid-cols-5">
            {plan.days.map((day: SchoolLunchDay) => (
              <div
                key={day.dateKey}
                className="rounded-lg border border-slate-800 bg-slate-950/60 p-2"
              >
                <div className="mb-1 text-[11px] font-semibold text-slate-200">
                  {day.dateKey}
                </div>
                <select
                  value={day.pendingChoice ?? day.choice}
                  disabled={!canEdit}
                  onChange={(event) =>
                    setDayChoice(
                      plan.id,
                      day.dateKey,
                      event.target.value as SchoolLunchChoice,
                      actor.user.id,
                    )
                  }
                  className="mb-2 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100 focus:border-emerald-500 focus:outline-none disabled:opacity-50"
                >
                  <option value="home">Home Lunch</option>
                  <option value="school">School Hot Lunch</option>
                </select>
                {day.pendingChoice ? (
                  <div className="mb-1 text-[10px]">
                    <p className="text-slate-400 line-through">
                      Current: {day.choice}
                    </p>
                    <p className="font-semibold italic text-emerald-300 underline">
                      Proposed: {day.pendingChoice}
                    </p>
                  </div>
                ) : null}
                {day.approved !== undefined && (
                  <div
                    className={`text-[10px] ${
                      day.approved ? "text-emerald-300" : "text-amber-300"
                    }`}
                  >
                    {day.approved ? "Approved" : "Changes requested"}
                  </div>
                )}
                {day.approvalNote && (
                  <div className="mt-1 text-[10px] text-slate-400">
                    Note: {day.approvalNote}
                  </div>
                )}
                {needsReview && (
                  <div className="mt-1 text-[10px] text-slate-400">
                    This child is policy-gated to approval-required edits.
                  </div>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => submitPlan(plan.id, actor.user.id)}
            disabled={!canEdit}
            className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:bg-slate-600 disabled:text-slate-300"
          >
            Submit week for review
          </button>
        </section>
      ) : (
        <p className="text-sm text-slate-400">
          {selectedChild ? `No School Lunch plan for ${selectedChild.name} yet.` : "No child selected."}
        </p>
      )}
    </div>
  );
}
