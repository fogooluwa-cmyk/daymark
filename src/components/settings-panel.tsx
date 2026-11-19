"use client";

import { useEffect, useState } from "react";
import { Bell, Clock3, MoonStar, ShieldCheck, Sun, SunMedium, Globe2, CircleHelp } from "lucide-react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export default function SettingsPanel() {
  const [theme, setTheme] = useState("light");
  const [timezone, setTimezone] = useState("UTC");
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [saved, setSaved] = useState("");
  const [loading, setLoading] = useState(true);
  const [pushConfigured, setPushConfigured] = useState(false);
  const demo = !isSupabaseConfigured();

  useEffect(() => {
    let active = true;
    const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const startup = window.setTimeout(() => {
      if (!active) return;
      setTheme(window.localStorage.getItem("daymark.theme") ?? "light");
      setTimezone(localZone);
      setPermission("Notification" in window ? window.Notification.permission : "unsupported");
    }, 0);
    async function load() {
      const supabase = createClient();
      if (supabase) {
        const { data: auth } = await supabase.auth.getUser();
        if (!active) return;
        if (auth.user) {
          setEmail(auth.user.email ?? "");
          const [{ data: profile }, { data: subs }] = await Promise.all([
            supabase.from("profiles").select("timezone,display_name").eq("user_id", auth.user.id).maybeSingle(),
            supabase.from("push_subscriptions").select("id").eq("user_id", auth.user.id).limit(1),
          ]);
          if (active && profile?.timezone) setTimezone(profile.timezone);
          if (active) setPushConfigured(Boolean(subs?.length));
        }
      }
      if (active) setLoading(false);
    }
    void load();
    return () => { active = false; window.clearTimeout(startup); };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function changeTheme(next: string) {
    setTheme(next);
    window.localStorage.setItem("daymark.theme", next);
    setSaved("Appearance updated");
  }

  async function saveTimezone() {
    setSaved("");
    const supabase = createClient();
    if (!supabase) {
      window.localStorage.setItem("daymark.timezone", timezone);
      setSaved("Timezone saved on this browser");
      return;
    }
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setSaved("Sign in again to update your profile."); return; }
    const { error } = await supabase.from("profiles").upsert({ user_id: auth.user.id, timezone, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    setSaved(error ? `Couldn’t save timezone: ${error.message}` : "Timezone saved to your account");
  }

  async function enableNotifications() {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) { setPermission("unsupported"); setSaved("This browser does not support web push."); return; }
    const result = await window.Notification.requestPermission();
    setPermission(result);
    if (result !== "granted") { setSaved("Notifications are off. Due tasks remain visible in Daymark."); return; }
    const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const supabase = createClient();
    if (!key || !supabase) { setSaved("Browser alerts are allowed. Keep Daymark open for preview reminders."); return; }
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const appKey = Uint8Array.from(atob(key.replace(/-/g, "+").replace(/_/g, "/") + "==="), (character) => character.charCodeAt(0));
      const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey });
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Sign in again to save this device.");
      const keys = subscription.toJSON().keys;
      const { error } = await supabase.from("push_subscriptions").upsert({ user_id: auth.user.id, endpoint: subscription.endpoint, p256dh: keys?.p256dh, auth_secret: keys?.auth }, { onConflict: "endpoint" });
      if (error) throw error;
      setPushConfigured(true); setSaved("Background reminders are ready for this browser.");
    } catch (error) { setSaved(error instanceof Error ? error.message : "Couldn’t enable reminders."); }
  }

  async function disableNotifications() {
    const registration = await navigator.serviceWorker?.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      const supabase = createClient();
      if (supabase) await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
    }
    setPushConfigured(false);
    setSaved("This browser is no longer subscribed. You can re-enable alerts any time.");
  }

  const toggleTheme = (next: string) => <button className={`theme-choice ${theme === next ? "selected" : ""}`} onClick={() => changeTheme(next)} aria-pressed={theme === next}>{next === "light" ? <SunMedium size={17} /> : <MoonStar size={17} />}{next === "light" ? "Light" : "Dark"}{theme === next && <span className="choice-check"><Sun size={11} /></span>}</button>;

  return <section className="settings-page"><div className="settings-heading"><p className="date-line">YOUR SPACE</p><h1>Make Daymark feel like yours.</h1><p className="welcome-note">A few small preferences for a day that fits you.</p></div>
    <div className="settings-grid">
      <section className="settings-card"><div className="settings-card-heading"><span className="settings-icon"><SunMedium size={17} /></span><div><h2>Appearance</h2><p>Choose the look that feels comfortable.</p></div></div><div className="theme-choices">{toggleTheme("light")}{toggleTheme("dark")}</div></section>
      <section className="settings-card"><div className="settings-card-heading"><span className="settings-icon"><Globe2 size={17} /></span><div><h2>Time zone</h2><p>Used to show reminders at your local time.</p></div></div><label className="setting-field"><span>Your time zone</span><select value={timezone} onChange={(event) => setTimezone(event.target.value)}>{[timezone, "Europe/London", "America/New_York", "America/Los_Angeles", "Asia/Kolkata", "Asia/Tokyo", "Australia/Sydney", "UTC"].filter((zone, index, all) => all.indexOf(zone) === index).map((zone) => <option key={zone} value={zone}>{zone.replaceAll("_", " ")}</option>)}</select></label><button className="button button-secondary setting-save" onClick={() => void saveTimezone()} disabled={loading}>Save time zone</button></section>
      <section className="settings-card"><div className="settings-card-heading"><span className="settings-icon settings-icon-gold"><Bell size={17} /></span><div><h2>Reminders</h2><p>Choose whether Daymark can send notifications to this browser.</p></div></div><div className="reminder-setting"><span className={`permission-indicator ${permission === "granted" ? "granted" : ""}`} /><span>{permission === "unsupported" ? "This browser doesn’t support notifications" : permission === "granted" ? pushConfigured ? "Background push is connected" : "Browser permission is on" : permission === "denied" ? "Blocked in browser settings" : "Not enabled"}</span></div><div className="setting-actions">{pushConfigured ? <button className="button button-secondary" onClick={() => void disableNotifications()}>Turn off on this browser</button> : <button className="button button-primary" onClick={() => void enableNotifications()} disabled={permission === "unsupported"}><Bell size={15} /> Enable reminders</button>}</div><p className="setting-note"><Clock3 size={14} />{pushConfigured ? "Scheduled reminders are checked every minute. Delivery still depends on browser and device settings." : "Browser reminders need permission and Daymark to stay open."}</p></section>
      <section className="settings-card account-card"><div className="settings-card-heading"><span className="settings-icon"><ShieldCheck size={17} /></span><div><h2>Account and privacy</h2><p>{demo ? "Tasks are saved only in this browser." : "Your tasks are private to your account."}</p></div></div><div className="account-detail"><span>{demo ? "Demo Mode" : "Signed in as"}</span><strong>{loading ? "Loading…" : demo ? "This browser only" : email || "Your account"}</strong></div><p className="setting-note"><CircleHelp size={14} />{demo ? "Tasks in this browser are not synced across devices." : "Row Level Security keeps task rows scoped to your signed-in account."}</p></section>
    </div>
    {saved && <p className="settings-feedback" role="status">{saved}</p>}
  </section>;
}
