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

import { POST } from "@/app/api/auth/register/route";
import { registerAuthIdentity } from "@/lib/auth/authIdentity.server";
import type { NextRequest } from "next/server";

jest.mock("@/lib/auth/authIdentity.server", () => ({
  registerAuthIdentity: jest.fn(async () => ({ ok: true, userId: "gabe", familyId: "fam-1" })),
}));

const mockedRegisterAuthIdentity = registerAuthIdentity as jest.MockedFunction<
  typeof registerAuthIdentity
>;

function buildRequest(payload: object) {
  return {
    async json() {
      return payload;
    },
  } as unknown as NextRequest;
}

describe("register endpoint", () => {
  beforeEach(() => {
    mockedRegisterAuthIdentity.mockClear();
  });

  it("rejects unknown top-level fields such as editPolicy", async () => {
    const request = buildRequest({
      userId: "gabe",
      name: "Gabe",
      role: "child",
      password: "strongpass",
      familyId: "fam-1",
      editPolicy: "no_edit",
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error?: string };
    expect(body.error).toBe("invalid payload");
    expect(mockedRegisterAuthIdentity).not.toHaveBeenCalled();
  });
});
