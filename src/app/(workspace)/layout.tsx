import { redirect } from "next/navigation";
import WorkspaceShell from "@/components/workspace-shell";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export default async function WorkspaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  let email: string | null = null;
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data } = await supabase!.auth.getClaims();
    if (!data?.claims) redirect("/auth?next=/today");
    email = typeof data.claims.email === "string" ? data.claims.email : null;
  }
  return <WorkspaceShell email={email} demo={!isSupabaseConfigured()}>{children}</WorkspaceShell>;
}
