"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUpRight, Check, Clock3, LogOut, Settings2, Sun, SunMedium, MoonStar, ListChecks } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const links = [
  { href: "/today", label: "Today", icon: Sun },
  { href: "/tasks", label: "All tasks", icon: ListChecks },
  { href: "/upcoming", label: "Upcoming", icon: Clock3 },
  { href: "/completed", label: "Completed", icon: Check },
];

export default function WorkspaceShell({ children, email, demo }: { children: React.ReactNode; email: string | null; demo: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const initials = (email?.[0] ?? "Y").toUpperCase();

  function toggleTheme() {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("daymark.theme", next);
  }

  async function signOut() {
    const supabase = createClient();
    if (supabase) await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  return <div className="workspace-shell">
    <a className="skip-link" href="#workspace-main">Skip to content</a>
    <aside className="sidebar">
      <Link className="brand" href="/today"><span className="brand-mark"><Sun size={18} /></span><span>daymark</span></Link>
      <div className="sidebar-label">YOUR SPACE</div>
      <nav className="nav-list" aria-label="Main navigation">{links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`nav-item ${pathname === href ? "active" : ""}`} aria-current={pathname === href ? "page" : undefined}><Icon size={17} /><span>{label}</span>{href === "/today" && <span className="nav-count">Today</span>}</Link>)}</nav>
      <div className="sidebar-bottom">
        {demo && <div className="demo-card"><span className="demo-dot" /><div><strong>Preview mode</strong><p>Tasks save in this browser.</p></div></div>}
        <div className="sidebar-utility"><Link className={`nav-item ${pathname === "/settings" ? "active" : ""}`} href="/settings"><Settings2 size={17} /><span>Settings</span></Link><button className="nav-item theme-button" onClick={toggleTheme}><span className="theme-icons"><SunMedium size={16} /><MoonStar size={16} /></span><span>Switch appearance</span></button></div>
        <div className="profile-row"><span className="profile-avatar">{initials}</span><span className="profile-copy"><strong>{email?.split("@")[0] ?? "Your space"}</strong><small>{demo ? "Local demo" : email}</small></span><button className="signout-button" aria-label={demo ? "Return to home" : "Sign out"} onClick={signOut}><LogOut size={16} /></button></div>
      </div>
    </aside>
    <div className="workspace-column">
      <header className="topbar"><div className="breadcrumb"><span>My space</span><span className="crumb-slash">/</span><strong>{links.find((item) => item.href === pathname)?.label ?? (pathname === "/settings" ? "Settings" : "Daymark")}</strong></div><div className="topbar-actions"><span className="topbar-message"><span className="topbar-spark" />One thing at a time</span><Link className="topbar-settings" href="/settings" aria-label="Settings"><Settings2 size={17} /></Link></div></header>
      <div id="workspace-main" className="workspace-content">{children}<footer className="workspace-footer"><span>Daymark gives your day a little more space.</span><Link href="/settings">Your preferences <ArrowUpRight size={13} /></Link></footer></div>
    </div>
    <nav className="mobile-nav" aria-label="Mobile navigation">{links.slice(0, 4).map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={pathname === href ? "active" : ""} aria-current={pathname === href ? "page" : undefined}><Icon size={18} /><span>{label === "Completed" ? "Done" : label}</span></Link>)}</nav>
  </div>;
}
