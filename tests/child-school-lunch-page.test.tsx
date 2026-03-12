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
        pendingChoice: undefined,
        approved: false,
        approvalNote: undefined,
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
    fireEvent.change(firstDaySelect, { target: { value: "school" } });

    const plan = useSchoolLunchStore
      .getState()
      .plans.find((item) => item.childId === "sarah");
    expect(plan).toBeDefined();
    expect(plan?.days[0].choice).toBe("home");
    expect(plan?.days[0].pendingChoice).toBe("school");
    expect(plan?.days[0].approved).toBe(false);
    expect(plan?.days[0].approvalNote).toBe("Pending adult approval");
    expect(plan?.status).toBe("changes_requested");
  });
});
