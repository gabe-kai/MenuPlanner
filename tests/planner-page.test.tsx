import { getCurrentWeekDays } from "@/lib/week";

describe("getCurrentWeekDays", () => {
  it("returns seven days starting on Sunday", () => {
    const days = getCurrentWeekDays(new Date("2024-04-17T12:00:00Z")); // Wednesday

    expect(days).toHaveLength(7);
    expect(days[0]!.weekday).toBe("Sun");
    expect(days[6]!.weekday).toBe("Sat");
  });
});

