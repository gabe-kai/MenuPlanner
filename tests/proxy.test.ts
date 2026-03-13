import {
  encodeSessionCookie,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/sessionCookie";
import { proxy } from "../src/proxy";
import type { NextRequest } from "next/server";

jest.mock("next/server", () => {
  const next = () => ({ status: 200, headers: { get: () => null } });
  const redirect = (destination: URL) => ({
    status: 307,
    headers: { get: (name: string) => (name === "location" ? String(destination) : null) },
  });
  return { NextResponse: { next, redirect } };
});

jest.mock("next-auth/jwt", () => ({
  getToken: () => null,
}));

const originalAdminUsers = process.env.MENU_ADMIN_USER_IDS;

afterEach(() => {
  if (originalAdminUsers === undefined) {
    delete process.env.MENU_ADMIN_USER_IDS;
  } else {
    process.env.MENU_ADMIN_USER_IDS = originalAdminUsers;
  }
});

describe("school-lunch proxy", () => {
  function makeRequest(pathname: string, cookieValue?: string) {
    const url = `http://localhost:3000${pathname}`;
    return {
      nextUrl: new URL(url),
      url,
      cookies: {
        get: (name: string) =>
          name === SESSION_COOKIE_NAME && cookieValue
            ? { value: cookieValue }
            : undefined,
      },
    } as NextRequest;
  }

  function expectRedirect(response: Response, expectedPath: string) {
    expect([307, 308]).toContain(response.status);
    const location = response.headers.get("location");
    expect(location).toBeTruthy();
    const destination = new URL(location ?? "", "http://localhost:3000");
    expect(destination.pathname).toBe(expectedPath);
    return destination;
  }

  it("redirects unauthenticated school-lunch requests to login", async () => {
    const response = await proxy(makeRequest("/school-lunch/child"));
    const destination = expectRedirect(response, "/login");
    expect(destination.searchParams.get("redirectTo")).toBe("/school-lunch/child");
  });

  it("allows authenticated child requests to child school-lunch route", async () => {
    const response = await proxy(
      makeRequest(
        "/school-lunch/child",
        encodeSessionCookie({ userId: "sarah", familyId: "fam-1" }),
      ),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects child actor from adult school-lunch route", async () => {
    const response = await proxy(
      makeRequest(
        "/school-lunch/adult",
        encodeSessionCookie({ userId: "sarah", familyId: "fam-1" }),
      ),
    );
    expectRedirect(response, "/school-lunch/child");
  });

  it("allows authenticated adult requests to adult school-lunch route", async () => {
    const response = await proxy(
      makeRequest(
        "/school-lunch/adult",
        encodeSessionCookie({ userId: "mom", familyId: "fam-1" }),
      ),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("treats malformed sessions as missing session", async () => {
    const response = await proxy(
      makeRequest(
        "/school-lunch/child",
        encodeSessionCookie({ userId: "nobody", familyId: "fam-1" }),
      ),
    );
    expectRedirect(response, "/login");
  });

  it("redirects non-admin users from admin to planner", async () => {
    const response = await proxy(makeRequest("/admin", encodeSessionCookie({ userId: "sarah", familyId: "fam-1" })));
    expectRedirect(response, "/planner");
  });

  it("allows configured admin users onto admin routes", async () => {
    process.env.MENU_ADMIN_USER_IDS = "mom";
    const response = await proxy(
      makeRequest("/admin", encodeSessionCookie({ userId: "mom", familyId: "fam-1" })),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects expired sessions to login", async () => {
    const response = await proxy(
      makeRequest(
        "/school-lunch/child",
        encodeSessionCookie({ userId: "sarah", familyId: "fam-1", expiresAt: Date.now() - 1000 }),
      ),
    );
    expectRedirect(response, "/login");
  });
});
