import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Smartphone, Search, Circle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const AdminNativeAppUsersPage = () => {
  const [search, setSearch] = useState("");

  const { data: members, isLoading } = useQuery({
    queryKey: ["native-app-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("id, name, email, gender, last_active_at, push_token, created_at, country")
        .not("push_token", "is", null)
        .order("last_active_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data || [];
    },
  });

  const getActivityStatus = (lastActive: string | null) => {
    if (!lastActive) return { label: "Unknown", color: "bg-muted text-muted-foreground" };
    const diff = Date.now() - new Date(lastActive).getTime();
    const mins = diff / 60000;
    if (mins < 5) return { label: "Online Now", color: "bg-green-500/20 text-green-400 border-green-500/30" };
    if (mins < 30) return { label: "Recently Active", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" };
    if (mins < 1440) return { label: "Today", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" };
    return { label: "Inactive", color: "bg-muted text-muted-foreground" };
  };

  const filtered = (members || []).filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      m.name?.toLowerCase().includes(q) ||
      m.email?.toLowerCase().includes(q) ||
      m.country?.toLowerCase().includes(q)
    );
  });

  const onlineCount = (members || []).filter((m) => {
    if (!m.last_active_at) return false;
    return (Date.now() - new Date(m.last_active_at).getTime()) < 300000;
  }).length;

  const todayCount = (members || []).filter((m) => {
    if (!m.last_active_at) return false;
    return (Date.now() - new Date(m.last_active_at).getTime()) < 86400000;
  }).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Native App Users</h2>
        <p className="text-muted-foreground mt-1">Members who have installed the native app (push token registered).</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total App Users</CardTitle>
            <Smartphone className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{members?.length ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Online Now</CardTitle>
            <Circle className="h-5 w-5 text-green-400 fill-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">{onlineCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Today</CardTitle>
            <Circle className="h-5 w-5 text-blue-400 fill-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-400">{todayCount}</div>
          </CardContent>
        </Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, or country..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Gender</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Active</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No native app users found.</TableCell>
                </TableRow>
              ) : (
                filtered.map((m) => {
                  const status = getActivityStatus(m.last_active_at);
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{m.email || "—"}</TableCell>
                      <TableCell className="capitalize">{m.gender || "—"}</TableCell>
                      <TableCell>{m.country || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={status.color}>{status.label}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {m.last_active_at ? new Date(m.last_active_at).toLocaleString() : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(m.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminNativeAppUsersPage;