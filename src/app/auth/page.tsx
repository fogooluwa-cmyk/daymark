import Link from "next/link";
import AuthForm from "@/components/auth-form";
import { Sun } from "lucide-react";

export default async function AuthPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const requestedNext = (await searchParams).next;
  const nextPath = typeof requestedNext === "string" && requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/today";
  return <main className="auth-page"><Link className="brand auth-brand" href="/"><span className="brand-mark"><Sun size={18} /></span><span>daymark</span></Link><section className="auth-card"><div className="auth-mark"><Sun size={20} /></div><p className="auth-kicker">YOUR DAY, IN VIEW</p><h1>Welcome to a little more clarity.</h1><p className="auth-subtitle">Sign in or create your free personal space.</p><AuthForm nextPath={nextPath} /><Link className="auth-back" href="/">Back to Daymark</Link></section><p className="auth-footnote">Your tasks belong to you. Daymark keeps them private.</p></main>;
}
