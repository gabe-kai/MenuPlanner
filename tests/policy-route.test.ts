jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      async json() {
        return body;
      },
    }),
  },
  getToken: jest.fn(),
}));

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(async () => null),
}));

import type { NextRequest } from "next/server";
import { encodeSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth/sessionCookie";
import { useAuthAndFamilyStore } from "@/stores/authAndFamilyStore";

import { PUT } from "@/app/api/auth/policy/route";
import {
  getAuthEditPolicyForUser,
  setAuthEditPolicyForUser,
} from "@/lib/auth/authIdentity.server";

jest.mock("@/lib/auth/authIdentity.server", () => ({
  getAuthIdentityByUserId: jest.fn(),
  getAuthEditPolicyForUser: jest.fn(async () => "free" as const),
  setAuthEditPolicyForUser: jest.fn(async () => true),
}));

const mockedGetAuthEditPolicyForUser = getAuthEditPolicyForUser as jest.MockedFunction<
  typeof getAuthEditPolicyForUser
>;
const mockedSetAuthEditPolicyForUser = setAuthEditPolicyForUser as jest.MockedFunction<
  typeof setAuthEditPolicyForUser
>;

function buildRequestCookie(userId: string, familyId: string) {
  const cookieValue = encodeSessionCookie({
    userId,
    familyId,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 5_000,
  });
  return cookieValue;
}

function buildRequest(payload: { userId: string; editPolicy: string }, cookie: string) {
  return {
    async json() {
      return payload;
    },
    cookies: {
      get(name: string) {
        if (name === SESSION_COOKIE_NAME) {
          return { value: cookie };
        }
        return undefined;
      },
    },
  } as unknown as NextRequest;
}

describe("auth policy endpoint", () => {
  beforeEach(() => {
    const state = useAuthAndFamilyStore.getState();
    useAuthAndFamilyStore.setState({
      ...state,
      currentUserId: "mom",
      currentFamilyId: "fam-1",
      isAuthenticated: true,
    });
    mockedGetAuthEditPolicyForUser.mockClear();
    mockedSetAuthEditPolicyForUser.mockClear();
  });

  it("requires an adult actor", async () => {
    const request = buildRequest(
      { userId: "sarah", editPolicy: "no_edit" },
      buildRequestCookie("sarah", "fam-1"),
    );
    const response = await PUT(request);
    expect(response.status).toBe(403);
  });

  it("updates child edit policy for eligible family targets", async () => {
    const request = buildRequest(
      { userId: "sarah", editPolicy: "no_edit" },
      buildRequestCookie("mom", "fam-1"),
    );
    const response = await PUT(request);
    const body = (await response.json()) as { ok?: boolean; userId?: string; editPolicy?: string };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.userId).toBe("sarah");
    expect(body.editPolicy).toBe("no_edit");
    expect(mockedSetAuthEditPolicyForUser).toHaveBeenCalledWith("sarah", "no_edit");
  });

  it("rejects updates for adult targets", async () => {
    const request = buildRequest(
      { userId: "dad", editPolicy: "no_edit" },
      buildRequestCookie("mom", "fam-1"),
    );
    const response = await PUT(request);
    expect(response.status).toBe(400);
  });
});
