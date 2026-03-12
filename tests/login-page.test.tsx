import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { waitFor } from "@testing-library/react";
import { useAuthAndFamilyStore } from "@/stores/authAndFamilyStore";

const push = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => ({
    get: () => null,
  }),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const signInUser = jest.fn();
jest.mock("@/lib/auth/session", () => ({
  ...jest.requireActual("@/lib/auth/session"),
  signInUser,
}));

import LoginPage from "@/app/login/page";

describe("LoginPage", () => {
  beforeEach(() => {
    push.mockClear();
    signInUser.mockClear();
    const state = useAuthAndFamilyStore.getState();
    useAuthAndFamilyStore.setState({
      ...state,
      currentUserId: null,
      currentFamilyId: null,
      isAuthenticated: false,
    });
  });

  it("signs in selected user and navigates to planner", async () => {
    signInUser.mockResolvedValue({
      userId: "mom",
      familyId: "fam-1",
    });
    render(<LoginPage />);
    const button = screen.getByRole("button", { name: /sign in/i });
    fireEvent.click(button);

    expect(signInUser).toHaveBeenCalledWith("mom");
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/planner");
    });
  });

  it("shows a sign-in error when sign-in fails", async () => {
    signInUser.mockRejectedValue(new Error("Unable to complete sign in"));
    render(<LoginPage />);

    const button = screen.getByRole("button", { name: /sign in/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/sign in failed/i)).toBeInTheDocument();
    });
    expect(push).not.toHaveBeenCalled();
  });

  it("shows already authenticated state", () => {
    useAuthAndFamilyStore.setState({
      ...useAuthAndFamilyStore.getState(),
      currentUserId: "mom",
      isAuthenticated: true,
    });

    render(<LoginPage />);
    expect(screen.getByText(/You are already signed in/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /planner/i })).toBeInTheDocument();
  });
});
