import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Sign-in required." }, 401);

  const callerClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: authData, error: authError } = await callerClient.auth.getUser();
  if (authError || !authData.user) return json({ error: "Session is invalid or expired." }, 401);
  const service = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: caller, error: callerError } = await service.from("profiles")
    .select("id,email,role").eq("id", authData.user.id).maybeSingle();
  if (callerError || !caller || caller.role !== "admin") return json({ error: "Administrator access required." }, 403);
  const { data: mainValue, error: mainError } = await callerClient.rpc("is_super_admin");
  if (mainError) return json({ error: "Apply admin_access.sql before deploying this function." }, 500);
  const callerIsMain = mainValue === true;
  const { data: protectedRows, error: protectedError } = await service.from("super_admin_emails").select("email");
  if (protectedError) return json({ error: protectedError.message }, 500);
  const protectedEmails = (protectedRows || []).map((r) => String(r.email).toLowerCase());

  let body: { action?: string; user_id?: string; email?: string; can_free_time?: boolean };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body." }, 400); }
  const action = body.action || "";

  if (action === "get_controls") {
    const { data, error } = await service.from("email_domain_exceptions").select("email,created_at").order("email");
    if (error) return json({ error: error.message }, 500);
    return json({ main_admin_emails: protectedEmails, exceptions: data || [], caller_is_main: callerIsMain });
  }

  if (action === "add_exception" || action === "remove_exception") {
    if (!callerIsMain) return json({ error: "Only main administrators can manage email exceptions." }, 403);
    const email = String(body.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Enter a valid email address." }, 400);
    if (email.endsWith("@novaposhta.ua")) return json({ error: "Addresses at @novaposhta.ua do not need an exception." }, 400);
    const result = action === "add_exception"
      ? await service.from("email_domain_exceptions").upsert({ email, created_by: authData.user.id }, { onConflict: "email" })
      : await service.from("email_domain_exceptions").delete().eq("email", email);
    if (result.error) return json({ error: result.error.message }, 500);
    return json({ ok: true });
  }

  if (action === "set_admin" || action === "set_free_time" || action === "delete_user") {
    const userId = String(body.user_id || "");
    if (!userId) return json({ error: "User ID is required." }, 400);
    const { data: target, error } = await service.from("profiles").select("id,email,role")
      .eq("id", userId).maybeSingle();
    if (error || !target) return json({ error: "User profile was not found." }, 404);
    const targetIsMain = protectedEmails.includes(String(target.email).toLowerCase());

    if (action === "set_admin") {
      if (!callerIsMain) return json({ error: "Only main administrators can grant or remove administrator access." }, 403);
      if (targetIsMain) return json({ error: "Main administrator access is protected." }, 403);
      const grant = body.can_free_time === true;
      const update = grant ? { role: "admin" } : { role: "user", can_free_time: false };
      const { error: updateError } = await service.from("profiles").update(update).eq("id", userId);
      if (updateError) return json({ error: updateError.message }, 500);
      return json({ ok: true });
    }
    if (action === "set_free_time") {
      if (target.role === "admin") return json({ error: "Administrator access already includes this feature." }, 400);
      const { error: updateError } = await service.from("profiles")
        .update({ can_free_time: body.can_free_time === true }).eq("id", userId);
      if (updateError) return json({ error: updateError.message }, 500);
      return json({ ok: true });
    }

    if (userId === authData.user.id) return json({ error: "You cannot delete your own account from this panel." }, 403);
    if (targetIsMain) return json({ error: "Main administrator accounts cannot be deleted here." }, 403);
    if (target.role === "admin" && !callerIsMain) return json({ error: "Only a main administrator can delete another administrator." }, 403);
    const { error: deleteError } = await service.auth.admin.deleteUser(userId);
    if (deleteError) return json({ error: deleteError.message }, 500);
    return json({ ok: true });
  }
  return json({ error: "Unknown action." }, 400);
});
