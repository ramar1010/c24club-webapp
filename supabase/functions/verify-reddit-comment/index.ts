import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Reddit returns the comment as JSON when you append .json to the URL.
// If the comment was removed/deleted, the body field is "[removed]" or "[deleted]"
// or the listing simply has no children.
async function checkUrl(url: string): Promise<{
  status: string; // 'live' | 'removed' | 'deleted' | 'unreachable'
  http_status: number | null;
  note: string | null;
}> {
  try {
    const cleaned = url.split("?")[0].replace(/\/$/, "");
    const jsonUrl = cleaned + ".json?raw_json=1";
    const r = await fetch(jsonUrl, {
      headers: { "User-Agent": "c24club-verifier/1.0" },
    });
    if (r.status === 404) {
      return { status: "deleted", http_status: 404, note: "404 from Reddit" };
    }
    if (!r.ok) {
      return { status: "unreachable", http_status: r.status, note: `HTTP ${r.status}` };
    }
    const data = await r.json();
    // Reddit comment permalink JSON is an array; the comment is in [1].data.children[0].data
    const comment = data?.[1]?.data?.children?.[0]?.data;
    if (!comment) {
      return { status: "removed", http_status: 200, note: "Comment not in listing" };
    }
    const body = (comment.body || "").trim();
    if (body === "[removed]") {
      return { status: "removed", http_status: 200, note: "Body is [removed]" };
    }
    if (body === "[deleted]") {
      return { status: "deleted", http_status: 200, note: "Body is [deleted]" };
    }
    if (comment.removed_by_category) {
      return {
        status: "removed",
        http_status: 200,
        note: `removed_by_category=${comment.removed_by_category}`,
      };
    }
    return { status: "live", http_status: 200, note: null };
  } catch (e) {
    return {
      status: "unreachable",
      http_status: null,
      note: e instanceof Error ? e.message : "fetch failed",
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const body = await req.json().catch(() => ({}));
    const submissionId: string | undefined = body.submission_id;

    let submissions: { id: string; posted_comment_url: string }[] = [];

    if (submissionId) {
      const { data, error } = await supabase
        .from("reddit_task_submissions")
        .select("id, posted_comment_url")
        .eq("id", submissionId)
        .limit(1);
      if (error) throw error;
      submissions = data || [];
    } else {
      // Cron path: verify up to 25 oldest unverified-or-stale submissions
      const cutoff = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("reddit_task_submissions")
        .select("id, posted_comment_url, verification_status, verified_at")
        .or(`verification_status.eq.unverified,verified_at.lt.${cutoff}`)
        .order("created_at", { ascending: true })
        .limit(25);
      if (error) throw error;
      submissions = (data || []).filter((s) => !!s.posted_comment_url);
    }

    const results: any[] = [];
    for (const s of submissions) {
      const res = await checkUrl(s.posted_comment_url);
      const { error: upErr } = await supabase
        .from("reddit_task_submissions")
        .update({
          verification_status: res.status,
          verified_at: new Date().toISOString(),
          verification_http_status: res.http_status,
          verification_note: res.note,
        })
        .eq("id", s.id);
      if (upErr) console.error("update error", s.id, upErr);
      results.push({ id: s.id, ...res });
      // small delay to be polite to Reddit
      await new Promise((r) => setTimeout(r, 400));
    }

    return new Response(JSON.stringify({ checked: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("verify-reddit-comment error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});