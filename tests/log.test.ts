import { log } from "@/lib/log";

describe("log utility", () => {
  it("logs info without throwing", () => {
    expect(() =>
      log.info({
        module: "test",
        message: "hello from test",
        data: { ok: true },
      }),
    ).not.toThrow();
  });
});

