import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { Video, Wifi, WifiOff, Clock } from "lucide-react";

const AdminRoomsPage = () => {
  const { data: rooms, isLoading } = useQuery({
    queryKey: ["admin-rooms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rooms")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    refetchInterval: 5000,
  });

  const { data: members } = useQuery({
    queryKey: ["admin-members-lookup"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("id, name");
      if (error) throw error;
      return data;
    },
  });

  const memberName = (id: string | null) => {
    if (!id) return "—";
    const m = members?.find((m) => m.id === id);
    return m?.name || id.slice(0, 8) + "…";
  };

  const connectedRooms = rooms?.filter((r) => r.status === "connected") ?? [];
  const disconnectedRooms = rooms?.filter((r) => r.status === "disconnected") ?? [];

  const formatTime = (ts: string | null) =>
    ts ? format(new Date(ts), "MMM d, yyyy h:mm a") : "—";

  const getDuration = (connected: string | null, disconnected: string | null) => {
    if (!connected) return "—";
    const start = new Date(connected).getTime();
    const end = disconnected ? new Date(disconnected).getTime() : Date.now();
    const mins = Math.floor((end - start) / 60000);
    const secs = Math.floor(((end - start) % 60000) / 1000);
    return `${mins}m ${secs}s`;
  };

  const RoomCard = ({ room }: { room: (typeof rooms)[number] }) => (
    <Card className="border-border/50">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Badge
            variant={room.status === "connected" ? "default" : "secondary"}
            className={
              room.status === "connected"
                ? "bg-green-600 hover:bg-green-700"
                : ""
            }
          >
            {room.status === "connected" ? (
              <Wifi className="h-3 w-3 mr-1" />
            ) : (
              <WifiOff className="h-3 w-3 mr-1" />
            )}
            {room.status}
          </Badge>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {getDuration(room.connected_at, room.disconnected_at)}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Member 1</p>
            <p className="text-xs font-medium truncate">{memberName(room.member1)}</p>
            {room.member1_gender && (
              <Badge variant="outline" className="text-[10px] mt-1">
                {room.member1_gender}
              </Badge>
            )}
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Member 2</p>
            <p className="text-xs font-medium truncate">{memberName(room.member2)}</p>
            {room.member2_gender && (
              <Badge variant="outline" className="text-[10px] mt-1">
                {room.member2_gender}
              </Badge>
            )}
          </div>
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          <p>Connected: {formatTime(room.connected_at)}</p>
          {room.disconnected_at && (
            <p>Disconnected: {formatTime(room.disconnected_at)}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Video className="h-6 w-6" /> Chat Rooms
          </h2>
          <p className="text-muted-foreground mt-1">
            Live and past video call sessions.
          </p>
        </div>
        <div className="flex gap-3">
          <Card className="px-4 py-2">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-medium">
                {connectedRooms.length} Live
              </span>
            </div>
          </Card>
          <Card className="px-4 py-2">
            <span className="text-sm text-muted-foreground">
              {rooms?.length ?? 0} Total
            </span>
          </Card>
        </div>
      </div>

      <Tabs defaultValue="connected">
        <TabsList>
          <TabsTrigger value="connected">
            Connected ({connectedRooms.length})
          </TabsTrigger>
          <TabsTrigger value="disconnected">
            Disconnected ({disconnectedRooms.length})
          </TabsTrigger>
          <TabsTrigger value="all">All ({rooms?.length ?? 0})</TabsTrigger>
        </TabsList>

        {isLoading ? (
          <p className="text-muted-foreground py-8 text-center">Loading…</p>
        ) : (
          <>
            <TabsContent value="connected">
              {connectedRooms.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center">
                  No active connections right now.
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {connectedRooms.map((r) => (
                    <RoomCard key={r.id} room={r} />
                  ))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="disconnected">
              {disconnectedRooms.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center">
                  No past sessions.
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {disconnectedRooms.map((r) => (
                    <RoomCard key={r.id} room={r} />
                  ))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="all">
              {!rooms?.length ? (
                <p className="text-muted-foreground py-8 text-center">
                  No rooms yet.
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {rooms.map((r) => (
                    <RoomCard key={r.id} room={r} />
                  ))}
                </div>
              )}
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
};

export default AdminRoomsPage;
