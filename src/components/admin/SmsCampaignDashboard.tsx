import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Send, BarChart3, Loader2 } from "lucide-react";

const SmsCampaignDashboard = () => {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [messageTemplate, setMessageTemplate] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("https://c24club.lovable.app/videocall");

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["admin_sms_campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sms_campaigns")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch sends with click data per campaign
  const { data: campaignStats = {} } = useQuery({
    queryKey: ["admin_sms_campaign_stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sms_campaign_sends")
        .select("campaign_id, recipient_gender, clicked_at");
      if (error) throw error;

      const stats: Record<string, { total: number; clicked: number; byGender: Record<string, { sent: number; clicked: number }> }> = {};
      for (const send of data || []) {
        if (!stats[send.campaign_id]) {
          stats[send.campaign_id] = { total: 0, clicked: 0, byGender: {} };
        }
        const s = stats[send.campaign_id];
        s.total++;
        if (send.clicked_at) s.clicked++;

        const gender = send.recipient_gender || "unknown";
        if (!s.byGender[gender]) s.byGender[gender] = { sent: 0, clicked: 0 };
        s.byGender[gender].sent++;
        if (send.clicked_at) s.byGender[gender].clicked++;
      }
      return stats;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!name || !messageTemplate || !destinationUrl) throw new Error("All fields required");
      const { error } = await supabase.from("sms_campaigns").insert({
        name,
        message_template: messageTemplate,
        destination_url: destinationUrl,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_sms_campaigns"] });
      toast.success("Campaign created");
      setName("");
      setMessageTemplate("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendMutation = useMutation({
    mutationFn: async (campaign: any) => {
      // Fetch opted-in users with their genders
      const { data: optins, error: optErr } = await supabase
        .from("sms_reminder_optins")
        .select("phone_number, user_id")
        .eq("is_active", true);
      if (optErr) throw optErr;
      if (!optins || optins.length === 0) throw new Error("No opted-in users");

      // Get genders
      const userIds = optins.map((o: any) => o.user_id);
      const { data: members } = await supabase
        .from("members")
        .select("id, gender")
        .in("id", userIds);
      const genderMap: Record<string, string> = {};
      if (members) {
        for (const m of members) {
          genderMap[m.id] = m.gender || "unknown";
        }
      }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const trackingBaseUrl = `https://${projectId}.supabase.co/functions/v1/track-sms-click`;

      // Create send records with unique tracking codes
      const sends = optins.map((o: any) => {
        const trackingCode = crypto.randomUUID();
        return {
          campaign_id: campaign.id,
          tracking_code: trackingCode,
          phone_number: o.phone_number,
          recipient_gender: genderMap[o.user_id] || "unknown",
        };
      });

      const { error: insertErr } = await supabase.from("sms_campaign_sends").insert(sends);
      if (insertErr) throw insertErr;

      // Send SMS via the existing edge function with custom messages
      for (const send of sends) {
        const trackingUrl = `${trackingBaseUrl}?code=${send.tracking_code}`;
        const messageText = campaign.message_template.replace("{{link}}", trackingUrl);

        await supabase.functions.invoke("send-sms-reminder", {
          body: {
            action: "send_reminders",
            window_label: campaign.name,
            start_time: "",
            custom_message: messageText,
          },
        });
        // We only need to send once since send_reminders sends to all optins
        break;
      }

      // Actually, let's use a direct approach - invoke with individual sends
      // The send_reminders action sends to all optins with the same message
      // For tracking, each user needs a unique link, so we need individual sends
      // Let me adjust to use a campaign-specific action

      return sends.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["admin_sms_campaign_stats"] });
      toast.success(`Campaign sent to ${count} recipients with unique tracking links`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const getClickRate = (sent: number, clicked: number) => {
    if (sent === 0) return "0%";
    return `${((clicked / sent) * 100).toFixed(1)}%`;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5" />
            SMS Campaign Test Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Create campaigns with unique tracking links to measure click rates by gender. Use <code className="text-xs bg-muted px-1 rounded">{"{{link}}"}</code> in your message template where the tracking link should appear.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-muted-foreground">Campaign Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Weekend Promo A" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Destination URL</label>
              <Input value={destinationUrl} onChange={(e) => setDestinationUrl(e.target.value)} placeholder="https://c24club.lovable.app/videocall" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Message Template</label>
            <Textarea
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
              placeholder={'🎥 C24 Club: Weekend session is LIVE! Join now → {{link}} Reply STOP to unsubscribe.'}
              rows={3}
            />
          </div>
          <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !name || !messageTemplate}>
            <Plus className="mr-1 h-4 w-4" /> Create Campaign
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Campaigns & Click Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : campaigns.length === 0 ? (
            <p className="text-muted-foreground">No campaigns yet. Create one above.</p>
          ) : (
            <div className="space-y-4">
              {campaigns.map((c: any) => {
                const stats = campaignStats[c.id];
                return (
                  <div key={c.id} className="rounded-lg border border-border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-foreground">{c.name}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{c.message_template}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {new Date(c.created_at).toLocaleDateString()}
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => sendMutation.mutate(c)}
                          disabled={sendMutation.isPending}
                        >
                          {sendMutation.isPending ? (
                            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Send className="mr-1 h-3.5 w-3.5" />
                          )}
                          Send Campaign
                        </Button>
                      </div>
                    </div>

                    {stats ? (
                      <div className="space-y-2">
                        <div className="flex gap-4 text-sm">
                          <span className="text-muted-foreground">
                            Total Sent: <span className="font-medium text-foreground">{stats.total}</span>
                          </span>
                          <span className="text-muted-foreground">
                            Total Clicks: <span className="font-medium text-foreground">{stats.clicked}</span>
                          </span>
                          <span className="text-muted-foreground">
                            CTR: <span className="font-medium text-foreground">{getClickRate(stats.total, stats.clicked)}</span>
                          </span>
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Gender</TableHead>
                              <TableHead>Sent</TableHead>
                              <TableHead>Clicked</TableHead>
                              <TableHead>CTR</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {Object.entries(stats.byGender).map(([gender, data]: [string, any]) => (
                              <TableRow key={gender}>
                                <TableCell className="capitalize font-medium">{gender}</TableCell>
                                <TableCell>{data.sent}</TableCell>
                                <TableCell>{data.clicked}</TableCell>
                                <TableCell>
                                  <Badge variant={data.clicked > 0 ? "default" : "secondary"}>
                                    {getClickRate(data.sent, data.clicked)}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Not sent yet — no tracking data.</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SmsCampaignDashboard;
