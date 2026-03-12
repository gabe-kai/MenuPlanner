const asMockedResponse = (body: unknown, ok = true) =>
  ({
    ok,
    json: async () => body,
  }) as Response;

describe("real auth gateway", () => {
  const originalAuthMode = process.env.NEXT_PUBLIC_USE_REAL_AUTH;
  const originalFetch = global.fetch;

  function withRealAuthGateway() {
    process.env.NEXT_PUBLIC_USE_REAL_AUTH = "true";
    jest.resetModules();
    return import("@/lib/auth/authGateway");
  }

  afterEach(() => {
    process.env.NEXT_PUBLIC_USE_REAL_AUTH = originalAuthMode;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
    jest.resetModules();
  });

  it("restores a session through the auth API", async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      asMockedResponse({
        session: { userId: "mom", familyId: "fam-1" },
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const { realAuthGateway } = await withRealAuthGateway();

    const session = await realAuthGateway.restoreSession();
    expect(session).toEqual({ userId: "mom", familyId: "fam-1" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/session",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("signs in via the auth API", async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      asMockedResponse({
        session: { userId: "mom", familyId: "fam-1" },
      }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const { realAuthGateway } = await withRealAuthGateway();

    const session = await realAuthGateway.signIn({ userId: "mom", familyId: "fam-1" });
    expect(session).toEqual({ userId: "mom", familyId: "fam-1" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/signin",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  it("refreshes near-expiry sessions during restore", async () => {
    const nearExpirySession = {
      userId: "mom",
      familyId: "fam-1",
      issuedAt: Date.now() - 1000,
      expiresAt: Date.now() + 60 * 1000,
    };
    const refreshedSession = {
      userId: "mom",
      familyId: "fam-1",
      issuedAt: Date.now(),
      expiresAt: Date.now() + 60 * 60 * 24 * 30 * 1000,
    };
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(asMockedResponse({ session: nearExpirySession }))
      .mockResolvedValueOnce(asMockedResponse({ session: refreshedSession }));
    global.fetch = fetchMock as unknown as typeof fetch;
    const { realAuthGateway } = await withRealAuthGateway();

    const session = await realAuthGateway.restoreSession();
    expect(session).toMatchObject({ userId: "mom", familyId: "fam-1" });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/auth/refresh",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  it("signs out through the auth API", async () => {
    const fetchMock = jest.fn().mockResolvedValue(asMockedResponse({ ok: true }));
    global.fetch = fetchMock as unknown as typeof fetch;
    const { realAuthGateway } = await withRealAuthGateway();

    await realAuthGateway.signOut();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/signout",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });
});
