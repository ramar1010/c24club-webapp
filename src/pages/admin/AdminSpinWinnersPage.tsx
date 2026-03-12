import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const AdminSpinWinnersPage = () => {
  const { data: results = [], isLoading } = useQuery({
    queryKey: ["admin-spin-results"],
    queryFn: async () => {
      const { data } = await supabase
        .from("spin_results")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      return data || [];
    },
  });

  // Fetch member names
  const userIds = [...new Set(results.map((r: any) => r.user_id))];
  const { data: members = [] } = useQuery({
    queryKey: ["admin-spin-members", userIds],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("members")
        .select("id, name, email")
        .in("id", userIds);
      return data || [];
    },
  });

  const getMember = (userId: string) =>
    members.find((m: any) => m.id === userId);

  // Calculate spin counts per user
  const spinCounts = results.reduce((acc: Record<string, number>, r: any) => {
    acc[r.user_id] = (acc[r.user_id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const getSpinCount = (userId: string) => spinCounts[userId] || 0;

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading...</div>;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Members Won (Spin to Win)</h1>
      <p className="text-muted-foreground text-sm">
        History of all spin results across all members.
      </p>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Total Spins</TableHead>
              <TableHead>Prize</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No spin results yet.
                </TableCell>
              </TableRow>
            ) : (
              results.map((r: any) => {
                const member = getMember(r.user_id);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {member?.name || r.user_id.slice(0, 8)}
                      {member?.email && (
                        <span className="text-xs text-muted-foreground block">{member.email}</span>
                      )}
                    </TableCell>
                    <TableCell>{r.prize_label}</TableCell>
                    <TableCell className="capitalize">{r.prize_type.replace("_", " ")}</TableCell>
                    <TableCell>{r.prize_amount}</TableCell>
                    <TableCell className="text-xs">
                      {new Date(r.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default AdminSpinWinnersPage;
