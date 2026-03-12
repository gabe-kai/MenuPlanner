import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const push = jest.fn();
const signInUser = jest.fn();

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

jest.mock("@/lib/auth/authGateway", () => ({
  useRealAuth: true,
}));

jest.mock("@/lib/auth/session", () => ({
  signInUser,
}));

const mockResponse = (payload: unknown, ok = true) =>
  ({ ok, json: async () => payload } as Response);

const mockedFetch = jest.fn() as unknown as typeof fetch;
Object.defineProperty(globalThis, "fetch", {
  value: mockedFetch,
  configurable: true,
  writable: true,
});

import RegisterPage from "@/app/register/page";

describe("RegisterPage", () => {
  beforeEach(() => {
    push.mockClear();
    signInUser.mockClear();
    mockedFetch.mockClear();
  });

  it("creates account and signs in", async () => {
    mockedFetch.mockResolvedValue(mockResponse({ ok: true, userId: "gabe" }));
    signInUser.mockResolvedValue({
      userId: "gabe",
      familyId: "fam-1",
    });

    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: "gabe" },
    });
    fireEvent.change(screen.getByLabelText(/display name/i), {
      target: { value: "Gabe" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i, { selector: "input" }), {
      target: { value: "strongpass" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "strongpass" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(signInUser).toHaveBeenCalledWith("gabe", "strongpass");
    });
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/planner");
    });
  });

  it("shows registration errors from the API", async () => {
    mockedFetch.mockResolvedValue(mockResponse({ error: "already_exists" }, false));
    signInUser.mockRejectedValue(new Error("Unexpected"));

    render(<RegisterPage />);
    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: "gabe" },
    });
    fireEvent.change(screen.getByLabelText(/display name/i), {
      target: { value: "Gabe" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i, { selector: "input" }), {
      target: { value: "strongpass" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "strongpass" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/registration failed/i)).toBeInTheDocument();
    });
    expect(signInUser).not.toHaveBeenCalled();
  });

  it("validates matching passwords", async () => {
    render(<RegisterPage />);
    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: "gabe" },
    });
    fireEvent.change(screen.getByLabelText(/display name/i), {
      target: { value: "Gabe" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i, { selector: "input" }), {
      target: { value: "strongpass" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "wrong-pass" },
    });

    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
    expect(mockedFetch).not.toHaveBeenCalled();
  });
});
