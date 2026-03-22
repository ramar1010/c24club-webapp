import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Send, RefreshCw } from "lucide-react";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const AdminCallWindowsPage = () => {
  const queryClient = useQueryClient();
  const [newDay, setNewDay] = useState("1");
  const [newStart, setNewStart] = useState("19:00");
  const [newEnd, setNewEnd] = useState("21:00");
  const [newLabel, setNewLabel] = useState("");

  const { data: windows = [], isLoading } = useQuery({
    queryKey: ["admin_call_windows"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_windows")
        .select("*")
        .order("day_of_week")
        .order("start_time");
      if (error) throw error;
      return data;
    },
  });

  const { data: optinCount = 0 } = useQuery({
    queryKey: ["admin_sms_optin_count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("sms_reminder_optins")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);
      return count || 0;
    },
  });

  const { data: smsLogs = [], isLoading: logsLoading, refetch: refetchLogs } = useQuery({
    queryKey: ["admin_sms_delivery_log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sms_delivery_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as any[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("call_windows").insert({
        day_of_week: parseInt(newDay),
        start_time: newStart,
        end_time: newEnd,
        label: newLabel || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_call_windows"] });
      toast.success("Window added");
      setNewLabel("");
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("call_windows")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin_call_windows"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("call_windows").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_call_windows"] });
      toast.success("Window deleted");
    },
  });

  const sendBlast = async (window: any) => {
    try {
      const { error } = await supabase.functions.invoke("send-sms-reminder", {
        body: {
          action: "send_reminders",
          window_label: window.label || "Video Chat",
          start_time: window.start_time.slice(0, 5),
        },
      });
      if (error) throw error;
      toast.success(`SMS blast sent to ${optinCount} subscribers`);
      refetchLogs();
    } catch (e: any) {
      toast.error("Failed to send blast: " + e.message);
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === "0") return <Badge variant="outline">Accepted by API</Badge>;
    if (status === "fetch_error") return <Badge variant="destructive">Fetch Error</Badge>;
    return <Badge variant="destructive">Failed ({status})</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Scheduled Call Windows</h1>
        <p className="text-muted-foreground text-sm">
          Manage time slots when users are encouraged to join. {optinCount} users opted in for SMS reminders.
        </p>
      </div>

      {/* Add new window */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Add Time Slot</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Day</label>
              <Select value={newDay} onValueChange={setNewDay}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAY_NAMES.map((name, i) => (
                    <SelectItem key={i} value={String(i)}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Start</label>
              <Input type="time" value={newStart} onChange={(e) => setNewStart(e.target.value)} className="w-28" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">End</label>
              <Input type="time" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} className="w-28" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Label (optional)</label>
              <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. Power Hour" className="w-40" />
            </div>
            <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Existing windows */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Active Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : windows.length === 0 ? (
            <p className="text-muted-foreground">No windows configured yet.</p>
          ) : (
            <div className="space-y-3">
              {windows.map((w: any) => (
                <div key={w.id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                  <Switch
                    checked={w.is_active}
                    onCheckedChange={(checked) => toggleMutation.mutate({ id: w.id, is_active: checked })}
                  />
                  <div className="flex-1">
                    <span className="font-medium text-foreground">
                      {DAY_NAMES[w.day_of_week]} {w.start_time.slice(0, 5)} – {w.end_time.slice(0, 5)}
                    </span>
                    {w.label && <span className="text-muted-foreground text-sm ml-2">({w.label})</span>}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => sendBlast(w)} title="Send SMS blast">
                    <Send className="w-3.5 h-3.5 mr-1" /> Blast
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(w.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SMS Delivery Log */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">SMS Delivery Log</CardTitle>
          <Button variant="outline" size="sm" onClick={() => refetchLogs()} disabled={logsLoading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${logsLoading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <p className="text-muted-foreground">Loading logs...</p>
          ) : smsLogs.length === 0 ? (
            <p className="text-muted-foreground">No SMS logs yet. Send a blast or wait for an opt-in to see delivery data.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Error</TableHead>
                    <TableHead>Network</TableHead>
                    <TableHead>Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {smsLogs.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{log.action}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{log.phone_number}</TableCell>
                      <TableCell>{getStatusBadge(log.vonage_status)}</TableCell>
                      <TableCell className="text-xs text-destructive max-w-[200px] truncate">
                        {log.vonage_error_text || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{log.vonage_network || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{log.vonage_message_price ? `$${log.vonage_message_price}` : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminCallWindowsPage;
