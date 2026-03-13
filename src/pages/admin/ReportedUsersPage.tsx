import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { MessageCircleQuestion, AlertTriangle } from "lucide-react";

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

const ReportedUsersPage = () => {
  const [tab, setTab] = useState<"help" | "reports">("help");

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
          {displayed.map((r) => (
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
              <CardContent className="pt-0 space-y-1">
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReportedUsersPage;
