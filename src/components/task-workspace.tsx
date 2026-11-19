"use client";

import { CSSProperties, FormEvent, useEffect, useMemo, useState } from "react";
import { AlarmClock, Bell, Check, ChevronDown, CircleHelp, Clock3, Pencil, Plus, Search, Sparkles, Sun, Trash2, X } from "lucide-react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { DaymarkTask, fromDateTimeLocal, localDateKey, makeStarterTasks, nextOccurrence, RepeatRule, STORAGE_KEY, toDateTimeLocal } from "@/lib/tasks";

type View = "today" | "all" | "upcoming" | "completed";
type Draft = { title: string; due: string; recurrence: RepeatRule };
const SENT_KEY = "daymark.reminders.sent.v2";

function sortTasks(tasks: DaymarkTask[]) {
  return [...tasks].sort((a, b) => (a.due_at ?? "9999").localeCompare(b.due_at ?? "9999") || String(a.created_at ?? a.id).localeCompare(String(b.created_at ?? b.id)));
}

function toApplicationServerKey(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

export default function TaskWorkspace({ view }: { view: View }) {
  const [tasks, setTasks] = useState<DaymarkTask[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [recurrence, setRecurrence] = useState<RepeatRule>("none");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editTask, setEditTask] = useState<DaymarkTask | null>(null);
  const [draft, setDraft] = useState<Draft>({ title: "", due: "", recurrence: "none" });
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [serverPushEnabled, setServerPushEnabled] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("default");
  const [dateLabel, setDateLabel] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const cloud = isSupabaseConfigured();
  const dateKey = dateLabel ? localDateKey(new Date()) : "";

  useEffect(() => {
    let alive = true;
    async function load() {
      setError("");
      const supabase = createClient();
      if (supabase) {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (!alive) return;
        if (authError || !auth.user) { setError("Your session could not be verified. Sign in again to load your tasks."); setReady(true); return; }
        const [{ data, error: taskError }, { data: subscriptions }, { data: profile }] = await Promise.all([
          supabase.from("tasks").select("id,user_id,title,due_at,completed_at,recurrence,recurrence_series_id,created_at").order("due_at", { ascending: true, nullsFirst: false }),
          supabase.from("push_subscriptions").select("id").eq("user_id", auth.user.id).limit(1),
          supabase.from("profiles").select("timezone").eq("user_id", auth.user.id).maybeSingle(),
        ]);
        if (!alive) return;
        if (taskError) setError(`Couldn’t load tasks: ${taskError.message}`);
        else setTasks((data ?? []) as DaymarkTask[]);
        setServerPushEnabled(Boolean(subscriptions?.length));
        if (profile?.timezone) setTimezone(profile.timezone);
      } else {
        try {
          const saved = window.localStorage.getItem(STORAGE_KEY);
          setTasks(saved ? JSON.parse(saved) as DaymarkTask[] : makeStarterTasks());
        } catch { setTasks(makeStarterTasks()); }
      }
      setNotificationPermission("Notification" in window ? window.Notification.permission : "unsupported");
      setCurrentTime(Date.now());
      setDateLabel(new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date()));
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
      setReady(true);
    }
    void load();
    const clock = window.setInterval(() => setCurrentTime(Date.now()), 30_000);
    return () => { alive = false; window.clearInterval(clock); };
  }, []);

  useEffect(() => {
    if (!ready || cloud) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks, ready, cloud]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!ready || notificationPermission !== "granted" || serverPushEnabled || cloud) return;
    const sendDue = () => {
      const now = Date.now();
      let sent: string[] = [];
      try { sent = JSON.parse(window.localStorage.getItem(SENT_KEY) ?? "[]") as string[]; } catch { sent = []; }
      let changed = false;
      for (const task of tasks) {
        if (!task.due_at || task.completed_at) continue;
        const moment = new Date(task.due_at).getTime();
        const key = `${task.id}:${task.due_at}`;
        if (moment > now || now - moment > 90_000 || sent.includes(key)) continue;
        sent.push(key); changed = true;
        try {
      const notification = new window.Notification("Daymark reminder", { body: task.title, tag: key });
          notification.onclick = () => { window.focus(); notification.close(); };
        } catch { setToast("A task is due, but this browser can’t show an alert here."); }
      }
      if (changed) window.localStorage.setItem(SENT_KEY, JSON.stringify(sent));
    };
    sendDue();
    const timer = window.setInterval(sendDue, 15_000);
    return () => window.clearInterval(timer);
  }, [tasks, ready, notificationPermission, serverPushEnabled, cloud]);

  const openTasks = tasks.filter((task) => !task.completed_at);
  const completedToday = tasks.filter((task) => task.completed_at && localDateKey(new Date(task.completed_at)) === dateKey);
  const todayOpen = openTasks.filter((task) => !task.due_at || localDateKey(new Date(task.due_at)) <= dateKey);
  const futureOpen = openTasks.filter((task) => task.due_at && localDateKey(new Date(task.due_at)) > dateKey);
  const todayTotal = todayOpen.length + completedToday.length;
  const progress = todayTotal ? Math.round(completedToday.length / todayTotal * 100) : 0;
  const viewTasks = view === "today" ? todayOpen : view === "upcoming" ? futureOpen : view === "completed" ? tasks.filter((task) => Boolean(task.completed_at)) : tasks;
  const displayedTasks = useMemo(() => {
    const filtered = query.trim() ? viewTasks.filter((task) => task.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) : viewTasks;
    return sortTasks(filtered);
  }, [viewTasks, query]);
  const upcomingReminders = sortTasks(futureOpen).slice(0, 3);
  const viewNames: Record<View, string> = { today: "Today", all: "All tasks", upcoming: "Upcoming", completed: "Completed" };
  const heading = viewNames[view];

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = title.trim();
    if (!clean || clean.length > 240) { setError("Keep task names between 1 and 240 characters."); return; }
    setBusy(true); setError("");
    const supabase = createClient();
    const due_at = fromDateTimeLocal(due);
    if (supabase) {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { setError("Sign in to save your task."); setBusy(false); return; }
      const payload = { user_id: auth.user.id, title: clean, due_at, recurrence, recurrence_series_id: recurrence === "none" ? null : crypto.randomUUID() };
      const { data, error: insertError } = await supabase.from("tasks").insert(payload).select().single();
      if (insertError) setError(`Couldn’t add the task: ${insertError.message}`);
      else if (data) setTasks((previous) => sortTasks([data as DaymarkTask, ...previous]));
    } else {
      const newTask: DaymarkTask = { id: crypto.randomUUID(), title: clean, due_at, completed_at: null, created_at: new Date().toISOString(), recurrence, recurrence_series_id: recurrence === "none" ? undefined : crypto.randomUUID() };
      setTasks((previous) => sortTasks([newTask, ...previous]));
    }
    setBusy(false);
    setTitle(""); setDue(""); setRecurrence("none"); setDetailsOpen(false);
    setToast("Added to your day");
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editTask) return;
    const clean = draft.title.trim();
    if (!clean || clean.length > 240) { setError("Keep task names between 1 and 240 characters."); return; }
    setBusy(true); setError("");
    const updates = { title: clean, due_at: fromDateTimeLocal(draft.due), recurrence: draft.recurrence, recurrence_series_id: draft.recurrence === "none" ? null : (editTask.recurrence_series_id || crypto.randomUUID()) };
    const supabase = createClient();
    if (supabase) {
      const { data, error: updateError } = await supabase.from("tasks").update(updates).eq("id", editTask.id).select().single();
      if (updateError) setError(`Couldn’t save changes: ${updateError.message}`);
      else if (data) setTasks((previous) => previous.map((task) => task.id === editTask.id ? data as DaymarkTask : task));
    } else setTasks((previous) => previous.map((task) => task.id === editTask.id ? { ...task, ...updates } as DaymarkTask : task));
    setBusy(false); setEditTask(null); setToast("Changes saved");
  }

  async function toggleTask(task: DaymarkTask) {
    setError("");
    const supabase = createClient();
    if (supabase) {
      const { error: rpcError } = await supabase.rpc(task.completed_at ? "undo_task_completion" : "complete_task", { p_task_id: task.id });
      if (rpcError) { setError(`Couldn’t update this task: ${rpcError.message}`); return; }
      const { data, error: loadError } = await supabase.from("tasks").select("id,user_id,title,due_at,completed_at,recurrence,recurrence_series_id,created_at").order("due_at", { ascending: true, nullsFirst: false });
      if (loadError) setError(`Task changed, but the list could not refresh: ${loadError.message}`);
      else setTasks((data ?? []) as DaymarkTask[]);
    } else if (task.completed_at) {
      const dueAt = task.recurrence_series_id ? tasks.find((row) => row.recurrence_series_id === task.recurrence_series_id && row.id !== task.id && !row.completed_at) : undefined;
      setTasks((previous) => previous.filter((row) => !dueAt || row.id !== dueAt.id).map((row) => row.id === task.id ? { ...row, completed_at: null } : row));
    } else {
      const completedAt = new Date();
      const nextDue = nextOccurrence(task, completedAt, timezone);
      const next = nextDue ? { ...task, id: crypto.randomUUID(), due_at: nextDue, completed_at: null, created_at: completedAt.toISOString() } : null;
      setTasks((previous) => sortTasks([...previous.map((row) => row.id === task.id ? { ...row, completed_at: completedAt.toISOString() } : row), ...(next ? [next] : [])]));
    }
    setToast(task.completed_at ? "Task moved back to your list" : task.recurrence === "none" ? "Nice work. One less thing to think about." : "Done for now. The next one is on your list.");
  }

  async function deleteTask(task: DaymarkTask) {
    if (!window.confirm(`Delete “${task.title}”? This can’t be undone.`)) return;
    const supabase = createClient();
    if (supabase) {
      const { error: deleteError } = await supabase.from("tasks").delete().eq("id", task.id);
      if (deleteError) { setError(`Couldn’t delete this task: ${deleteError.message}`); return; }
    }
    setTasks((previous) => previous.filter((row) => row.id !== task.id));
    setToast("Task deleted");
  }

  async function enableReminders() {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) { setNotificationPermission("unsupported"); setToast("This browser doesn’t support web notifications."); return; }
    const permission = await window.Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission !== "granted") { setToast("Notifications are off. Due tasks remain visible in Daymark."); return; }
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const supabase = createClient();
    if (!vapidKey || !supabase) { setToast("Alerts are allowed. Keep Daymark open for reminders in preview mode."); return; }
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toApplicationServerKey(vapidKey) });
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Sign in again to save this device.");
      const json = subscription.toJSON();
      const { error: saveError } = await supabase.from("push_subscriptions").upsert({ user_id: auth.user.id, endpoint: subscription.endpoint, p256dh: json.keys?.p256dh, auth_secret: json.keys?.auth }, { onConflict: "endpoint" });
      if (saveError) throw saveError;
      setServerPushEnabled(true);
      setToast("Background reminders are set up for this browser.");
    } catch (caught) {
      setToast(caught instanceof Error ? caught.message : "Couldn’t set up push reminders. Try again in Settings.");
    }
  }

  const formatTime = (value: string) => new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value));
  const dueStatus = (task: DaymarkTask) => task.due_at && !task.completed_at && new Date(task.due_at).getTime() < currentTime ? "overdue" : "";

  useEffect(() => {
    if (!ready) return;
    const selectedId = new URLSearchParams(window.location.search).get("task");
    if (!selectedId) return;
    const row = document.getElementById(`task-${selectedId}`);
    row?.scrollIntoView({ behavior: "smooth", block: "center" });
    row?.classList.add("task-highlight");
    const timeout = window.setTimeout(() => row?.classList.remove("task-highlight"), 2200);
    return () => window.clearTimeout(timeout);
  }, [ready, tasks]);

  const countLabel = `${displayedTasks.length} ${displayedTasks.length === 1 ? "task" : "tasks"}`;
  const todayTitle = view === "today" ? "A good day to make a little progress." : heading;
  const greetings = view === "today" ? "Take it one thing at a time. You’ve got this." : view === "upcoming" ? "A quick look at what’s ahead." : view === "completed" ? "Everything you’ve taken care of." : "Every task you’re keeping in view.";

  return <>
    <section className="workspace-heading">
      <div><p className="date-line">{dateLabel}</p><h1>{todayTitle}</h1><p className="welcome-note">{greetings}</p></div>
      {view === "today" && <div className="progress-widget" aria-label={`${progress}% of today’s tasks complete`}><div className="progress-ring" style={{ "--progress": `${progress}%` } as CSSProperties}><span>{progress}<small>%</small></span></div><div className="progress-copy"><strong>{completedToday.length} of {todayTotal}</strong><span>tasks complete</span></div></div>}
    </section>

    {view === "today" && <section className="today-overview"><div className="overview-bar"><span className="overview-icon"><Sparkles size={15} /></span><span>Today, at your pace</span><div className="overview-track"><span style={{ width: `${progress}%` }} /></div><strong>{completedToday.length}/{todayTotal}</strong></div><div className="overview-side"><span className="overview-time"><Clock3 size={14} /> {timezone.replaceAll("_", " ")}</span><span>{upcomingReminders.length ? `${upcomingReminders.length} coming up` : "Your day is yours"}</span></div></section>}

    {error && <div className="inline-error" role="alert"><CircleHelp size={16} /><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError("")}><X size={15} /></button></div>}

    {view === "today" && upcomingReminders.length > 0 && <aside className="reminder-preview" aria-label="Upcoming reminders"><span className="reminder-preview-icon"><Bell size={16} /></span><div className="reminder-preview-copy"><strong>Coming up</strong><span>{upcomingReminders.slice(0, 2).map((task) => `${task.title} at ${formatTime(task.due_at!)}`).join(" · ")}</span></div><button onClick={enableReminders}>{notificationPermission === "granted" ? "Alerts on" : "Set reminders"}<ChevronDown size={14} /></button></aside>}

    <section className="task-section" aria-labelledby="task-list-title">
      <div className="section-heading"><div className="section-title"><h2 id="task-list-title">{view === "today" ? "Your list" : heading}</h2><span className="task-total">{countLabel}</span></div><div className="section-actions">{view !== "today" && <button className="icon-button" aria-label="Search tasks" onClick={() => { setSearchOpen((open) => !open); setQuery(""); }}><Search size={17} /></button>}{view === "today" && <span className="list-date"><span className="list-live-dot" /> Today</span>}</div></div>
      {searchOpen && <label className="search-field"><Search size={16} /><span className="sr-only">Search your tasks</span><input autoComplete="off" placeholder="Search your tasks…" value={query} onChange={(event) => setQuery(event.target.value)} /><button type="button" aria-label="Close search" onClick={() => { setSearchOpen(false); setQuery(""); }}><X size={15} /></button></label>}
      {view !== "completed" && <form className="quick-add" onSubmit={addTask}><span className="add-icon"><Plus size={18} /></span><label className="sr-only" htmlFor="new-task">Add a task</label><input id="new-task" name="task" maxLength={240} autoComplete="off" placeholder="Add a task to your day…" value={title} onChange={(event) => setTitle(event.target.value)} /><button className={`detail-toggle ${detailsOpen ? "selected" : ""}`} type="button" aria-label="Set a reminder or repeat" aria-expanded={detailsOpen} onClick={() => setDetailsOpen((open) => !open)}><AlarmClock size={17} /></button>{title.trim() && <button className="add-submit" type="submit" disabled={busy}>{busy ? "Adding…" : "Add task"}</button>}{detailsOpen && <div className="add-details"><label className="detail-control"><span>Remind me</span><input type="datetime-local" value={due} onChange={(event) => setDue(event.target.value)} /></label><label className="detail-control"><span>Repeat</span><select value={recurrence} onChange={(event) => setRecurrence(event.target.value as RepeatRule)}><option value="none">Doesn’t repeat</option><option value="daily">Every day</option><option value="weekly">Every week</option></select></label></div>}</form>}
      {!ready ? <div className="loading-state"><span className="loading-dot" /> Bringing your day into view…</div> : displayedTasks.length ? <div className="task-list">{displayedTasks.map((task) => <article className={`task-row ${task.completed_at ? "completed" : ""}`} key={task.id} id={`task-${task.id}`}><button className="task-check" aria-label={task.completed_at ? `Undo ${task.title}` : `Complete ${task.title}`} onClick={() => void toggleTask(task)}>{task.completed_at && <Check size={14} strokeWidth={2.7} />}</button><div className="task-main"><div className="task-title-line"><p className="task-title">{task.title}</p>{task.recurrence !== "none" && <span className="repeat-pill">{task.recurrence === "daily" ? "Daily" : "Weekly"}</span>}</div>{task.due_at && <span className={`task-time ${dueStatus(task)}`}><Clock3 size={13} />{formatTime(task.due_at)}{dueStatus(task) && <span className="overdue-label">Overdue</span>}</span>}</div><div className="task-actions"><button className="row-action" aria-label={`Edit ${task.title}`} onClick={() => { setEditTask(task); setDraft({ title: task.title, due: toDateTimeLocal(task.due_at), recurrence: task.recurrence }); setError(""); }}><Pencil size={15} /></button><button className="row-action delete-task" aria-label={`Delete ${task.title}`} onClick={() => void deleteTask(task)}><Trash2 size={15} /></button></div></article>)}</div> : <div className="empty-state"><span className="empty-art">{view === "completed" ? <Check size={23} /> : <Sun size={23} />}</span><h3>{query ? "No matching tasks" : view === "today" ? "Your day has room to breathe" : view === "upcoming" ? "Nothing planned ahead" : view === "completed" ? "Nothing checked off yet" : "Your list is clear"}</h3><p>{query ? "Try a different word." : view === "today" ? "Add one small thing you’d like to get done." : view === "upcoming" ? "Add a future date to a task and it’ll appear here." : view === "completed" ? "Tasks you finish will collect here." : "Add the tasks you want to keep in view."}</p></div>}
      {view === "today" && <div className="gentle-note"><span className="note-mark"><Sun size={14} /></span><span>Small steps still move you forward.</span><span className="done-inline">{completedToday.length} done today</span></div>}
    </section>

    {editTask && <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditTask(null); }}><section className="edit-dialog" role="dialog" aria-modal="true" aria-labelledby="edit-heading"><div className="dialog-head"><div><p>MAKE IT FIT YOUR DAY</p><h2 id="edit-heading">Edit task</h2></div><button className="icon-button" aria-label="Close edit dialog" onClick={() => setEditTask(null)}><X size={18} /></button></div><form onSubmit={(event) => void saveEdit(event)}><label className="detail-control"><span>Task</span><input autoFocus value={draft.title} maxLength={240} onChange={(event) => setDraft({ ...draft, title: event.target.value })} required /></label><label className="detail-control"><span>Reminder</span><input type="datetime-local" value={draft.due} onChange={(event) => setDraft({ ...draft, due: event.target.value })} /></label><label className="detail-control"><span>Repeat</span><select value={draft.recurrence} onChange={(event) => setDraft({ ...draft, recurrence: event.target.value as RepeatRule })}><option value="none">Doesn’t repeat</option><option value="daily">Every day</option><option value="weekly">Every week</option></select></label><div className="dialog-actions"><button type="button" className="button button-quiet" onClick={() => setEditTask(null)}>Cancel</button><button type="submit" className="button button-primary" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button></div></form></section></div>}
    <div className="toast" aria-live="polite" data-visible={Boolean(toast)}>{toast}<button aria-label="Dismiss message" onClick={() => setToast("")}><X size={14} /></button></div>
  </>;
}
