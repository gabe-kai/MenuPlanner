import { useSchoolLunchStore } from "@/stores/schoolLunchStore";

function resetSchoolLunchPlansToDraftDefaults() {
  const state = useSchoolLunchStore.getState();
  const plans = state.plans.map((plan) => ({
    ...plan,
    status: "draft",
    days: plan.days.map((day) => ({
      ...day,
      choice: "home",
      pendingChoice: undefined,
      approved: undefined,
      approvalNote: undefined,
    })),
  }));
  useSchoolLunchStore.setState({ plans });
}

describe("school lunch policy and review behavior", () => {
  beforeEach(() => {
    resetSchoolLunchPlansToDraftDefaults();
  });

  it("blocks no-edit children from changing day choices", () => {
    const state = useSchoolLunchStore.getState();
    const plan = state.plans.find((item) => item.childId === "daniel");
    expect(plan).toBeDefined();

    const day = plan!.days[0];
    state.setDayChoice(plan!.id, day.dateKey, "school", "daniel");

    const next = useSchoolLunchStore.getState().plans.find((item) => item.id === plan!.id);
    expect(next?.days[0]?.choice).toBe("home");
    expect(next?.status).toBe("draft");
  });

  it("requires adult approval when approval_required child changes a day", () => {
    const state = useSchoolLunchStore.getState();
    const plan = state.plans.find((item) => item.childId === "sarah");
    expect(plan).toBeDefined();

    const day = plan!.days[0];
    state.setDayChoice(plan!.id, day.dateKey, "school", "sarah");

    const next = useSchoolLunchStore.getState().plans.find((item) => item.id === plan!.id);
    const updatedDay = next?.days[0];
    expect(updatedDay?.choice).toBe("home");
    expect(updatedDay?.pendingChoice).toBe("school");
    expect(next?.status).toBe("changes_requested");
    expect(updatedDay?.approved).toBe(false);
    expect(updatedDay?.approvalNote).toBe("Pending adult approval");
  });

  it("blocks submit by anonymous or unknown actor", () => {
    const state = useSchoolLunchStore.getState();
    const plan = state.plans.find((item) => item.childId === "sarah");
    expect(plan).toBeDefined();
    state.submitPlan(plan!.id, null);
    expect(useSchoolLunchStore.getState().plans.find((item) => item.id === plan!.id)?.status).toBe(
      "draft",
    );
  });

  it("prevents child actors from submitting another child's plan", () => {
    const state = useSchoolLunchStore.getState();
    const sarahPlan = state.plans.find((item) => item.childId === "sarah");
    const danielPlan = state.plans.find((item) => item.childId === "daniel");
    expect(sarahPlan).toBeDefined();
    expect(danielPlan).toBeDefined();
    state.submitPlan(sarahPlan!.id, "daniel");

    expect(
      useSchoolLunchStore.getState().plans.find((item) => item.id === danielPlan!.id)?.status,
    ).toBe("draft");
    expect(
      useSchoolLunchStore.getState().plans.find((item) => item.id === sarahPlan!.id)?.status,
    ).toBe("draft");
  });

  it("allows adult to approve and reject a day", () => {
    const state = useSchoolLunchStore.getState();
    const plan = state.plans.find((item) => item.childId === "elijah");
    expect(plan).toBeDefined();

    const day = plan!.days[0];
    state.approveDay(plan!.id, day.dateKey, "mom", "Looks good");
    let next = useSchoolLunchStore.getState().plans.find((item) => item.id === plan!.id);
    const approvedDay = next?.days[0];
    expect(approvedDay?.approved).toBe(true);
    expect(approvedDay?.approvalNote).toBe("Looks good");

    state.rejectDay(plan!.id, day.dateKey, "dad", "Needs changes");
    next = useSchoolLunchStore.getState().plans.find((item) => item.id === plan!.id);
    const rejectedDay = next?.days[0];
    expect(rejectedDay?.approved).toBe(false);
    expect(rejectedDay?.approvalNote).toBe("Needs changes");
    expect(next?.status).toBe("changes_requested");
  });
});
