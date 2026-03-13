import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const push = jest.fn();
const mockFetch: jest.MockedFunction<typeof fetch> = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

Object.defineProperty(globalThis, "fetch", {
  value: mockFetch as typeof fetch,
  configurable: true,
  writable: true,
});

const mockResponse = (payload: unknown, ok = true, status = 200) =>
  ({ ok, status, async json() { return payload; } } as Response);

import AccountPage from "@/app/account/page";

describe("AccountPage", () => {
  beforeEach(() => {
    push.mockClear();
    mockFetch.mockClear();
  });

  it("loads and renders account details", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ userId: "mom", name: "Mom", role: "adult", familyId: "fam-1" }),
    );

    render(<AccountPage />);

    await waitFor(() => {
      expect(screen.getByText(/account settings/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue("mom")).toBeInTheDocument();
    });
  });

  it("redirects to login when not authenticated", async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ error: "unauthorized" }, false, 401));

    render(<AccountPage />);

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/login?redirectTo=%2Faccount");
    });
  });

  it("saves profile updates", async () => {
    mockFetch
      .mockResolvedValueOnce(
        mockResponse({ userId: "mom", name: "Mom", role: "adult", familyId: "fam-1" }),
      )
      .mockResolvedValueOnce(mockResponse({ ok: true }, true));

    render(<AccountPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("mom")).toBeInTheDocument();
    });

    const nameField = screen.getByLabelText(/display name/i);
    fireEvent.change(nameField, { target: { value: "Mama" } });
    fireEvent.click(screen.getByRole("button", { name: /save profile/i }));

    await waitFor(() => {
      const request = mockFetch.mock.calls[1];
      expect(request).toBeDefined();
      expect(request?.[0]).toBe("/api/auth/me");
      expect(((request?.[1] as RequestInit | undefined) ?? {}).method).toBe("PUT");
    });

    await waitFor(() => {
      expect(screen.getByText(/profile updated/i)).toBeInTheDocument();
    });
  });

  it("supports password updates with matching confirmation", async () => {
    mockFetch
      .mockResolvedValueOnce(
        mockResponse({ userId: "mom", name: "Mom", role: "adult", familyId: "fam-1" }),
      )
      .mockResolvedValueOnce(mockResponse({ ok: true }, true));

    render(<AccountPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("mom")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/current password/i), {
      target: { value: "oldpass" },
    });
    fireEvent.change(screen.getByLabelText(/^new password$/i), {
      target: { value: "newpassword" },
    });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), {
      target: { value: "newpassword" },
    });

    fireEvent.click(screen.getByRole("button", { name: /change password/i }));

    await waitFor(() => {
      const request = mockFetch.mock.calls[1];
      expect(request).toBeDefined();
      expect(request?.[0]).toBe("/api/auth/me/password");
      expect(((request?.[1] as RequestInit | undefined) ?? {}).method).toBe("POST");
    });

    await waitFor(() => {
      expect(screen.getByText(/password changed/i)).toBeInTheDocument();
    });
  });
});

