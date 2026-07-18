import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const logInput = z.object({
  duration_sec: z.number().int().min(1).max(60 * 60 * 6),
  lesson_id: z.string().uuid().nullable().optional(),
  tools: z.record(z.string(), z.any()).default({}),
  notes: z.string().max(1000).nullable().optional(),
});

export const logPracticeSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => logInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const now = new Date();
    const started = new Date(now.getTime() - data.duration_sec * 1000).toISOString();
    const { error } = await supabase.from("practice_sessions").insert({
      user_id: userId,
      started_at: started,
      ended_at: now.toISOString(),
      duration_sec: data.duration_sec,
      lesson_id: data.lesson_id ?? null,
      tools: data.tools,
      notes: data.notes ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listPracticeSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("practice_sessions")
      .select("id, started_at, duration_sec, lesson_id, tools, notes")
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(120);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [profile, settings] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle(),
    ]);
    if (profile.error) throw new Error(profile.error.message);
    if (settings.error) throw new Error(settings.error.message);
    return { profile: profile.data, settings: settings.data };
  });

const profileInput = z.object({
  display_name: z.string().min(1).max(80),
  tradition: z.enum(["hindustani", "carnatic", "both"]),
  default_sa: z.string().min(1).max(4),
  voice_type: z.string().max(40).nullable().optional(),
});

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => profileInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: data.display_name,
        tradition: data.tradition,
        default_sa: data.default_sa,
        voice_type: data.voice_type ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    await supabase
      .from("user_settings")
      .upsert({ user_id: userId, default_sa: data.default_sa, updated_at: new Date().toISOString() });
    return { ok: true };
  });

export const markLessonComplete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ lesson_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("lesson_progress")
      .select("times_practiced")
      .eq("user_id", userId)
      .eq("lesson_id", data.lesson_id)
      .maybeSingle();
    const { error } = await supabase.from("lesson_progress").upsert({
      user_id: userId,
      lesson_id: data.lesson_id,
      completed_at: new Date().toISOString(),
      times_practiced: (existing?.times_practiced ?? 0) + 1,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listLessons = createServerFn({ method: "GET" }).handler(async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const client = createClient(process.env.SUPABASE_URL!, key, {
    auth: { persistSession: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { data, error } = await client.from("lessons").select("*").order("order_index");
  if (error) throw new Error(error.message);
  return data ?? [];
});
