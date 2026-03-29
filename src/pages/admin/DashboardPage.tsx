import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Gift, Tag } from "lucide-react";
import { useMembers, useRewards, usePromos } from "@/hooks/useCrud";

const DashboardPage = () => {
  const { data: members } = useMembers();
  const { data: rewards } = useRewards();
  const { data: promos } = usePromos();

  const stats = [
    { label: "Total Members", value: members?.length ?? 0, icon: Users, color: "text-primary" },
    { label: "Active Rewards", value: rewards?.length ?? 0, icon: Gift, color: "text-accent" },
    { label: "Total Promos", value: promos?.length ?? 0, icon: Tag, color: "text-warning" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h2>
        <p className="text-muted-foreground mt-1">Welcome to the admin panel.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <Icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default DashboardPage;
