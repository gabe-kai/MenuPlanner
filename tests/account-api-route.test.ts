jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      async json() {
        return body;
      },
    }),
  },
}));

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(async () => null),
}));

jest.mock("@/lib/auth/authGateway", () => ({
  useRealAuth: false,
}));

import type { NextRequest } from "next/server";
import { encodeSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth/sessionCookie";
import { GET, PUT } from "@/app/api/auth/me/route";
import { POST } from "@/app/api/auth/me/password/route";
import {
  getAuthIdentitySnapshot,
  getAuthIdentityByUserId,
  updateAuthIdentityName,
  updateAuthIdentityPassword,
  getAuthEditPolicyForUser,
} from "@/lib/auth/authIdentity.server";

jest.mock("@/lib/auth/authIdentity.server", () => ({
  getAuthIdentitySnapshot: jest.fn(),
  getAuthIdentityByUserId: jest.fn(),
  getAuthEditPolicyForUser: jest.fn(),
  updateAuthIdentityName: jest.fn(async () => true),
  updateAuthIdentityPassword: jest.fn(async () => ({ ok: true })),
}));

const mockedGetAuthIdentitySnapshot = getAuthIdentitySnapshot as jest.MockedFunction<
  typeof getAuthIdentitySnapshot
>;
const mockedGetAuthIdentityByUserId = getAuthIdentityByUserId as jest.MockedFunction<
  typeof getAuthIdentityByUserId
>;
const mockedGetAuthEditPolicyForUser = getAuthEditPolicyForUser as jest.MockedFunction<
  typeof getAuthEditPolicyForUser
>;
const mockedUpdateAuthIdentityName = updateAuthIdentityName as jest.MockedFunction<
  typeof updateAuthIdentityName
>;
const mockedUpdateAuthIdentityPassword = updateAuthIdentityPassword as jest.MockedFunction<
  typeof updateAuthIdentityPassword
>;

function buildRequestCookie(userId: string, familyId: string) {
  const cookieValue = encodeSessionCookie({
    userId,
    familyId,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 10000,
  });
  return {
    cookies: {
      get(name: string) {
        if (name === SESSION_COOKIE_NAME) {
          return { value: cookieValue };
        }
        return undefined;
      },
    },
    async json() {
      return { name: "Family Mom" };
    },
  } as unknown as NextRequest;
}

describe("account API endpoints", () => {
  beforeEach(() => {
    mockedGetAuthIdentitySnapshot.mockReset();
    mockedGetAuthIdentityByUserId.mockReset();
    mockedGetAuthEditPolicyForUser.mockReset();
    mockedUpdateAuthIdentityName.mockReset();
    mockedUpdateAuthIdentityPassword.mockReset();
    mockedUpdateAuthIdentityName.mockResolvedValue(true);
    mockedUpdateAuthIdentityPassword.mockResolvedValue({ ok: true });
  });

  it("returns unauthorized when no actor session is available", async () => {
    const response = await GET({
      cookies: { get: () => undefined },
      json: async () => ({}),
    } as unknown as NextRequest);

    expect(response.status).toBe(401);
  });

  it("returns profile data for a valid session", async () => {
    mockedGetAuthEditPolicyForUser.mockResolvedValueOnce("free");
    mockedGetAuthIdentitySnapshot.mockResolvedValueOnce({
      userId: "mom",
      name: "Mom",
      familyId: "fam-1",
      role: "adult",
    });

    const response = await GET(buildRequestCookie("mom", "fam-1"));
    const body = (await response.json()) as {
      userId: string;
      name: string;
      familyId: string;
      role: "adult" | "child";
    };

    expect(response.status).toBe(200);
    expect(body.userId).toBe("mom");
    expect(body.role).toBe("adult");
    expect(mockedGetAuthIdentitySnapshot).toHaveBeenCalledWith("mom");
  });

  it("updates account name", async () => {
    mockedGetAuthIdentityByUserId.mockResolvedValueOnce({
      userId: "mom",
      name: "Mom",
      familyId: "fam-1",
      role: "adult",
    });

    const response = await PUT(
      {
        ...buildRequestCookie("mom", "fam-1"),
        json: async () => ({ name: "Mama" }),
      } as unknown as NextRequest,
    );
    const body = (await response.json()) as { ok: boolean };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockedUpdateAuthIdentityName).toHaveBeenCalledWith({
      userId: "mom",
      name: "Mama",
    });
  });

  it("rejects weak name updates", async () => {
    const response = await PUT(
      {
        ...buildRequestCookie("mom", "fam-1"),
        json: async () => ({ name: "   " }),
      } as unknown as NextRequest,
    );
    expect(response.status).toBe(400);
  });

  it("rejects wrong current password", async () => {
    mockedUpdateAuthIdentityPassword.mockResolvedValueOnce({
      ok: false,
      reason: "invalid_password",
    });

    const response = await POST(
      {
        ...buildRequestCookie("mom", "fam-1"),
        json: async () => ({
          currentPassword: "bad",
          nextPassword: "new-password",
        }),
      } as unknown as NextRequest,
    );

    expect(response.status).toBe(403);
  });
});

