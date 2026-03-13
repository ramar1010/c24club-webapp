import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, CreditCard, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const AdminGiftCardsPage = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editCard, setEditCard] = useState<any>(null);
  const [brand, setBrand] = useState("");
  const [valueAmount, setValueAmount] = useState("");
  const [code, setCode] = useState("");
  const [minutesCost, setMinutesCost] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  // Bulk
  const [bulkBrand, setBulkBrand] = useState("");
  const [bulkValue, setBulkValue] = useState("");
  const [bulkMinutes, setBulkMinutes] = useState("");
  const [bulkCodes, setBulkCodes] = useState("");
  const [bulkImageUrl, setBulkImageUrl] = useState("");
  const [filter, setFilter] = useState<"all" | "available" | "claimed">("all");

  const { data: giftCards, isLoading } = useQuery({
    queryKey: ["admin-gift-cards", filter],
    queryFn: async () => {
      let q = supabase.from("gift_cards" as any).select("*").order("created_at", { ascending: false });
      if (filter === "available") q = q.eq("status", "available");
      if (filter === "claimed") q = q.eq("status", "claimed");
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async (card: { brand: string; value_amount: number; code: string; minutes_cost: number; image_url?: string }) => {
      const { error } = await supabase.from("gift_cards" as any).insert(card as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-gift-cards"] });
      toast.success("Gift card added!");
      setOpen(false);
      setBrand(""); setValueAmount(""); setCode(""); setMinutesCost(""); setImageUrl("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const bulkMutation = useMutation({
    mutationFn: async (cards: any[]) => {
      const { error } = await supabase.from("gift_cards" as any).insert(cards as any);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin-gift-cards"] });
      toast.success(`${(vars as any[]).length} gift cards added!`);
      setBulkOpen(false);
      setBulkBrand(""); setBulkValue(""); setBulkMinutes(""); setBulkCodes(""); setBulkImageUrl("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("gift_cards" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-gift-cards"] });
      toast.success("Gift card deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleAdd = () => {
    if (!brand || !code || !minutesCost) return toast.error("Fill in required fields");
    addMutation.mutate({
      brand,
      value_amount: parseFloat(valueAmount) || 0,
      code,
      minutes_cost: parseInt(minutesCost) || 0,
      image_url: imageUrl || undefined,
    });
  };

  const handleBulkAdd = () => {
    if (!bulkBrand || !bulkCodes || !bulkMinutes) return toast.error("Fill in required fields");
    const codes = bulkCodes.split("\n").map(c => c.trim()).filter(Boolean);
    if (!codes.length) return toast.error("No codes found");
    const cards = codes.map(c => ({
      brand: bulkBrand,
      value_amount: parseFloat(bulkValue) || 0,
      code: c,
      minutes_cost: parseInt(bulkMinutes) || 0,
      image_url: bulkImageUrl || undefined,
    }));
    bulkMutation.mutate(cards);
  };

  const availableCount = giftCards?.filter((c: any) => c.status === "available").length ?? 0;
  const claimedCount = giftCards?.filter((c: any) => c.status === "claimed").length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gift Cards</h1>
          <p className="text-muted-foreground text-sm">Manage gift card codes for the reward store</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm"><Upload className="w-4 h-4 mr-1" /> Bulk Add</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Bulk Add Gift Cards</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Brand *</Label><Input value={bulkBrand} onChange={e => setBulkBrand(e.target.value)} placeholder="Amazon" /></div>
                <div><Label>Card Value ($)</Label><Input type="number" value={bulkValue} onChange={e => setBulkValue(e.target.value)} placeholder="25" /></div>
                <div><Label>Minutes Cost *</Label><Input type="number" value={bulkMinutes} onChange={e => setBulkMinutes(e.target.value)} placeholder="500" /></div>
                <div><Label>Image URL</Label><Input value={bulkImageUrl} onChange={e => setBulkImageUrl(e.target.value)} placeholder="https://..." /></div>
                <div><Label>Codes (one per line) *</Label><textarea className="w-full border rounded-md p-2 min-h-[120px] text-sm bg-background" value={bulkCodes} onChange={e => setBulkCodes(e.target.value)} placeholder={"CODE-001\nCODE-002\nCODE-003"} /></div>
                <Button onClick={handleBulkAdd} disabled={bulkMutation.isPending} className="w-full">
                  {bulkMutation.isPending ? "Adding..." : `Add ${bulkCodes.split("\n").filter(c => c.trim()).length} Cards`}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Add Card</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Gift Card</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Brand *</Label><Input value={brand} onChange={e => setBrand(e.target.value)} placeholder="Amazon" /></div>
                <div><Label>Card Value ($)</Label><Input type="number" value={valueAmount} onChange={e => setValueAmount(e.target.value)} placeholder="25" /></div>
                <div><Label>Code *</Label><Input value={code} onChange={e => setCode(e.target.value)} placeholder="XXXX-XXXX-XXXX" /></div>
                <div><Label>Minutes Cost *</Label><Input type="number" value={minutesCost} onChange={e => setMinutesCost(e.target.value)} placeholder="500" /></div>
                <div><Label>Image URL</Label><Input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." /></div>
                <Button onClick={handleAdd} disabled={addMutation.isPending} className="w-full">
                  {addMutation.isPending ? "Adding..." : "Add Gift Card"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-3">
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-2">
          <span className="text-green-500 font-bold text-lg">{availableCount}</span>
          <span className="text-muted-foreground text-sm ml-1">Available</span>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg px-4 py-2">
          <span className="text-blue-500 font-bold text-lg">{claimedCount}</span>
          <span className="text-muted-foreground text-sm ml-1">Claimed</span>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(["all", "available", "claimed"] as const).map(f => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} className="capitalize">
            {f}
          </Button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">Loading...</div>
      ) : !giftCards?.length ? (
        <div className="text-center py-10 text-muted-foreground">
          <CreditCard className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p>No gift cards yet. Add some to get started!</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Brand</th>
                <th className="text-left p-3 font-medium">Value</th>
                <th className="text-left p-3 font-medium">Code</th>
                <th className="text-left p-3 font-medium">Cost</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {giftCards.map((card: any) => (
                <tr key={card.id} className="border-t">
                  <td className="p-3 font-medium">{card.brand}</td>
                  <td className="p-3">${Number(card.value_amount).toFixed(2)}</td>
                  <td className="p-3 font-mono text-xs">{card.status === "available" ? card.code : "••••••••"}</td>
                  <td className="p-3">🪙 {card.minutes_cost}</td>
                  <td className="p-3">
                    <Badge variant={card.status === "available" ? "default" : "secondary"}>
                      {card.status}
                    </Badge>
                  </td>
                  <td className="p-3">
                    {card.status === "available" && (
                      <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(card.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminGiftCardsPage;
