import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PreviewSample {
  id: string;
  name: string | null;
  gender: string | null;
  last_active_at: string | null;
}

const AdminAnnouncementsPage = () => {
  const [gender, setGender] = useState("all");
  const [activity, setActivity] = useState("7d");
  const [vip, setVip] = useState("all");
  const [discoverableOnly, setDiscoverableOnly] = useState(false);
  const [excludeTest, setExcludeTest] = useState(true);
  const [limit, setLimit] = useState(500);
  const [testEmail, setTestEmail] = useState("");
  const [message, setMessage] = useState("");
  const [pushTitle, setPushTitle] = useState("New message from C24Club");
  const [sendPush, setSendPush] = useState(true);

  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [sample, setSample] = useState<PreviewSample[]>([]);
  const [confirming, setConfirming] = useState(false);

  const filters = {
    gender,
    activity,
    vip,
    discoverable_only: discoverableOnly,
    exclude_test: excludeTest,
    limit,
    test_email: testEmail.trim() || null,
  };

  const runPreview = async () => {
    setLoading(true);
    setConfirming(false);
    const { data, error } = await supabase.functions.invoke("admin-broadcast-dm", {
      body: { mode: "preview", filters },
    });
    setLoading(false);
    if (error || !data?.success) {
      toast.error(data?.error || error?.message || "Preview failed");
      return;
    }
    setCount(data.count);
    setSample(data.sample || []);
  };

  const runSend = async () => {
    if (message.trim().length < 2) {
      toast.error("Write a message first");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-broadcast-dm", {
      body: {
        mode: "send",
        filters,
        message,
        push_title: pushTitle,
        send_push: sendPush,
      },
    });
    setLoading(false);
    setConfirming(false);
    if (error || !data?.success) {
      toast.error(data?.error || error?.message || "Send failed");
      return;
    }
    toast.success(`Sent to ${data.sent} member${data.sent === 1 ? "" : "s"}${data.failed ? ` · ${data.failed} failed` : ""}`);
    setCount(null);
    setSample([]);
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Announcements</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Send a DM to a filtered group of members. All messages are sent from your admin account
          (realsubify@gmail.com).
        </p>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-4">
        <h2 className="font-semibold text-foreground">Audience</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Gender</Label>
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="male">Male</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Activity</Label>
            <Select value={activity} onValueChange={setActivity}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Anyone</SelectItem>
                <SelectItem value="24h">Active last 24 hours</SelectItem>
                <SelectItem value="7d">Active last 7 days</SelectItem>
                <SelectItem value="30d">Active last 30 days</SelectItem>
                <SelectItem value="inactive30">Inactive 30+ days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>VIP status</Label>
            <Select value={vip} onValueChange={setVip}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any</SelectItem>
                <SelectItem value="vip">VIP only</SelectItem>
                <SelectItem value="nonvip">Non-VIP only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <Label className="cursor-pointer">Discoverable profiles only</Label>
            <Switch checked={discoverableOnly} onCheckedChange={setDiscoverableOnly} />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <Label className="cursor-pointer">Exclude test accounts</Label>
            <Switch checked={excludeTest} onCheckedChange={setExcludeTest} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Max recipients</Label>
            <Input
              type="number"
              min={1}
              max={20000}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label>Test email (overrides filters)</Label>
            <Input
              placeholder="you@example.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
            />
          </div>
        </div>

        <Button variant="outline" onClick={runPreview} disabled={loading}>
          {loading ? "Loading..." : "Preview audience"}
        </Button>

        {count !== null && (
          <div className="rounded-md bg-muted/50 p-3 text-sm">
            <p className="font-semibold text-foreground">{count} recipient{count === 1 ? "" : "s"}</p>
            {sample.length > 0 && (
              <ul className="mt-2 space-y-1 text-muted-foreground">
                {sample.map((s) => (
                  <li key={s.id}>
                    {s.name || "Unnamed"} · {s.gender || "?"} ·{" "}
                    {s.last_active_at ? new Date(s.last_active_at).toLocaleDateString() : "never active"}
                  </li>
                ))}
                {count > sample.length && <li>…and {count - sample.length} more</li>}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border p-4 space-y-4">
        <h2 className="font-semibold text-foreground">Message</h2>
        <Textarea
          rows={7}
          maxLength={2000}
          placeholder={"Hey {name}! Quick update…"}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Use <code>{"{name}"}</code> to insert the member's first name. Links are clickable in chat. {message.length}/2000
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Push notification title</Label>
            <Input value={pushTitle} onChange={(e) => setPushTitle(e.target.value)} />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <Label className="cursor-pointer">Also send push notification</Label>
            <Switch checked={sendPush} onCheckedChange={setSendPush} />
          </div>
        </div>

        {confirming ? (
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-3">
            <p className="text-sm text-foreground">
              Send this DM to {count ?? "the selected"} member{count === 1 ? "" : "s"}? This can't be undone.
            </p>
            <Button onClick={runSend} disabled={loading}>
              {loading ? "Sending..." : "Yes, send now"}
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={loading}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button onClick={() => setConfirming(true)} disabled={loading || message.trim().length < 2}>
            Send announcement
          </Button>
        )}
      </div>
    </div>
  );
};

export default AdminAnnouncementsPage;