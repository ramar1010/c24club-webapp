import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Clock, MessageCircle } from "lucide-react";

const AdminChallengeIssuesPage = () => {
  const queryClient = useQueryClient();

  const { data: issues = [] } = useQuery({
    queryKey: ["admin_challenge_issues"],
    queryFn: async () => {
      const { data } = await supabase
        .from("challenge_issues")
        .select("*, weekly_challenges(title)")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const userIds = [...new Set(issues.map((i: any) => i.user_id))];
  const { data: members = [] } = useQuery({
    queryKey: ["admin_issue_members", userIds.join(",")],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("members")
        .select("id, name, email")
        .in("id", userIds);
      return data || [];
    },
  });

  const getMemberName = (userId: string) => {
    const m = members.find((m: any) => m.id === userId);
    return m ? m.name || m.email || userId.slice(0, 8) : userId.slice(0, 8);
  };

  const resolveIssue = async (id: string) => {
    await supabase
      .from("challenge_issues")
      .update({ status: "resolved", updated_at: new Date().toISOString() })
      .eq("id", id);
    toast.success("Issue marked as resolved");
    queryClient.invalidateQueries({ queryKey: ["admin_challenge_issues"] });
  };

  const openCount = issues.filter((i: any) => i.status === "open").length;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-2">Challenge Issues</h1>
      {openCount > 0 && (
        <p className="text-sm text-amber-600 font-bold mb-4">
          ⚠️ {openCount} open issue{openCount > 1 ? "s" : ""} need attention
        </p>
      )}

      {issues.length === 0 ? (
        <p className="text-muted-foreground">No issues reported yet.</p>
      ) : (
        <div className="space-y-3 max-w-2xl">
          {issues.map((issue: any) => (
            <div key={issue.id} className="bg-card border rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-bold flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-muted-foreground" />
                    {issue.weekly_challenges?.title || "Unknown Challenge"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    👤 {getMemberName(issue.user_id)} · 📅 {new Date(issue.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                    issue.status === "open"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-green-100 text-green-700"
                  }`}
                >
                  {issue.status === "open" ? (
                    <Clock className="w-3 h-3" />
                  ) : (
                    <CheckCircle className="w-3 h-3" />
                  )}
                  {issue.status.toUpperCase()}
                </span>
              </div>

              <div className="bg-muted rounded-lg p-3 mb-3">
                <p className="text-sm">{issue.message}</p>
              </div>

              {issue.status === "open" && (
                <button
                  onClick={() => resolveIssue(issue.id)}
                  className="flex items-center gap-1 bg-green-600 text-white font-bold text-xs px-4 py-2 rounded-lg hover:opacity-90"
                >
                  <CheckCircle className="w-3 h-3" /> MARK RESOLVED
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminChallengeIssuesPage;
