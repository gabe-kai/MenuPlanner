import { create } from "zustand";
import { log } from "@/lib/log";
import {
  useAuthAndFamilyStore,
  type ChildEditPolicy,
  type User,
} from "@/stores/authAndFamilyStore";

export type SchoolLunchChoice = "home" | "school";

export interface SchoolLunchDay {
  dateKey: string; // e.g. 2026-03-10
  choice: SchoolLunchChoice;
  pendingChoice?: SchoolLunchChoice;
  approved?: boolean | undefined;
  approvalNote?: string | undefined;
}

export interface SchoolLunchPlan {
  id: string;
  childId: string;
  familyId: string;
  weekKey: string; // e.g. 2026-W11
  days: SchoolLunchDay[];
  status: "draft" | "submitted" | "approved" | "changes_requested";
}

interface SchoolLunchState {
  plans: SchoolLunchPlan[];
  submitPlan: (planId: string, actorUserId: string | null) => void;
  setDayChoice: (
    planId: string,
    dateKey: string,
    choice: SchoolLunchChoice,
    actorUserId: string | null,
  ) => void;
  approveDay: (
    planId: string,
    dateKey: string,
    actorUserId: string | null,
    note?: string,
  ) => void;
  rejectDay: (
    planId: string,
    dateKey: string,
    actorUserId: string | null,
    note?: string,
  ) => void;
  approveAllDays: (planId: string, actorUserId: string | null) => void;
}

function getCurrentWeekKey(): string {
  const now = new Date();
  const oneJan = new Date(now.getFullYear(), 0, 1);
  const numberOfDays = Math.floor(
    (now.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000),
  );
  const week = Math.ceil((now.getDay() + 1 + numberOfDays) / 7);
  return `${now.getFullYear()}-W${week}`;
}

function getChildUsers(): User[] {
  const { users } = useAuthAndFamilyStore.getState();
  return users.filter((u) => u.role === "child");
}

function getFamilyIdForChild(childId: string): string | null {
  const { currentFamilyId, memberships } = useAuthAndFamilyStore.getState();
  const membership = memberships.find((membership) => membership.userId === childId);
  return membership?.familyId ?? currentFamilyId;
}

function getActorPolicy(actorUserId: string | null): ChildEditPolicy {
  if (!actorUserId) return "free";
  const state = useAuthAndFamilyStore.getState();
  const actor = state.users.find((user) => user.id === actorUserId);
  if (!actor || actor.role === "adult") return "free";
  return (
    state.memberships.find((membership) => membership.userId === actorUserId)
      ?.editPolicy ?? "free"
  );
}

function getActorRole(actorUserId: string | null): "adult" | "child" | "none" {
  const state = useAuthAndFamilyStore.getState();
  const actor = actorUserId
    ? state.users.find((user) => user.id === actorUserId)
    : null;
  return actor?.role ?? "none";
}

function createInitialPlans(): SchoolLunchPlan[] {
  const weekKey = getCurrentWeekKey();
  const children = getChildUsers();
  const monday = new Date();
  const day = monday.getDay();
  const diff = (day + 6) % 7;
  monday.setDate(monday.getDate() - diff);

  const days: SchoolLunchDay[] = Array.from({ length: 5 }).map((_, index) => {
    const d = new Date(
      monday.getFullYear(),
      monday.getMonth(),
      monday.getDate() + index,
    );
    const dateKey = d.toISOString().slice(0, 10);
    return {
      dateKey,
      choice: "home",
    };
  });

  return children.map((child) => ({
    id: `plan-${weekKey}-${child.id}`,
    childId: child.id,
    familyId: getFamilyIdForChild(child.id) ?? "fam-1",
    weekKey,
    days: days.map((d) => ({ ...d })),
    status: "draft",
  }));
}

function logPlanEvent(
  actorUserId: string | null,
  action: "submitted" | "approved" | "rejected",
  plan: SchoolLunchPlan | undefined,
  meta: {
    dateKey?: string;
    note?: string;
    choice?: SchoolLunchChoice;
    approvalPolicy?: ChildEditPolicy;
  } = {},
) {
  if (!actorUserId || !plan) return;
  log.info({
    module: "schoolLunch",
    message: `schoolLunch.${action}`,
    data: {
      userId: actorUserId,
      familyId: plan.familyId,
      childId: plan.childId,
      planId: plan.id,
      ...(meta.dateKey ? { dateKey: meta.dateKey } : {}),
      ...(meta.note ? { note: meta.note } : {}),
      ...(meta.choice ? { choice: meta.choice } : {}),
      ...(meta.approvalPolicy ? { approvalPolicy: meta.approvalPolicy } : {}),
    },
  });
}

function stripPendingChoice(day: SchoolLunchDay) {
  const nextDay = { ...day };
  delete nextDay.pendingChoice;
  return nextDay;
}

export const useSchoolLunchStore = create<SchoolLunchState>((set) => ({
  plans: createInitialPlans(),
  submitPlan: (planId, actorUserId) => {
    const actorPolicy = getActorPolicy(actorUserId);
    const actorRole = getActorRole(actorUserId);
    if (actorRole === "child" && actorPolicy === "no_edit") {
      log.warn({
        module: "schoolLunch",
        message: "submit blocked by policy",
        data: { actorUserId, actorPolicy, planId },
      });
      return;
    }
    if (actorRole === "none") {
      log.warn({
        module: "schoolLunch",
        message: "submit blocked: missing actor",
        data: { planId },
      });
      return;
    }

    set((state) => {
      const plans = state.plans.map((plan) => {
        if (plan.id !== planId) return plan;
        if (actorRole === "child" && actorUserId !== plan.childId) return plan;
        return { ...plan, status: "submitted" as const };
      });
      const plan = plans.find((item) => item.id === planId);
      logPlanEvent(actorUserId, "submitted", plan);
      return { plans };
    });
  },
  setDayChoice: (planId, dateKey, choice, actorUserId) => {
    const actorPolicy = getActorPolicy(actorUserId);
    const actorRole = getActorRole(actorUserId);
    if (actorRole === "none" || actorRole === "child" && actorPolicy === "no_edit") {
      log.warn({
        module: "schoolLunch",
        message:
          actorRole === "none"
            ? "day choice blocked: missing actor"
            : "day choice blocked by policy",
        data: {
          actorUserId,
          actorPolicy,
          planId,
          choice,
        },
      });
      return;
    }

    set((state) => {
      const plans = state.plans.map((plan) => {
        if (plan.id !== planId) return plan;
        const actorId = actorUserId ?? "";
        if (actorRole === "child" && actorId !== plan.childId) {
          return plan;
        }

        const days = plan.days.map((day) => {
          if (day.dateKey !== dateKey) return day;
          if (actorRole === "child" && actorPolicy === "approval_required") {
            return {
              ...day,
              pendingChoice: choice,
              approved: false,
              approvalNote: "Pending adult approval",
            };
          }

          const existingDay = { ...day };
          delete existingDay.pendingChoice;
          return {
            ...existingDay,
            choice,
            ...(actorRole === "adult"
              ? {
                  approved: true,
                  ...(day.approvalNote === "Pending adult approval"
                    ? { approvalNote: "Updated by adult" }
                    : {}),
                }
              : {}),
          };
        });

        const nextStatus: SchoolLunchPlan["status"] =
          actorRole === "adult"
            ? "approved"
            : actorPolicy === "approval_required"
              ? "changes_requested"
              : "draft";
        return { ...plan, days, status: nextStatus };
      });
      const plan = plans.find((item) => item.id === planId);
      if (plan) {
        log.info({
          module: "schoolLunch",
          message: "schoolLunch.dayUpdated",
          data: {
            userId: actorUserId,
            familyId: plan.familyId,
            childId: plan.childId,
            planId,
            dateKey,
            choice,
            actorPolicy,
          },
        });
      }
      return { plans };
    });
  },
  approveDay: (planId, dateKey, actorUserId, note) => {
    if (getActorRole(actorUserId) !== "adult") return;
    set((state) => {
      const plans = state.plans.map((plan) => {
        if (plan.id !== planId) return plan;
        const days: SchoolLunchDay[] = plan.days.map((day) =>
          day.dateKey === dateKey
            ? {
                ...stripPendingChoice(day),
                choice: day.pendingChoice ?? day.choice,
                approved: true,
                approvalNote: note,
              }
            : day,
        );
        return { ...plan, days, status: "approved" as const };
      });
      const plan = plans.find((item) => item.id === planId);
      logPlanEvent(actorUserId, "approved", plan, {
        dateKey,
        ...(note ? { note } : {}),
      });
      return { plans };
    });
  },
  rejectDay: (planId, dateKey, actorUserId, note) => {
    if (getActorRole(actorUserId) !== "adult") return;
    set((state) => {
      const plans = state.plans.map((plan) => {
        if (plan.id !== planId) return plan;
        const days: SchoolLunchDay[] = plan.days.map((day) =>
          day.dateKey === dateKey
            ? {
                ...day,
                approved: false,
                approvalNote: note,
              }
            : day,
        );
        return { ...plan, days, status: "changes_requested" as const };
      });
      const plan = plans.find((item) => item.id === planId);
      logPlanEvent(actorUserId, "rejected", plan, {
        dateKey,
        ...(note ? { note } : {}),
      });
      return { plans };
    });
  },
  approveAllDays: (planId, actorUserId) => {
    if (getActorRole(actorUserId) !== "adult") return;
    set((state) => {
      const plans = state.plans.map((plan) => {
        if (plan.id !== planId) return plan;
        const days = plan.days.map((day) => ({
          ...stripPendingChoice(day),
          choice: day.pendingChoice ?? day.choice,
          approved: true,
          approvalNote: "Approved",
        }));
        return { ...plan, days, status: "approved" as const };
      });
      const plan = plans.find((item) => item.id === planId);
      logPlanEvent(actorUserId, "approved", plan);
      return { plans };
    });
  },
}));
