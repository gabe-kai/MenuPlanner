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

import AdultSchoolLunchPage from "@/app/school-lunch/adult/page";

function resetAuthAndPlans() {
  const authState = useAuthAndFamilyStore.getState();
  useAuthAndFamilyStore.setState({
    ...authState,
    currentUserId: "mom",
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
        approvalNote: undefined,
      })),
    })),
  });
}

describe("Adult school-lunch page", () => {
  beforeEach(() => {
    resetAuthAndPlans();
  });

  function openFirstChildDetails() {
    const hideDetailsButtons = screen.queryAllByRole("button", {
      name: /hide details/i,
    });
    if (hideDetailsButtons.length === 0) {
      fireEvent.click(
        screen.getAllByRole("button", { name: /show details/i })[0],
      );
    }
  }

  it("requires adult authentication", () => {
    useAuthAndFamilyStore.setState({
      ...useAuthAndFamilyStore.getState(),
      currentUserId: "sarah",
    });

    render(<AdultSchoolLunchPage />);
    expect(
      screen.getByRole("link", { name: /sign in as an adult/i }),
    ).toBeInTheDocument();
  });

  it("approves child days and marks plan approved", () => {
    render(<AdultSchoolLunchPage />);
    openFirstChildDetails();

    fireEvent.change(screen.getAllByRole("combobox")[0], {
      target: { value: "school" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /^approve$/i })[0]);

    const plan = useSchoolLunchStore
      .getState()
      .plans.find((item) => item.childId === "sarah");

    expect(plan).toBeDefined();
    expect(plan?.days[0].choice).toBe("school");
    expect(plan?.days[0].approved).toBe(true);
    expect(plan?.status).toBe("approved");
    expect(plan?.days[0].approvalNote).toBe("Approved");
  });

  it("rejects child day with per-day note", () => {
    render(<AdultSchoolLunchPage />);
    openFirstChildDetails();

    fireEvent.change(screen.getAllByRole("combobox")[0], {
      target: { value: "school" },
    });
    fireEvent.change(screen.getAllByRole("textbox")[0], {
      target: { value: "Lunch box not ready" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /^reject$/i })[0]);

    const plan = useSchoolLunchStore
      .getState()
      .plans.find((item) => item.childId === "sarah");

    expect(plan).toBeDefined();
    expect(plan?.days[0].approved).toBe(false);
    expect(plan?.days[0].approvalNote).toBe("Lunch box not ready");
    expect(plan?.status).toBe("changes_requested");
  });
});
