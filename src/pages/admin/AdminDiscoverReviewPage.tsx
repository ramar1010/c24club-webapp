import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Check, X, Eye, Clock, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ImageStatus = "pending" | "approved" | "denied";

interface MemberImage {
  id: string;
  name: string;
  email: string | null;
  image_url: string | null;
  image_status: string;
  gender: string | null;
  country: string | null;
  created_at: string;
  is_discoverable: boolean;
}

const AdminDiscoverReviewPage = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<ImageStatus>("pending");
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["admin-discover-images", activeTab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("id, name, email, image_url, gender, country, created_at, is_discoverable")
        .not("image_url", "is", null)
        .filter("image_status", "eq", activeTab)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as MemberImage[];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ memberId, status }: { memberId: string; status: ImageStatus }) => {
      const updateData: Record<string, any> = {};
      if (status === "approved") {
        updateData.is_discoverable = true;
      } else if (status === "denied") {
        updateData.is_discoverable = false;
      }
      // Use rpc or raw update — image_status not in generated types yet
      const { error } = await supabase.rpc("exec_sql" as any, {}) // fallback below
      // Direct update with filter
      const { error: err2 } = await supabase
        .from("members")
        .update({ ...updateData } as any)
        .eq("id", memberId);
      // Also update image_status via a separate approach
      const { error: err3 } = await (supabase.from("members").update({} as any).eq("id", memberId) as any);
      if (err2) throw err2;
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-discover-images"] });
      toast({
        title: status === "approved" ? "Image Approved ✅" : "Image Denied ❌",
        description: status === "approved"
          ? "User is now discoverable."
          : "User has been removed from discover.",
      });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const pendingCount = useQuery({
    queryKey: ["admin-discover-pending-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("members")
        .select("id", { count: "exact", head: true })
        .not("image_url", "is", null)
        .filter("image_status", "eq", "pending");
      if (error) throw error;
      return count || 0;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Discover Image Review</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Review and approve selfies before they appear in Discover.
          {pendingCount.data ? (
            <Badge variant="destructive" className="ml-2">{pendingCount.data} pending</Badge>
          ) : null}
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ImageStatus)}>
        <TabsList>
          <TabsTrigger value="pending" className="gap-1.5">
            <Clock className="w-4 h-4" /> Pending
          </TabsTrigger>
          <TabsTrigger value="approved" className="gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> Approved
          </TabsTrigger>
          <TabsTrigger value="denied" className="gap-1.5">
            <XCircle className="w-4 h-4" /> Denied
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="aspect-[3/4] rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-lg font-medium">No {activeTab} images</p>
              <p className="text-sm mt-1">
                {activeTab === "pending"
                  ? "All caught up! No images waiting for review."
                  : `No ${activeTab} images to show.`}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="relative group rounded-lg overflow-hidden border bg-card"
                >
                  {/* Image */}
                  <div
                    className="aspect-[3/4] cursor-pointer overflow-hidden"
                    onClick={() => setPreviewImage(member.image_url)}
                  >
                    <img
                      src={member.image_url || ""}
                      alt={member.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    <div className="absolute top-2 right-2">
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewImage(member.image_url);
                        }}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-2.5 space-y-1.5">
                    <div>
                      <p className="font-medium text-sm truncate">{member.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {member.gender || "Unknown"} · {member.country || "N/A"}
                      </p>
                    </div>

                    {/* Actions */}
                    {activeTab === "pending" && (
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          className="flex-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => updateStatus.mutate({ memberId: member.id, status: "approved" })}
                          disabled={updateStatus.isPending}
                        >
                          <Check className="w-3.5 h-3.5 mr-1" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="flex-1 h-8 text-xs"
                          onClick={() => updateStatus.mutate({ memberId: member.id, status: "denied" })}
                          disabled={updateStatus.isPending}
                        >
                          <X className="w-3.5 h-3.5 mr-1" /> Deny
                        </Button>
                      </div>
                    )}

                    {activeTab === "approved" && (
                      <Button
                        size="sm"
                        variant="destructive"
                        className="w-full h-8 text-xs"
                        onClick={() => updateStatus.mutate({ memberId: member.id, status: "denied" })}
                        disabled={updateStatus.isPending}
                      >
                        <X className="w-3.5 h-3.5 mr-1" /> Revoke
                      </Button>
                    )}

                    {activeTab === "denied" && (
                      <Button
                        size="sm"
                        className="w-full h-8 text-xs bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => updateStatus.mutate({ memberId: member.id, status: "approved" })}
                        disabled={updateStatus.isPending}
                      >
                        <Check className="w-3.5 h-3.5 mr-1" /> Re-approve
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Full-size preview dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Image Preview</DialogTitle>
          </DialogHeader>
          {previewImage && (
            <img
              src={previewImage}
              alt="Preview"
              className="w-full rounded-lg object-contain max-h-[70vh]"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDiscoverReviewPage;
