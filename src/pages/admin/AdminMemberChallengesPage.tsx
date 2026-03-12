import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, XCircle, Clock } from "lucide-react";

const AdminMemberChallengesPage = () => {
  const queryClient = useQueryClient();

  const { data: submissions = [] } = useQuery({
    queryKey: ["admin_challenge_submissions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("challenge_submissions")
        .select("*, weekly_challenges(title)")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const updateStatus = async (id: string, status: string) => {
    const updateData: any = {
      status,
      reviewed_at: new Date().toISOString(),
    };

    await supabase.from("challenge_submissions").update(updateData).eq("id", id);
    toast.success(`Submission ${status}`);
    queryClient.invalidateQueries({ queryKey: ["admin_challenge_submissions"] });
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-700",
      approved: "bg-green-100 text-green-700",
      rejected: "bg-red-100 text-red-700",
    };
    const icons: Record<string, any> = { pending: Clock, approved: CheckCircle, rejected: XCircle };
    const Icon = icons[status] || Clock;
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${colors[status] || ""}`}>
        <Icon className="w-3 h-3" /> {status.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Member Challenge Submissions</h1>

      {submissions.length === 0 ? (
        <p className="text-muted-foreground">No submissions yet.</p>
      ) : (
        <div className="space-y-3 max-w-2xl">
          {submissions.map((s: any) => (
            <div key={s.id} className="bg-card border rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-bold">{s.weekly_challenges?.title || "Unknown Challenge"}</h3>
                  <p className="text-xs text-muted-foreground">User: {s.user_id?.slice(0, 8)}...</p>
                  <p className="text-xs text-muted-foreground">
                    Submitted: {new Date(s.created_at).toLocaleDateString()}
                  </p>
                </div>
                {statusBadge(s.status)}
              </div>

              {s.proof_text && (
                <div className="bg-muted rounded-lg p-3 mb-3">
                  <p className="text-sm">{s.proof_text}</p>
                </div>
              )}

              {s.status === "pending" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => updateStatus(s.id, "approved")}
                    className="flex items-center gap-1 bg-green-600 text-white font-bold text-xs px-4 py-2 rounded-lg hover:opacity-90"
                  >
                    <CheckCircle className="w-3 h-3" /> APPROVE
                  </button>
                  <button
                    onClick={() => updateStatus(s.id, "rejected")}
                    className="flex items-center gap-1 bg-red-600 text-white font-bold text-xs px-4 py-2 rounded-lg hover:opacity-90"
                  >
                    <XCircle className="w-3 h-3" /> REJECT
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminMemberChallengesPage;
