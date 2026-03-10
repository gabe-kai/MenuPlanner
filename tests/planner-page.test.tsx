import { getCurrentWeekDays } from "@/lib/week";

describe("getCurrentWeekDays", () => {
  it("returns seven days starting on Sunday by default", () => {
    const days = getCurrentWeekDays(new Date("2024-04-17T12:00:00Z"));

    expect(days).toHaveLength(7);
    expect(days[0]!.weekday).toBe("Sun");
    expect(days[6]!.weekday).toBe("Sat");
  });

  it("returns seven days starting on Monday when configured", () => {
    const days = getCurrentWeekDays(new Date("2024-04-17T12:00:00Z"), "monday");

    expect(days).toHaveLength(7);
    expect(days[0]!.weekday).toBe("Mon");
    expect(days[6]!.weekday).toBe("Sun");
  });
});

