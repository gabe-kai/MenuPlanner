export interface WeekDay {
  key: string;
  date: Date;
  label: string;
  weekday: string;
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function getCurrentWeekDays(todayInput?: Date): WeekDay[] {
  const today = todayInput ? new Date(todayInput) : new Date();
  const dayOfWeek = today.getDay(); // 0 (Sun) - 6 (Sat)

  const sunday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - dayOfWeek,
  );

  const days: WeekDay[] = [];

  for (let i = 0; i < 7; i += 1) {
    const d = new Date(
      sunday.getFullYear(),
      sunday.getMonth(),
      sunday.getDate() + i,
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

