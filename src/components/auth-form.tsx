"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export default function AuthForm({ nextPath }: { nextPath: string }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const configured = isSupabaseConfigured();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!configured) { setMessage("Cloud accounts need Supabase setup. You can use the local demo for now."); return; }
    const supabase = createClient();
    if (!supabase) return;
    setBusy(true);
    const result = mode === "signin"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/auth/callback`, data: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" } } });
    setBusy(false);
    if (result.error) { setMessage(result.error.message); return; }
    if (mode === "signup" && !result.data.session) { setMessage("Check your email to confirm your account, then sign in here."); return; }
    router.replace(nextPath);
    router.refresh();
  }

  return <>
    <div className="auth-tabs" role="tablist" aria-label="Account access"><button role="tab" aria-selected={mode === "signin"} className={mode === "signin" ? "active" : ""} onClick={() => { setMode("signin"); setMessage(""); }}>Sign in</button><button role="tab" aria-selected={mode === "signup"} className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setMessage(""); }}>Create account</button></div>
    <form className="auth-form" onSubmit={submit}>
      <label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
      <label htmlFor="password">Password</label><div className="password-field"><input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} required placeholder="At least 8 characters" value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((shown) => !shown)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
      {message && <p className="form-message" role="status">{message}</p>}
      <button className="button button-primary auth-submit" disabled={busy} type="submit">{busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create your account"}<ArrowRight size={16} /></button>
    </form>
    {!configured && <a className="demo-link" href="/today">Continue with the local demo <ArrowRight size={14} /></a>}
  </>;
}
