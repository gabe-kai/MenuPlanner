"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuthAndFamilyStore } from "@/stores/authAndFamilyStore";
import {
  useSchoolLunchStore,
  type SchoolLunchChoice,
  type SchoolLunchDay,
  type SchoolLunchPlan,
} from "@/stores/schoolLunchStore";
import { getSessionActor } from "@/lib/auth/actors";

function PlanSection({
  plan,
  actorUserId,
  onApproveDay,
  onApproveAll,
  onRejectDay,
  onChangeChoice,
  onRejectNoteChange,
}: {
  plan: SchoolLunchPlan;
  actorUserId: string;
  onApproveDay: (planId: string, day: SchoolLunchDay, note?: string) => void;
  onApproveAll: (planId: string) => void;
  onRejectDay: (planId: string, day: SchoolLunchDay, note: string) => void;
  onChangeChoice: (
    planId: string,
    day: SchoolLunchDay,
    choice: SchoolLunchChoice,
  ) => void;
  onRejectNoteChange: (planId: string, day: SchoolLunchDay, note: string) => void;
}) {
  return (
    <section className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">
            Week {plan.weekKey}
          </h3>
          <p className="text-[11px] text-slate-400">Plan status: {plan.status}</p>
        </div>
        <button
          type="button"
          onClick={() => onApproveAll(plan.id)}
          className="rounded-full border border-emerald-500/60 bg-emerald-500/10 px-3 py-1 text-[10px] text-emerald-200 hover:bg-emerald-500/20"
        >
          Approve all
        </button>
      </div>
      <div className="grid gap-2 md:grid-cols-5">
        {plan.days.map((day) => (
          <div
            key={day.dateKey}
            className="flex flex-col rounded-lg border border-slate-800 bg-slate-950/60 p-2"
          >
            <div className="mb-1 text-[11px] font-semibold text-slate-200">
              {day.dateKey}
            </div>
            <select
              value={day.pendingChoice ?? day.choice}
              onChange={(event) =>
                onChangeChoice(
                  plan.id,
                  day,
                  event.target.value as SchoolLunchChoice,
                )
              }
              className="mb-2 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100 focus:border-emerald-500 focus:outline-none"
            >
              <option value="home">Home Lunch</option>
              <option value="school">School Hot Lunch</option>
            </select>
            {day.pendingChoice ? (
              <div className="mb-1 text-[10px]">
                <p className="text-slate-400 line-through">Current: {day.choice}</p>
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
            <textarea
              onChange={(event) =>
                onRejectNoteChange(plan.id, day, event.target.value)
              }
              placeholder="Comment for reject..."
              className="mt-2 rounded-md border border-slate-700 bg-slate-900 p-1 text-[10px] text-slate-100 focus:border-emerald-500 focus:outline-none"
            />
            <div className="mt-2 flex gap-1">
              <button
                type="button"
                onClick={() => onApproveDay(plan.id, day, "Approved")}
                className="mt-auto rounded-full bg-emerald-500 px-2 py-1 text-[10px] font-semibold text-slate-950 hover:bg-emerald-400"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() =>
                  onRejectDay(plan.id, day, "Please revise this day")
                }
                className="mt-auto rounded-full bg-amber-500 px-2 py-1 text-[10px] font-semibold text-slate-900 hover:bg-amber-400"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-slate-500">Actor: {actorUserId}</p>
    </section>
  );
}

export default function AdultSchoolLunchPage() {
  const { users, memberships, currentUserId, currentFamilyId, isAuthenticated } =
    useAuthAndFamilyStore();
  const { plans, setDayChoice, approveDay, rejectDay, approveAllDays } =
    useSchoolLunchStore();
  const actor = useMemo(
    () => getSessionActor(),
    [users, currentUserId, currentFamilyId, isAuthenticated],
  );
  const [expandedChildId, setExpandedChildId] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!expandedChildId) {
      const firstChild = users.find((user) => user.role === "child");
      if (firstChild) setExpandedChildId(firstChild.id);
    }
  }, [expandedChildId, users]);

  if (!isAuthenticated || !actor || !actor.isAdult) {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">
          School Lunch – Adult View
        </h2>
        <p className="text-sm text-slate-400">
          Please <Link href="/login">sign in as an adult</Link> to review
          children&apos; school lunch plans.
        </p>
      </div>
    );
  }

  const children = users.filter((u) => u.role === "child");
  const plansByChild = children.map((child) => ({
    child,
    plan: plans.find((p) => p.childId === child.id),
  }));
  const actorUserId = actor.userId;

  return (
    <div className="space-y-4">
      <section>
        <h2 className="text-lg font-semibold tracking-tight">
          School Lunch – Adult View
        </h2>
        <p className="text-sm text-slate-400">
          Review and approve children&apos; School Lunch plans for this week.
        </p>
      </section>

      <section className="space-y-3">
        {plansByChild.map(({ child, plan }) => {
          const childPolicy =
            memberships.find((membership) => membership.userId === child.id)
              ?.editPolicy ?? "free";

          return (
            <div
              key={child.id}
              className="space-y-2 rounded-xl border border-slate-800 bg-slate-900/70 p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold tracking-tight">
                    {child.name}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {plan ? `Week ${plan.weekKey}` : "No plan for this week"} ·
                    Policy: {childPolicy}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setExpandedChildId((prev) =>
                      prev === child.id ? null : child.id,
                    )
                  }
                  className="rounded-full border border-slate-700 px-3 py-1.5 text-[11px] font-medium text-slate-200 hover:bg-slate-800"
                >
                  {expandedChildId === child.id ? "Hide" : "Show"} details
                </button>
              </div>
              {plan && expandedChildId === child.id && (
                <PlanSection
                  plan={plan}
                  actorUserId={actorUserId}
                  onApproveDay={(planId, day, note) =>
                    approveDay(planId, day.dateKey, actorUserId, note)
                  }
                  onApproveAll={(planId) => approveAllDays(planId, actorUserId)}
                  onRejectDay={(planId, day, note) =>
                    rejectDay(
                      planId,
                      day.dateKey,
                      actorUserId,
                      rejectNotes[`${planId}-${day.dateKey}`] ?? note ?? "Needs revision",
                    )
                  }
                  onChangeChoice={(planId, day, choice) =>
                    setDayChoice(planId, day.dateKey, choice, actorUserId)
                  }
                  onRejectNoteChange={(planId, day, value) => {
                    const key = `${planId}-${day.dateKey}`;
                    setRejectNotes((state) => ({ ...state, [key]: value }));
                  }}
                />
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
