import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Gift, Target, Trophy, MessageSquare, ShoppingBag } from "lucide-react";

const stats = [
  { label: "Total Members", value: "—", icon: Users, color: "text-primary" },
  { label: "Active Rewards", value: "—", icon: Gift, color: "text-accent" },
  { label: "Milestones", value: "—", icon: Target, color: "text-warning" },
  { label: "Contests", value: "—", icon: Trophy, color: "text-success" },
  { label: "Chat Rooms", value: "—", icon: MessageSquare, color: "text-info" },
  { label: "Product Points", value: "—", icon: ShoppingBag, color: "text-destructive" },
];

const DashboardPage = () => {
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
