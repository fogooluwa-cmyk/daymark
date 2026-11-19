import { createClient } from "supabase";
import webpush from "web-push";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const expectedSecret = Deno.env.get("REMINDER_CRON_SECRET");
  if (!expectedSecret || request.headers.get("x-cron-secret") !== expectedSecret) return json({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT") || "mailto:hello@daymark.app";
  const appOrigin = Deno.env.get("APP_ORIGIN");
  if (!supabaseUrl || !serviceKey || !publicKey || !privateKey || !appOrigin) return json({ error: "Reminder service is not fully configured" }, 503);

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  webpush.setVapidDetails(subject, publicKey, privateKey);
  const cutoff = new Date(Date.now() - 10 * 60_000).toISOString();
  const { data: dueTasks, error: queryError } = await supabase.from("tasks")
    .select("id,user_id,title,due_at")
    .is("completed_at", null)
    .not("due_at", "is", null)
    .lte("due_at", new Date().toISOString())
    .gte("due_at", cutoff)
    .limit(500);
  if (queryError) return json({ error: queryError.message }, 500);

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (const task of dueTasks ?? []) {
    const { data: subscriptions, error: subError } = await supabase.from("push_subscriptions")
      .select("id,endpoint,p256dh,auth_secret")
      .eq("user_id", task.user_id);
    if (subError) { failed++; continue; }
    for (const subscription of subscriptions ?? []) {
      const { data: deliveryId, error: claimError } = await supabase.rpc("claim_reminder", {
        p_task_id: task.id, p_due_at: task.due_at, p_subscription_id: subscription.id,
      });
      if (claimError) { failed++; continue; }
      if (!deliveryId) { skipped++; continue; }
      const payload = JSON.stringify({
        title: "A little reminder",
        body: task.title,
        taskId: task.id,
        tag: `${task.id}-${task.due_at}`,
        url: `${appOrigin}/today?task=${encodeURIComponent(task.id)}`,
      });
      try {
        await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth_secret } }, payload, { TTL: 60 * 60 });
        await supabase.rpc("finish_reminder", { p_delivery_id: deliveryId, p_success: true, p_error: null });
        await supabase.from("push_subscriptions").update({ last_used_at: new Date().toISOString() }).eq("id", subscription.id);
        sent++;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await supabase.from("push_subscriptions").delete().eq("id", subscription.id);
        await supabase.rpc("finish_reminder", { p_delivery_id: deliveryId, p_success: false, p_error: error instanceof Error ? error.message : "Push delivery failed" });
        failed++;
      }
    }
  }
  return json({ checked: dueTasks?.length ?? 0, sent, failed, skipped });
});
