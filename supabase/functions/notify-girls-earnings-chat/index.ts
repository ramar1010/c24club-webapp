import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (
  payload: Record<string, unknown>,
  status = 200,
) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

type ChatMessage = {
  id: string;
  user_id: string | null;
  body: string | null;
  is_system: boolean | null;
  created_at: string | null;
};

type Member = {
  id: string;
  name: string | null;
  gender: string | null;
  notify_enabled: boolean | null;
  notify_girls_earnings_chat: boolean | null;
  push_token: string | null;
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, reason: "POST required" }, 405);
  }

  try {
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");

    if (!serviceRoleKey || !supabaseUrl) {
      return jsonResponse(
        { success: false, reason: "Missing Supabase function environment variables" },
        500,
      );
    }

    // This function is intended to be called only by the database trigger
    // or another trusted server-side function.
    const authorization = req.headers.get("authorization");
    if (authorization !== `Bearer ${serviceRoleKey}`) {
      return jsonResponse({ success: false, reason: "Unauthorized" }, 401);
    }

    const { message_id } = await req.json();

    if (!message_id) {
      return jsonResponse(
        { success: false, reason: "Missing message_id" },
        400,
      );
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
    );

    const { data: message, error: messageError } = await supabaseAdmin
      .from("group_chat_messages")
      .select("id, user_id, body, is_system, created_at")
      .eq("id", message_id)
      .maybeSingle();

    if (messageError) {
      console.error("[notify-girls-earnings-chat] Message lookup failed:", messageError);
      return jsonResponse(
        { success: false, reason: messageError.message },
        500,
      );
    }

    if (!message) {
      return jsonResponse(
        { success: false, reason: "Message not found" },
        404,
      );
    }

    const chatMessage = message as ChatMessage;

    let senderName: string | null = null;

    if (chatMessage.user_id) {
      const { data: sender } = await supabaseAdmin
        .from("members")
        .select("name")
        .eq("id", chatMessage.user_id)
        .maybeSingle();

      senderName = sender?.name ?? null;
    }

    const rawBody = String(chatMessage.body ?? "")
      .replace(/\s+/g, " ")
      .trim();

    const preview = rawBody
      ? rawBody.length > 120
        ? `${rawBody.slice(0, 117)}...`
        : rawBody
      : "There is a new message in the Girls Earnings Chat.";

    const notificationBody =
      !chatMessage.is_system && senderName
        ? `${senderName}: ${preview}`
        : preview;

    // Supabase usually limits a request to 1,000 rows, so paginate to
    // make sure every eligible female member is included.
    const pageSize = 1000;
    const allFemaleMembers: Member[] = [];

    for (let offset = 0; ; offset += pageSize) {
      const { data: members, error: membersError } = await supabaseAdmin
        .from("members")
        .select(
          "id, name, gender, notify_enabled, notify_girls_earnings_chat, push_token",
        )
        .ilike("gender", "female")
        .not("push_token", "is", null)
        .range(offset, offset + pageSize - 1);

      if (membersError) {
        console.error(
          "[notify-girls-earnings-chat] Member lookup failed:",
          membersError,
        );

        return jsonResponse(
          { success: false, reason: membersError.message },
          500,
        );
      }

      allFemaleMembers.push(...((members ?? []) as Member[]));

      if (!members || members.length < pageSize) {
        break;
      }
    }

    const eligibleMembers = allFemaleMembers.filter((member) => {
      const globalNotificationsEnabled = member.notify_enabled !== false;
      const chatNotificationsEnabled =
        member.notify_girls_earnings_chat !== false;

      // Do not notify someone about their own regular message.
      // System announcements have no sender and go to every eligible female.
      const isOwnMessage =
        !chatMessage.is_system &&
        chatMessage.user_id &&
        member.id === chatMessage.user_id;

      return (
        globalNotificationsEnabled &&
        chatNotificationsEnabled &&
        Boolean(member.push_token) &&
        !isOwnMessage
      );
    });

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    // Send in small batches so a large female audience does not overwhelm
    // the Edge Function or Expo.
    for (let start = 0; start < eligibleMembers.length; start += 25) {
      const batch = eligibleMembers.slice(start, start + 25);

      const results = await Promise.allSettled(
        batch.map(async (member) => {
          const result = await supabaseAdmin.functions.invoke(
            "send-push-notification",
            {
              body: {
                user_id: member.id,
                title: "Girls Only Earnings Chat",
                body: notificationBody,
                data: {
                  type: "girls_earnings_chat",
                  screen: "/messages/girls-earnings",
                  deepLink: "/messages/girls-earnings",
                  messageId: String(chatMessage.id),
                },
                notification_type: "girls_earnings_chat",
                channel_id: "default",
                priority: "high",
              },
            },
          );

          if (result.error) {
            throw result.error;
          }

          return result.data;
        }),
      );

      for (const result of results) {
        if (result.status === "rejected") {
          failed += 1;
          console.error(
            "[notify-girls-earnings-chat] Push failed:",
            result.reason,
          );
          continue;
        }

        if (result.value?.skipped) {
          skipped += 1;
        } else if (result.value?.success) {
          sent += 1;
        } else {
          failed += 1;
        }
      }
    }

    return jsonResponse({
      success: true,
      message_id: chatMessage.id,
      eligible: eligibleMembers.length,
      sent,
      skipped,
      failed,
    });
  } catch (error) {
    console.error("[notify-girls-earnings-chat] Unexpected error:", error);

    return jsonResponse(
      {
        success: false,
        reason: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});
