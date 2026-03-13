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
  getServerSession: jest.fn(),
}));

jest.mock("@/lib/auth/authGateway", () => ({
  useRealAuth: true,
}));

jest.mock("@/lib/auth/nextAuth", () => ({
  authOptions: {},
}));

jest.mock("@/stores/authAndFamilyStore", () => ({
  useAuthAndFamilyStore: {
    getState: () => ({ users: [], families: [], memberships: [] }),
  },
}));

jest.mock("@/lib/auth/sessionCookie", () => ({
  parseSessionCookie: jest.fn(),
  SESSION_COOKIE_NAME: "menuplanner.auth.session.v1",
}));

jest.mock("@/lib/auth/adminAuth", () => ({
  isSystemAdminUser: jest.fn(),
}));

jest.mock("@/lib/auth/authIdentity.server", () => ({
  deleteAuthIdentity: jest.fn(async () => false),
  setAuthFamilyName: jest.fn(async () => false),
  setAuthIdentityFamily: jest.fn(async () => false),
  setAuthIdentityTemporaryPassword: jest.fn(async () => false),
  setPasswordChangeRequired: jest.fn(async () => true),
}));

import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import {
  setAuthFamilyName,
  setAuthIdentityFamily,
  setAuthIdentityTemporaryPassword,
  setPasswordChangeRequired,
  deleteAuthIdentity,
} from "@/lib/auth/authIdentity.server";
import { isSystemAdminUser } from "@/lib/auth/adminAuth";
import { DELETE as deleteUserRoute } from "@/app/api/admin/users/[userId]/route";
import { POST as resetUserRoute } from "@/app/api/admin/users/[userId]/reset/route";
import { PATCH as moveUserRoute } from "@/app/api/admin/users/[userId]/family/route";
import { PATCH as renameFamilyRoute } from "@/app/api/admin/families/[familyId]/route";

const mockedGetServerSession = getServerSession as jest.Mock;
const mockedIsSystemAdminUser = isSystemAdminUser as jest.Mock;
const mockedDeleteAuthIdentity = deleteAuthIdentity as jest.Mock;
const mockedSetAuthFamilyName = setAuthFamilyName as jest.Mock;
const mockedSetAuthIdentityFamily = setAuthIdentityFamily as jest.Mock;
const mockedSetAuthIdentityTemporaryPassword = setAuthIdentityTemporaryPassword as jest.Mock;
const mockedSetPasswordChangeRequired = setPasswordChangeRequired as jest.Mock;

function asRequest(payload: unknown): NextRequest {
  return {
    async json() {
      return payload;
    },
  } as unknown as NextRequest;
}

describe("admin API routes", () => {
  beforeEach(() => {
    mockedGetServerSession.mockReset();
    mockedIsSystemAdminUser.mockReset();
    mockedDeleteAuthIdentity.mockReset().mockResolvedValue(true);
    mockedSetAuthFamilyName.mockReset().mockResolvedValue(true);
    mockedSetAuthIdentityFamily.mockReset().mockResolvedValue(true);
    mockedSetAuthIdentityTemporaryPassword.mockReset().mockResolvedValue(true);
    mockedSetPasswordChangeRequired.mockReset().mockResolvedValue(true);
  });

  it("rejects admin user deletion when actor is not admin", async () => {
    mockedGetServerSession.mockResolvedValue({
      user: { id: "sarah", familyId: "fam-1", systemRole: "user" },
    });
    const response = await deleteUserRoute(asRequest(null), { params: Promise.resolve({ userId: "gabe" }) });

    expect(response.status).toBe(403);
  });

  it("rejects deleting the current admin account", async () => {
    mockedGetServerSession.mockResolvedValue({
      user: { id: "admin", familyId: "fam-1", systemRole: "admin" },
    });

    const response = await deleteUserRoute(asRequest(null), { params: Promise.resolve({ userId: "admin" }) });
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("cannot delete own account");
    expect(mockedDeleteAuthIdentity).not.toHaveBeenCalled();
  });

  it("returns not found when deleting unknown user", async () => {
    mockedDeleteAuthIdentity.mockResolvedValue(false);
    mockedGetServerSession.mockResolvedValue({
      user: { id: "admin", familyId: "fam-1", systemRole: "admin" },
    });

    const response = await deleteUserRoute(asRequest(null), { params: Promise.resolve({ userId: "unknown" }) });
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(404);
    expect(body.error).toBe("not found");
  });

  it("deletes another user in real-auth admin mode", async () => {
    mockedGetServerSession.mockResolvedValue({
      user: { id: "admin", familyId: "fam-1", systemRole: "admin" },
    });

    const response = await deleteUserRoute(asRequest(null), { params: Promise.resolve({ userId: "gabe" }) });
    const body = (await response.json()) as { ok?: boolean; userId?: string };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.userId).toBe("gabe");
    expect(mockedDeleteAuthIdentity).toHaveBeenCalledWith("gabe");
  });

  it("renames a family in real-auth admin mode", async () => {
    mockedGetServerSession.mockResolvedValue({
      user: { id: "admin", familyId: "fam-1", systemRole: "admin" },
    });

    const response = await renameFamilyRoute(asRequest({ name: "Starter" }), {
      params: Promise.resolve({ familyId: "fam-1" }),
    });
    const body = (await response.json()) as { ok?: boolean; familyId?: string; name?: string };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.familyId).toBe("fam-1");
    expect(body.name).toBe("Starter");
    expect(mockedSetAuthFamilyName).toHaveBeenCalledWith("fam-1", "Starter");
  });

  it("moves a user to another family in real-auth mode", async () => {
    mockedGetServerSession.mockResolvedValue({
      user: { id: "admin", familyId: "fam-1", systemRole: "admin" },
    });

    const response = await moveUserRoute(asRequest({ familyId: "fam-2" }), {
      params: Promise.resolve({ userId: "sarah" }),
    });
    const body = (await response.json()) as { ok?: boolean; familyId?: string };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.userId).toBe("sarah");
    expect(body.familyId).toBe("fam-2");
    expect(mockedSetAuthIdentityFamily).toHaveBeenCalledWith("sarah", "fam-2");
  });

  it("allows forcing password reset without temporary password", async () => {
    mockedGetServerSession.mockResolvedValue({
      user: { id: "admin", familyId: "fam-1", systemRole: "admin" },
    });

    const response = await resetUserRoute(asRequest({ temporaryPassword: "" }), {
      params: Promise.resolve({ userId: "sarah" }),
    });
    const body = (await response.json()) as { ok?: boolean; userId?: string; hasTemporaryPassword?: boolean };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.userId).toBe("sarah");
    expect(body.hasTemporaryPassword).toBe(false);
    expect(mockedSetAuthIdentityTemporaryPassword).not.toHaveBeenCalled();
    expect(mockedSetPasswordChangeRequired).toHaveBeenCalledWith("sarah", true);
  });

  it("rejects weak temporary passwords", async () => {
    mockedGetServerSession.mockResolvedValue({
      user: { id: "admin", familyId: "fam-1", systemRole: "admin" },
    });

    const response = await resetUserRoute(asRequest({ temporaryPassword: "short" }), {
      params: Promise.resolve({ userId: "sarah" }),
    });
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("temporaryPassword must be at least 8 characters");
  });
});
