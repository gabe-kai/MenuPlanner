export type WeekStart = "sunday" | "monday";

export interface WeekDay {
  key: string;
  date: Date;
  label: string;
  weekday: string;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function getCurrentWeekDays(
  referenceDate?: Date,
  weekStart: WeekStart = "sunday",
): WeekDay[] {
  const today = referenceDate ? new Date(referenceDate) : new Date();
  const dayOfWeek = today.getDay(); // 0 (Sun) - 6 (Sat)

  // 0 for Sunday, 1 for Monday
  const startIndex = weekStart === "sunday" ? 0 : 1;
  let diffToStart = dayOfWeek - startIndex;
  if (diffToStart < 0) diffToStart += 7;

  const weekStartDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - diffToStart,
  );

  const days: WeekDay[] = [];

  for (let i = 0; i < 7; i += 1) {
    const d = new Date(
      weekStartDate.getFullYear(),
      weekStartDate.getMonth(),
      weekStartDate.getDate() + i,
    );
    const key = d.toISOString().slice(0, 10);
    const weekday = WEEKDAY_LABELS[d.getDay()] ?? "";
    const label = d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });

    days.push({ key, date: d, label, weekday });
  }

  return days;
}

