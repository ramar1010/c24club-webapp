import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ALL_TABLES = [
  "admin_notifications",
  "anchor_earnings",
  "anchor_payouts",
  "anchor_queue",
  "anchor_sessions",
  "anchor_settings",
  "call_minutes_log",
  "camera_unlock_requests",
  "camera_unlock_settings",
  "cashout_requests",
  "cashout_settings",
  "challenge_submissions",
  "conversations",
  "direct_call_invites",
  "dm_messages",
  "email_send_log",
  "email_send_state",
  "email_templates",
  "email_unsubscribe_tokens",
  "freeze_settings",
  "gift_cards",
  "gift_transactions",
  "member_interests",
  "member_minutes",
  "member_redemptions",
  "members",
  "milestone_rewards",
  "milestones",
  "notification_cooldowns",
  "pinned_topics",
  "promo_analytics",
  "promo_templates",
  "promos",
  "reward_categories",
  "rewards",
  "rooms",
  "spin_prizes",
  "spin_results",
  "suppressed_emails",
  "tap_me_events",
  "topic_categories",
  "topics",
  "user_bans",
  "user_reports",
  "user_roles",
  "vip_settings",
  "waiting_queue",
  "weekly_challenges",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const backupToken = Deno.env.get("BACKUP_AUTH_TOKEN")!;
    const vpsUrl = "http://187.124.94.22:3333/backup";

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const backup: Record<string, unknown[]> = {};

    for (const table of ALL_TABLES) {
      let allRows: unknown[] = [];
      let from = 0;
      const pageSize = 1000;

      // Paginate to get all rows (beyond 1000 limit)
      while (true) {
        const { data, error } = await supabase
          .from(table)
          .select("*")
          .range(from, from + pageSize - 1);

        if (error) {
          console.error(`Error fetching ${table}:`, error.message);
          break;
        }

        if (!data || data.length === 0) break;
        allRows = allRows.concat(data);
        if (data.length < pageSize) break;
        from += pageSize;
      }

      backup[table] = allRows;
      console.log(`${table}: ${allRows.length} rows`);
    }

    // Send to VPS
    const response = await fetch(vpsUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${backupToken}`,
      },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        tables: backup,
      }),
    });

    if (!response.ok) {
      throw new Error(`VPS responded with ${response.status}`);
    }

    const result = await response.json();
    console.log("Backup sent successfully:", result);

    return new Response(JSON.stringify({ success: true, tables: Object.keys(backup).length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Backup failed:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
