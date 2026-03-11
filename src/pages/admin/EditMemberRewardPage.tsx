import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Save } from "lucide-react";
import { useState, useEffect } from "react";

const STATUSES = [
  "Unlocked Reward",
  "Redeemed Milestone Reward",
  "Order placed",
  "Order shipped",
  "Item Out of stock",
  "Gift Card Form Filled by user",
  "Gift Card Sent on Email",
  "Redeemed Product Point Reward",
  "Redeemed VIP Gift Reward",
  "Redeemed as Anchor User Reward",
];

const ADDRESS_OPTIONS = ["unknown", "yes", "no"];

const EMAIL_TRIGGERING_STATUSES = ["Order placed", "Order shipped", "Item Out of stock"];

const EditMemberRewardPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: redemption, isLoading } = useQuery({
    queryKey: ["member_redemption", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_redemptions")
        .select("*, members!member_redemptions_user_id_fkey(name, email)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const [status, setStatus] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [addressExists, setAddressExists] = useState("unknown");
  const [notes, setNotes] = useState("");
  const [prevStatus, setPrevStatus] = useState("");

  useEffect(() => {
    if (redemption) {
      setStatus(redemption.status);
      setPrevStatus(redemption.status);
      setTrackingUrl((redemption as any).shipping_tracking_url || "");
      setAddressExists((redemption as any).address_exists || "unknown");
      setNotes(redemption.notes || "");
    }
  }, [redemption]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("member_redemptions")
        .update({
          status,
          shipping_tracking_url: trackingUrl || null,
          address_exists: addressExists,
          notes,
        } as any)
        .eq("id", id!);
      if (error) throw error;

      // Send email if status changed to an email-triggering status
      const statusChanged = status !== prevStatus;
      const shouldSendEmail = statusChanged && EMAIL_TRIGGERING_STATUSES.includes(status);
      const shouldSendAddressEmail = addressExists === "no" && (redemption as any)?.address_exists !== "no";

      if (shouldSendEmail || shouldSendAddressEmail) {
        const emailType = shouldSendAddressEmail ? "address_not_exist" : status;
        await supabase.functions.invoke("redemption-status-email", {
          body: { redemptionId: id, emailType },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_member_redemptions"] });
      queryClient.invalidateQueries({ queryKey: ["member_redemption", id] });
      toast.success("Member reward updated");
      navigate("/admin/member-rewards");
    },
    onError: (e: Error) => toast.error("Update failed", { description: e.message }),
  });

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading...</div>;
  if (!redemption) return <div className="p-8 text-destructive">Redemption not found</div>;

  const member = (redemption as any).members;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/member-rewards")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Edit Member Reward</h2>
      </div>

      {/* Read-only info grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 rounded-lg border p-4 bg-muted/30">
        <div>
          <Label className="text-xs text-muted-foreground">Member</Label>
          <p className="font-medium">{member?.name || "Unknown"}</p>
          <p className="text-xs text-muted-foreground">{member?.email || redemption.user_id.slice(0, 8)}</p>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Reward</Label>
          <p className="font-medium">{redemption.reward_title}</p>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Cost</Label>
          <p className="font-medium">{redemption.minutes_cost} minutes</p>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Date</Label>
          <p className="font-medium">{new Date(redemption.created_at).toLocaleDateString()}</p>
        </div>
      </div>

      {/* Shipping info */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 rounded-lg border p-4 bg-muted/30">
        <div>
          <Label className="text-xs text-muted-foreground">Name</Label>
          <p className="font-medium">{redemption.shipping_name || "—"}</p>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Address</Label>
          <p className="font-medium">{redemption.shipping_address || "—"}</p>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">City / State</Label>
          <p className="font-medium">{[redemption.shipping_city, redemption.shipping_state].filter(Boolean).join(", ") || "—"}</p>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Country / Zip</Label>
          <p className="font-medium">{[redemption.shipping_country, redemption.shipping_zip].filter(Boolean).join(" ") || "—"}</p>
        </div>
      </div>

      {/* Cashout info */}
      {(redemption.cashout_amount || redemption.cashout_paypal) && (
        <div className="rounded-lg border p-4 bg-muted/30">
          <Label className="text-sm font-semibold">Legendary Item Cashout Details</Label>
          <p className="text-sm mt-1">Amount: ${redemption.cashout_amount ?? 0} USD</p>
          <p className="text-sm">PayPal ID: {redemption.cashout_paypal || "—"}</p>
        </div>
      )}

      {/* Editable fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {status !== prevStatus && EMAIL_TRIGGERING_STATUSES.includes(status) && (
            <p className="text-xs text-blue-500">📧 An email will be sent to the member when you save.</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Address Exists</Label>
          <Select value={addressExists} onValueChange={setAddressExists}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ADDRESS_OPTIONS.map((o) => (
                <SelectItem key={o} value={o}>{o === "unknown" ? "Unknown" : o === "yes" ? "Yes" : "No"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {addressExists === "no" && (redemption as any).address_exists !== "no" && (
            <p className="text-xs text-blue-500">📧 An "address not found" email will be sent to the member.</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Shipping Tracking URL</Label>
          <Input value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} placeholder="https://..." />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
      </div>

      <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
        <Save className="mr-2 h-4 w-4" />
        {updateMutation.isPending ? "Saving..." : "Save Changes"}
      </Button>
    </div>
  );
};

export default EditMemberRewardPage;
