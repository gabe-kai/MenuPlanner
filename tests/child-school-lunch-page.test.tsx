import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { useAuthAndFamilyStore } from "@/stores/authAndFamilyStore";
import { useSchoolLunchStore } from "@/stores/schoolLunchStore";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import ChildSchoolLunchPage from "@/app/school-lunch/child/page";

function resetAuthAndPlans() {
  const authState = useAuthAndFamilyStore.getState();
  useAuthAndFamilyStore.setState({
    ...authState,
    currentUserId: null,
    currentFamilyId: "fam-1",
    isAuthenticated: true,
  });

  const lunchState = useSchoolLunchStore.getState();
  useSchoolLunchStore.setState({
    ...lunchState,
    plans: lunchState.plans.map((plan) => ({
      ...plan,
      status: "draft",
      days: plan.days.map((day) => ({
        ...day,
        choice: "home",
        approved: false,
        ...(day.pendingChoice === undefined ? {} : { pendingChoice: day.pendingChoice }),
        ...(day.approvalNote === undefined ? {} : { approvalNote: day.approvalNote }),
      })),
    })),
  });
}

function getDaySelects() {
  return screen.getAllByRole("combobox").slice(1);
}

describe("Child school-lunch page", () => {
  beforeEach(() => {
    resetAuthAndPlans();
  });

  it("prompts for sign-in when unauthenticated", () => {
    useAuthAndFamilyStore.setState({
      ...useAuthAndFamilyStore.getState(),
      isAuthenticated: false,
      currentUserId: null,
      currentFamilyId: "fam-1",
    });

    render(<ChildSchoolLunchPage />);
    expect(screen.getByText(/School Lunch requires sign-in/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign in/i })).toBeInTheDocument();
  });

  it("disables editing for no-edit policy children", () => {
    useAuthAndFamilyStore.setState({
      ...useAuthAndFamilyStore.getState(),
      currentUserId: "daniel",
    });

    render(<ChildSchoolLunchPage />);
    expect(screen.getByRole("button", { name: /submit week for review/i })).toBeDisabled();

    for (const select of getDaySelects()) {
      expect(select).toBeDisabled();
    }

    expect(
      screen.getByRole("button", { name: /submit week for review/i }),
    ).toBeDisabled();
  });

  it("moves approval-required children into review state on edit", () => {
    useAuthAndFamilyStore.setState({
      ...useAuthAndFamilyStore.getState(),
      currentUserId: "sarah",
    });

    render(<ChildSchoolLunchPage />);
    const firstDaySelect = getDaySelects()[0];
    if (!firstDaySelect) {
      throw new Error("Expected at least one child day select");
    }
    fireEvent.change(firstDaySelect, { target: { value: "school" } });

    const plan = useSchoolLunchStore
      .getState()
      .plans.find((item) => item.childId === "sarah");
    if (!plan) {
      throw new Error("Expected sarah plan");
    }
    expect(plan).toBeDefined();
    const day = plan.days[0];
    if (!day) {
      throw new Error("Expected first day");
    }
    expect(day.choice).toBe("home");
    expect(day.pendingChoice).toBe("school");
    expect(day.approved).toBe(false);
    expect(day.approvalNote).toBe("Pending adult approval");
    expect(plan.status).toBe("changes_requested");
  });
});
