import { useState } from "react";
import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Info, ScanSearch } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Check, X, Eye, Clock, CheckCircle2, XCircle, Trash2, ShieldX } from "lucide-react";
import { scanImageUrlForNsfw } from "@/lib/nsfwScan";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [banTarget, setBanTarget] = useState<MemberImage | null>(null);
  const [banReason, setBanReason] = useState("Inappropriate selfie (admin review)");
  const [scanningIds, setScanningIds] = useState<Set<string>>(new Set());
  const [scanResults, setScanResults] = useState<Record<string, { isNsfw: boolean; score: number }>>({});
  const { user } = useAuth();

  const handleNsfwScan = async (member: MemberImage) => {
    if (!member.image_url) return;
    setScanningIds(prev => new Set(prev).add(member.id));
    try {
      const result = await scanImageUrlForNsfw(member.image_url, 0.60);
      setScanResults(prev => ({ ...prev, [member.id]: { isNsfw: result.isNsfw, score: result.nudityScore } }));
      if (result.isNsfw) {
        toast({
          title: `⚠️ NSFW Detected — ${(result.nudityScore * 100).toFixed(0)}%`,
          description: `${member.name}'s image flagged. Use Ban button to take action.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: `✅ Image Clean — ${(result.nudityScore * 100).toFixed(0)}%`,
          description: `${member.name}'s image appears safe.`,
        });
      }
    } catch (err) {
      toast({ title: "Scan Failed", description: "Could not analyze this image.", variant: "destructive" });
    } finally {
      setScanningIds(prev => {
        const next = new Set(prev);
        next.delete(member.id);
        return next;
      });
    }
  };

  const handleScanAllPending = async () => {
    const pending = filteredMembers.filter(m => m.image_url && !scanResults[m.id]);
    for (const member of pending) {
      await handleNsfwScan(member);
    }
  };

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["admin-discover-images", activeTab],
    queryFn: async () => {
      // Base query: members matching image_status
      const { data, error } = await supabase
        .from("members")
        .select("id, name, email, image_url, gender, country, created_at, is_discoverable")
        .not("image_url", "is", null)
        .filter("image_status", "eq", activeTab)
        .order("created_at", { ascending: false });
      if (error) throw error;
      let results = (data || []) as unknown as MemberImage[];

      // For the denied tab, also include banned users with images who aren't already in the list
      if (activeTab === "denied") {
        const { data: bans } = await supabase
          .from("user_bans")
          .select("user_id")
          .eq("is_active", true);
        if (bans && bans.length > 0) {
          const existingIds = new Set(results.map(m => m.id));
          const bannedIds = bans.map(b => b.user_id).filter(id => !existingIds.has(id));
          if (bannedIds.length > 0) {
            const { data: bannedMembers } = await supabase
              .from("members")
              .select("id, name, email, image_url, gender, country, created_at, is_discoverable")
              .in("id", bannedIds)
              .not("image_url", "is", null)
              .order("created_at", { ascending: false });
            if (bannedMembers) {
              results = [...results, ...(bannedMembers as unknown as MemberImage[])];
            }
          }
        }
      }

      return results;
    },
  });

  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return members;
    return members.filter(m =>
      (m.email || "").toLowerCase().includes(q) ||
      (m.name || "").toLowerCase().includes(q) ||
      (m.country || "").toLowerCase().includes(q) ||
      m.id.toLowerCase().includes(q)
    );
  }, [members, searchQuery]);

  const updateStatus = useMutation({
    mutationFn: async ({ memberId, status }: { memberId: string; status: ImageStatus }) => {
      const updateData: Record<string, any> = {
        image_status: status,
        is_discoverable: status === "approved",
      };
      const { error } = await supabase
        .from("members")
        .update(updateData as any)
        .eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-discover-images"] });
      queryClient.invalidateQueries({ queryKey: ["admin-discover-pending-count"] });
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

  const deleteImage = useMutation({
    mutationFn: async ({ memberId }: { memberId: string }) => {
      // Remove from storage
      await supabase.storage.from("member-photos").remove([`${memberId}/selfie.jpg`]);
      // Clear image from member record
      const { error } = await supabase
        .from("members")
        .update({ image_url: null, image_thumb_url: null, image_status: "pending", is_discoverable: false } as any)
        .eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-discover-images"] });
      queryClient.invalidateQueries({ queryKey: ["admin-discover-pending-count"] });
      toast({ title: "Image Deleted 🗑️", description: "The image has been removed and the user is no longer discoverable." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const banUser = useMutation({
    mutationFn: async ({ member, reason }: { member: MemberImage; reason: string }) => {
      // Get member's IP
      const { data: memberData } = await supabase
        .from("members")
        .select("last_ip")
        .eq("id", member.id)
        .single();

      // Insert ban
      const { error: banError } = await supabase.from("user_bans").insert({
        user_id: member.id,
        reason,
        ban_type: "standard",
        is_active: true,
        ip_address: (memberData as any)?.last_ip || null,
        banned_by: user?.id || null,
      });
      if (banError) throw banError;

      // Also deny their image and remove from discover
      await supabase
        .from("members")
        .update({ image_status: "denied", is_discoverable: false } as any)
        .eq("id", member.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-discover-images"] });
      queryClient.invalidateQueries({ queryKey: ["admin-discover-pending-count"] });
      toast({ title: "User Banned 🚫", description: `${banTarget?.name} has been banned and removed from Discover.` });
      setBanTarget(null);
      setBanReason("Inappropriate selfie (admin review)");
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Discover Image Review</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Review and approve selfies before they appear in Discover.
            {pendingCount.data ? (
              <Badge variant="destructive" className="ml-2">{pendingCount.data} pending</Badge>
            ) : null}
          </p>
        </div>
        {activeTab === "pending" && members.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleScanAllPending}
            disabled={scanningIds.size > 0}
            className="gap-1.5"
          >
            <ScanSearch className="w-4 h-4" />
            {scanningIds.size > 0 ? "Scanning..." : "NSFW Scan All"}
          </Button>
        )}
      </div>

      <Alert className="border-blue-500/30 bg-blue-500/10">
        <Info className="h-4 w-4 text-blue-400" />
        <AlertTitle className="text-blue-300 font-semibold">Moderation Guidelines</AlertTitle>
        <AlertDescription className="text-muted-foreground text-sm mt-1 space-y-1">
          <p><span className="text-green-400 font-medium">✅ Approve:</span> Clear face selfies with good lighting.</p>
          <p><span className="text-red-400 font-medium">❌ Deny:</span> Nudity, suspected underage users, ceiling/random pics, or anything inappropriate for the Discover page.</p>
          <p><span className="text-yellow-400 font-medium">⚠️ After denying:</span> Go to the <strong>Denied</strong> tab and <strong>ban the user</strong> to prevent re-uploads.</p>
        </AlertDescription>
      </Alert>


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
                      <p className="font-medium text-sm truncate text-foreground">{member.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {member.gender || "Unknown"} · {member.country || "N/A"}
                      </p>
                      {scanResults[member.id] && (
                        <Badge
                          variant={scanResults[member.id].isNsfw ? "destructive" : "secondary"}
                          className="mt-1 text-[10px]"
                        >
                          {scanResults[member.id].isNsfw ? "⚠️ NSFW" : "✅ Safe"} — {(scanResults[member.id].score * 100).toFixed(0)}%
                        </Badge>
                      )}
                    </div>

                    {/* NSFW Scan button */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-8 text-xs gap-1"
                      onClick={() => handleNsfwScan(member)}
                      disabled={scanningIds.has(member.id)}
                    >
                      <ScanSearch className="w-3.5 h-3.5" />
                      {scanningIds.has(member.id) ? "Scanning..." : "NSFW Scan"}
                    </Button>

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

                    {/* Ban button — available on all tabs */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-8 text-xs text-orange-500 border-orange-500/30 hover:bg-orange-500/10"
                      onClick={() => setBanTarget(member)}
                    >
                      <ShieldX className="w-3.5 h-3.5 mr-1" /> Ban User
                    </Button>

                    {/* Delete button — available on all tabs */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => {
                        if (confirm(`Delete ${member.name}'s image? This cannot be undone.`)) {
                          deleteImage.mutate({ memberId: member.id });
                        }
                      }}
                      disabled={deleteImage.isPending}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete Image
                    </Button>
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

      {/* Ban Confirmation Dialog */}
      <Dialog open={!!banTarget} onOpenChange={(open) => !open && setBanTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldX className="h-5 w-5 text-orange-500" />
              Ban {banTarget?.name}?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              This will ban the user and remove them from Discover immediately.
            </p>
            <div>
              <label className="text-sm font-medium">Ban Reason</label>
              <Input
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Enter ban reason..."
                className="mt-1"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setBanTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => banTarget && banUser.mutate({ member: banTarget, reason: banReason })}
              disabled={banUser.isPending || !banReason.trim()}
            >
              {banUser.isPending ? "Banning..." : "Confirm Ban"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDiscoverReviewPage;
