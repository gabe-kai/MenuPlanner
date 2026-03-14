jest.mock("node:fs/promises", () => ({
  mkdir: jest.fn(async () => undefined),
  appendFile: jest.fn(async () => undefined),
}));

async function loadLogger() {
  jest.resetModules();
  const { log } = await import("@/lib/log");
  return log;
}

describe("log utility", () => {
  it("logs structured events to terminal", async () => {
    process.env.LOG_FORCE_FILE_OUTPUT = "";
    const log = await loadLogger();
    const spy = jest.spyOn(console, "log").mockImplementation(() => undefined);
    log.info({
      module: "test",
      message: "hello from test",
      data: { ok: true },
    });
    expect(spy).toHaveBeenCalled();
    const payload = spy.mock.calls[0]?.[0] as {
      module?: string;
      message?: string;
      level?: string;
      timestamp?: string;
      runtime?: string;
    };
    expect(payload?.module).toBe("test");
    expect(payload?.message).toBe("hello from test");
    expect(payload?.level).toBe("info");
    expect(typeof payload?.timestamp).toBe("string");
    expect(["node", "browser"]).toContain(payload?.runtime);
    spy.mockRestore();
  });

  it("logs info without throwing", async () => {
    const log = await loadLogger();
    expect(() =>
      log.info({
        module: "test",
        message: "hello from test",
        data: { ok: true },
      }),
    ).not.toThrow();
  });

  it("writes to file when file logging is forced", async () => {
    const originalLogFilePath = process.env.LOG_FILE_PATH;
    const originalForceFile = process.env.LOG_FORCE_FILE_OUTPUT;
    process.env.LOG_FILE_PATH = "/tmp/menuplanner-test.log";
    process.env.LOG_FORCE_FILE_OUTPUT = "true";

    const log = await loadLogger();
    const mockedFs = (await import("node:fs/promises")) as unknown as {
      appendFile: jest.Mock;
      mkdir: jest.Mock;
    };
    const { appendFile, mkdir } = mockedFs;

    log.warn({
      module: "test",
      message: "file warning",
      data: { scope: "admin" },
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mkdir).toHaveBeenCalledWith("/tmp", { recursive: true });
    expect(appendFile).toHaveBeenCalledWith(
      "/tmp/menuplanner-test.log",
      expect.stringContaining('"message":"file warning"'),
      "utf8",
    );

    process.env.LOG_FILE_PATH = originalLogFilePath;
    process.env.LOG_FORCE_FILE_OUTPUT = originalForceFile;
  });
});

