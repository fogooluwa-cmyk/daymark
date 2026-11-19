export type RepeatRule = "none" | "daily" | "weekly";
export type DaymarkTask = {
  id: string;
  user_id?: string;
  title: string;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
  recurrence: RepeatRule;
  recurrence_series_id?: string;
};

export const STORAGE_KEY = "daymark.tasks.v1";

export function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function toDateTimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function fromDateTimeLocal(value: string) {
  return value ? new Date(value).toISOString() : null;
}

export function makeStarterTasks(now = new Date()): DaymarkTask[] {
  const today = localDateKey(now);
  const at = (time: string) => new Date(`${today}T${time}:00`).toISOString();
  const created_at = now.toISOString();
  return [
    { id: crypto.randomUUID(), title: "Take smoothie out of the fridge", due_at: at("08:30"), completed_at: null, created_at, recurrence: "none" },
    { id: crypto.randomUUID(), title: "Send the project update", due_at: at("10:00"), completed_at: null, created_at, recurrence: "none" },
    { id: crypto.randomUUID(), title: "Pick up a few groceries", due_at: at("17:30"), completed_at: null, created_at, recurrence: "none" },
    { id: crypto.randomUUID(), title: "Take a proper lunch break", due_at: at("12:30"), completed_at: at("12:34"), created_at, recurrence: "daily", recurrence_series_id: "demo-lunch" },
  ];
}

export function nextOccurrence(task: DaymarkTask, completedAt = new Date(), timezone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  if (task.recurrence === "none") return null;
  const original = task.due_at ? new Date(task.due_at) : completedAt;
  const target = new Date(original);
  const add = task.recurrence === "daily" ? 1 : 7;
  target.setDate(target.getDate() + add);
  while (target <= completedAt) target.setDate(target.getDate() + add);
  // setDate uses the browser's local zone, preserving wall-clock time over DST changes.
  void timezone;
  return target.toISOString();
}
