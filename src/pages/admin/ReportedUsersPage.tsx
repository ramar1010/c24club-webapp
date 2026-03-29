import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { MessageCircleQuestion, AlertTriangle, ShieldBan, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Report = {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  reason: string;
  details: string | null;
  room_id: string | null;
  screenshot_url: string | null;
  created_at: string;
};

type DialogAction = {
  type: "ban" | "delete";
  userId: string;
  reportId: string;
} | null;

const ReportedUsersPage = () => {
  const [tab, setTab] = useState<"help" | "reports">("help");
  const [dialogAction, setDialogAction] = useState<DialogAction>(null);
  const [banReason, setBanReason] = useState("");
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["admin-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_reports")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Report[];
    },
  });

  const getScreenshotUrl = (screenshotPath: string | null) => {
    if (!screenshotPath) return null;
    const { data } = supabase.storage
      .from("report-screenshots")
      .getPublicUrl(screenshotPath);
    return data?.publicUrl || null;
  };

  const getTargetUserId = (report: Report) => {
    return tab === "reports" ? report.reported_user_id : report.reporter_id;
  };

  const handleBanUser = async () => {
    if (!dialogAction || dialogAction.type !== "ban") return;
    setLoading(true);
    try {
      // Get user's IP for IP ban
      const { data: memberData } = await supabase
        .from("members")
        .select("last_ip, name")
        .eq("id", dialogAction.userId)
        .maybeSingle();

      const { error } = await supabase.from("user_bans").insert({
        user_id: dialogAction.userId,
        reason: banReason || "Banned from report review",
        ban_type: "standard",
        is_active: true,
        ip_address: memberData?.last_ip || null,
        banned_by: user?.id || null,
      });
      if (error) throw error;

      toast.success(`User ${memberData?.name || dialogAction.userId.slice(0, 8)} banned`);
      setDialogAction(null);
      setBanReason("");
    } catch (e: any) {
      toast.error("Ban failed", { description: e.message });
    }
    setLoading(false);
  };

  const handleDeleteAccount = async () => {
    if (!dialogAction || dialogAction.type !== "delete") return;
    setLoading(true);
    try {
      // Delete member record (cascading cleanup)
      const { error } = await supabase
        .from("members")
        .delete()
        .eq("id", dialogAction.userId);
      if (error) throw error;

      // Also remove from member_minutes
      await supabase
        .from("member_minutes")
        .delete()
        .eq("user_id", dialogAction.userId);

      toast.success("Account deleted");
      queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
      setDialogAction(null);
    } catch (e: any) {
      toast.error("Delete failed", { description: e.message });
    }
    setLoading(false);
  };

  const helpRequests = reports.filter((r) => r.reason.startsWith("[HELP]"));
  const userReports = reports.filter((r) => !r.reason.startsWith("[HELP]"));
  const displayed = tab === "help" ? helpRequests : userReports;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight text-foreground">
        Reports & Help Requests
      </h2>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab("help")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "help"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          <MessageCircleQuestion className="w-4 h-4" />
          Help Requests
          {helpRequests.length > 0 && (
            <Badge variant="secondary" className="ml-1 text-xs">
              {helpRequests.length}
            </Badge>
          )}
        </button>
        <button
          onClick={() => setTab("reports")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "reports"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          User Reports
          {userReports.length > 0 && (
            <Badge variant="secondary" className="ml-1 text-xs">
              {userReports.length}
            </Badge>
          )}
        </button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading...</p>
      ) : displayed.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            No {tab === "help" ? "help requests" : "user reports"} yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {displayed.map((r) => {
            const screenshotUrl = getScreenshotUrl(r.screenshot_url);
            const targetId = getTargetUserId(r);
            return (
              <Card key={r.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-sm font-semibold">
                      {tab === "help"
                        ? r.reason.replace("[HELP] ", "")
                        : r.reason}
                    </CardTitle>
                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                      {new Date(r.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  {screenshotUrl && (
                    <a href={screenshotUrl} target="_blank" rel="noopener noreferrer">
                      <img
                        src={screenshotUrl}
                        alt="Report screenshot"
                        className="w-48 h-auto rounded-lg border border-border object-cover"
                      />
                    </a>
                  )}
                  {r.details && (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {r.details}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground/60 font-mono">
                    From: {r.reporter_id.slice(0, 8)}...
                    {tab === "reports" && r.reported_user_id !== r.reporter_id && (
                      <> · Reported: {r.reported_user_id.slice(0, 8)}...</>
                    )}
                    {r.room_id && <> · Room: {r.room_id.slice(0, 8)}...</>}
                  </p>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => setDialogAction({ type: "ban", userId: targetId, reportId: r.id })}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                    >
                      <ShieldBan className="w-3.5 h-3.5" />
                      Ban User
                    </button>
                    <button
                      onClick={() => setDialogAction({ type: "delete", userId: targetId, reportId: r.id })}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete Account
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Ban Confirmation Dialog */}
      <AlertDialog open={dialogAction?.type === "ban"} onOpenChange={(open) => !open && setDialogAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ban this user?</AlertDialogTitle>
            <AlertDialogDescription>
              User ID: <span className="font-mono text-foreground">{dialogAction?.userId}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <input
            type="text"
            placeholder="Ban reason (optional)"
            value={banReason}
            onChange={(e) => setBanReason(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBanUser}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? "Banning..." : "Ban User"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Account Confirmation Dialog */}
      <AlertDialog open={dialogAction?.type === "delete"} onOpenChange={(open) => !open && setDialogAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the member record for user <span className="font-mono text-foreground">{dialogAction?.userId}</span>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? "Deleting..." : "Delete Account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ReportedUsersPage;
