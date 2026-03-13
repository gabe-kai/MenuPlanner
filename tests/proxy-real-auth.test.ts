import type { NextRequest } from "next/server";

const getTokenMock = jest.fn();

jest.mock("next/server", () => {
  const next = () => ({ status: 200, headers: { get: () => null } });
  const redirect = (destination: URL) => ({
    status: 307,
    headers: { get: (name: string) => (name === "location" ? String(destination) : null) },
  });
  return { NextResponse: { next, redirect } };
});

jest.mock("next-auth/jwt", () => ({
  getToken: (...args: unknown[]) => getTokenMock(...args),
}));

const originalUseRealAuth = process.env.NEXT_PUBLIC_USE_REAL_AUTH;
const originalUseRealAuthSecret = process.env.NEXTAUTH_SECRET;
const originalAdminUsers = process.env.MENU_ADMIN_USER_IDS;

describe("school-lunch proxy in real-auth mode", () => {
  beforeAll(() => {
    process.env.NEXTAUTH_SECRET = "test-secret";
  });

  afterEach(() => {
    getTokenMock.mockReset();
    if (originalAdminUsers === undefined) {
      delete process.env.MENU_ADMIN_USER_IDS;
    } else {
      process.env.MENU_ADMIN_USER_IDS = originalAdminUsers;
    }
  });

  afterAll(() => {
    if (originalUseRealAuth === undefined) {
      delete process.env.NEXT_PUBLIC_USE_REAL_AUTH;
    } else {
      process.env.NEXT_PUBLIC_USE_REAL_AUTH = originalUseRealAuth;
    }

    if (originalUseRealAuthSecret === undefined) {
      delete process.env.NEXTAUTH_SECRET;
    } else {
      process.env.NEXTAUTH_SECRET = originalUseRealAuthSecret;
    }
  });

  function makeRequest(pathname: string) {
    const url = `http://localhost:3000${pathname}`;
    return {
      nextUrl: new URL(url),
      url,
      cookies: {
        get: () => undefined,
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

  async function getProxy() {
    process.env.NEXT_PUBLIC_USE_REAL_AUTH = "true";
    jest.resetModules();
    const module = await import("../src/proxy");
    return module.proxy;
  }

  it("allows authenticated adult token through to adult school-lunch route", async () => {
    const proxy = await getProxy();
    getTokenMock.mockResolvedValueOnce({
      userId: "mom",
      familyId: "fam-1",
      role: "adult",
    });

    const response = await proxy(makeRequest("/school-lunch/adult"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("allows admin token onto admin routes", async () => {
    process.env.MENU_ADMIN_USER_IDS = "mom";
    const proxy = await getProxy();
    getTokenMock.mockResolvedValueOnce({
      userId: "mom",
      familyId: "fam-1",
      role: "child",
    });

    const response = await proxy(makeRequest("/admin"));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("allows authenticated child token through to child school-lunch route", async () => {
    const proxy = await getProxy();
    getTokenMock.mockResolvedValueOnce({
      userId: "sarah",
      familyId: "fam-1",
      role: "child",
    });

    const response = await proxy(makeRequest("/school-lunch/child"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects child token from adult to child route", async () => {
    const proxy = await getProxy();
    getTokenMock.mockResolvedValueOnce({
      userId: "sarah",
      familyId: "fam-1",
      role: "child",
    });

    const response = await proxy(makeRequest("/school-lunch/adult"));

    expectRedirect(response, "/school-lunch/child");
  });

  it("redirects child token from admin route", async () => {
    const proxy = await getProxy();
    getTokenMock.mockResolvedValueOnce({
      userId: "sarah",
      familyId: "fam-1",
      role: "child",
    });

    const response = await proxy(makeRequest("/admin"));
    expectRedirect(response, "/planner");
  });

  it("redirects unauthenticated requests when token is missing", async () => {
    const proxy = await getProxy();
    getTokenMock.mockResolvedValueOnce(null);

    const response = await proxy(makeRequest("/school-lunch/child"));
    expectRedirect(response, "/login");
  });

  it("allows token claims for non-seeded real-auth user", async () => {
    const proxy = await getProxy();
    getTokenMock.mockResolvedValueOnce({
      userId: "unknown",
      familyId: "fam-1",
      role: "adult",
    });

    const response = await proxy(makeRequest("/school-lunch/child"));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects users marked mustChangePassword", async () => {
    const proxy = await getProxy();
    getTokenMock.mockResolvedValueOnce({
      userId: "mom",
      familyId: "fam-1",
      role: "adult",
      mustChangePassword: true,
    });

    const response = await proxy(makeRequest("/planner"));
    expectRedirect(response, "/account");
  });
});

