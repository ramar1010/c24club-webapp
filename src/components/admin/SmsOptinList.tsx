import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Mail } from "lucide-react";

const SmsOptinList = () => {
  const { data: optins = [], isLoading } = useQuery({
    queryKey: ["admin_sms_optins_list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sms_reminder_optins")
        .select("id, is_active, created_at, updated_at, user_id")
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Fetch member names and emails for user_ids
      const userIds = (data || []).map((o: any) => o.user_id);
      let memberMap: Record<string, { name: string; email: string }> = {};
      if (userIds.length > 0) {
        const { data: members } = await supabase
          .from("members")
          .select("id, name, email")
          .in("id", userIds);
        if (members) {
          memberMap = Object.fromEntries(members.map((m: any) => [m.id, { name: m.name, email: m.email || "—" }]));
        }
      }

      return (data || []).map((o: any) => ({
        ...o,
        member_name: memberMap[o.user_id]?.name || "Unknown",
        member_email: memberMap[o.user_id]?.email || "—",
      }));
    },
  });

  const activeCount = optins.filter((o: any) => o.is_active).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Mail className="h-5 w-5" />
          Opted-In Members ({activeCount} active)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : optins.length === 0 ? (
          <p className="text-muted-foreground">No opt-ins yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                   <TableHead>Member</TableHead>
                   <TableHead>Email</TableHead>
                   <TableHead>Status</TableHead>
                  <TableHead>Opted In</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {optins.map((o: any) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.member_name}</TableCell>
                    <TableCell className="text-xs">{o.member_email}</TableCell>
                    <TableCell>
                      <Badge variant={o.is_active ? "default" : "secondary"}>
                        {o.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(o.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SmsOptinList;
