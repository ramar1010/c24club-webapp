import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronDown, ChevronUp, Gift, Pencil, Copy, Check } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useVipStatus } from "@/hooks/useVipStatus";
import { toast } from "sonner";

const RARITY_COLORS: Record<string, string> = {
  common: "text-white",
  rare: "text-red-500",
  legendary: "text-yellow-400",
};

const RARITY_EMOJI: Record<string, string> = {
  common: "",
  rare: "🔥",
  legendary: "👑",
};

const FILTER_OPTIONS = ["Products", "Giftcards", "Perks"] as const;
type FilterType = (typeof FILTER_OPTIONS)[number];

const filterToType: Record<FilterType, string> = {
  Products: "product",
  Giftcards: "giftcard",
  Perks: "perk",
};

// Statuses that mean the item is already shipped/completed — no editing allowed
const SHIPPED_STATUSES = ["Order shipped", "Gift Card Sent on Email", "completed", "delivered"];

const STATUS_LABELS: Record<string, { text: string; color: string }> = {
  "processing": { text: "🔄 Processing your order...", color: "text-blue-400" },
  "pending_shipping": { text: "📦 Preparing to ship — please wait!", color: "text-yellow-400" },
  "pending_payment": { text: "💳 Awaiting shipping payment", color: "text-orange-400" },
  "Order placed": { text: "✅ Order has been placed — please wait!", color: "text-cyan-400" },
  "Order shipped": { text: "🚚 Your order has been shipped!", color: "text-green-400" },
  "Item Out of stock": { text: "❌ Item is currently out of stock", color: "text-red-400" },
  "Gift Card Form Filled by user": { text: "📝 Gift card form received — processing!", color: "text-indigo-400" },
  "Gift Card Sent on Email": { text: "✉️ Gift card sent to your email!", color: "text-emerald-400" },
  "Redeemed Milestone Reward": { text: "🏆 Milestone reward redeemed!", color: "text-purple-400" },
  "Redeemed Product Point Reward": { text: "🎯 Point reward redeemed!", color: "text-violet-400" },
  "Redeemed VIP Gift Reward": { text: "⭐ VIP gift reward redeemed!", color: "text-amber-400" },
  "Redeemed as Anchor User Reward": { text: "⚓ Anchor reward redeemed!", color: "text-teal-400" },
};

const MyRewardsPage = ({ onClose }: { onClose?: () => void }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<FilterType>("Products");

  const [showGifts, setShowGifts] = useState(false);
  const { subscribed } = useVipStatus(user?.id ?? null);

  const queryClient = useQueryClient();
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    shipping_name: "",
    shipping_address: "",
    shipping_city: "",
    shipping_state: "",
    shipping_zip: "",
    shipping_country: "",
  });
  const [saving, setSaving] = useState(false);
  const [copiedCardId, setCopiedCardId] = useState<string | null>(null);

  const { data: redemptions = [], isLoading } = useQuery({
    queryKey: ["my-redemptions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_redemptions")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: giftsReceived = [], isLoading: giftsLoading } = useQuery({
    queryKey: ["gifts-received", user?.id],
    enabled: !!user && subscribed,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gift_transactions")
        .select("*")
        .eq("recipient_id", user!.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch claimed gift cards with codes
  const { data: claimedGiftCards = [], isLoading: giftCardsLoading } = useQuery({
    queryKey: ["my-gift-cards", user?.id],
    enabled: !!user && selectedFilter === "Giftcards",
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("redeem-giftcard", {
        body: { action: "my-cards" },
      });
      if (error) throw error;
      return data?.cards || [];
    },
  });

  const handleCopyCode = (code: string, cardId: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCardId(cardId);
    toast.success("Code copied!");
    setTimeout(() => setCopiedCardId(null), 2000);
  };

  const filtered = redemptions.filter(
    (r: any) => r.reward_type === filterToType[selectedFilter]
  );

  const handleFilterSelect = (f: FilterType) => {
    setSelectedFilter(f);
    setDropdownOpen(false);
  };

  const canEditShipping = (status: string) => !SHIPPED_STATUSES.includes(status);

  const getStatusDisplay = (item: any) => {
    const mapped = STATUS_LABELS[item.status];
    if (mapped) return mapped;
    return { text: item.status, color: "text-neutral-300" };
  };

  const openEditShipping = (item: any) => {
    setEditForm({
      shipping_name: item.shipping_name || "",
      shipping_address: item.shipping_address || "",
      shipping_city: item.shipping_city || "",
      shipping_state: item.shipping_state || "",
      shipping_zip: item.shipping_zip || "",
      shipping_country: item.shipping_country || "",
    });
    setEditingItem(item);
  };

  const handleSaveShipping = async () => {
    if (!editingItem) return;
    if (!editForm.shipping_name || !editForm.shipping_address || !editForm.shipping_country) {
      toast.error("Please fill in name, address, and country");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("member_redemptions")
        .update({
          shipping_name: editForm.shipping_name,
          shipping_address: editForm.shipping_address,
          shipping_city: editForm.shipping_city,
          shipping_state: editForm.shipping_state,
          shipping_zip: editForm.shipping_zip,
          shipping_country: editForm.shipping_country,
        })
        .eq("id", editingItem.id)
        .eq("user_id", user!.id);
      if (error) throw error;
      toast.success("Shipping details updated!");
      setEditingItem(null);
      queryClient.invalidateQueries({ queryKey: ["my-redemptions"] });
    } catch (e: any) {
      toast.error(e.message || "Failed to update");
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-black text-white font-['Antigone',sans-serif] flex flex-col">
      {/* Back button */}
      <div className="w-full flex items-center pt-3 pb-2 px-4">
        <button
          onClick={() => onClose ? onClose() : navigate(-1)}
          className="flex items-center gap-1 hover:opacity-80 transition-opacity"
        >
          <ChevronLeft className="w-7 h-7" />
          <span className="font-black text-sm tracking-wider">BACK</span>
        </button>
      </div>

      {/* Title */}
      <h1 className="text-4xl font-black text-center italic mt-2 mb-6">
        My Rewards
      </h1>

      {/* Dropdown filter */}
      <div className="px-6 mb-6">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="w-full bg-black border-2 border-white rounded-full py-3 px-6 flex items-center justify-center gap-2 font-black text-lg tracking-wide"
        >
          {selectedFilter}
          {dropdownOpen ? (
            <ChevronUp className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
        </button>

        {dropdownOpen && (
          <div className="border-2 border-white rounded-2xl mt-2 overflow-hidden bg-black">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt}
                onClick={() => handleFilterSelect(opt)}
                className={`w-full py-3 text-center font-black text-lg tracking-wide hover:bg-neutral-800 transition-colors ${
                  opt === selectedFilter ? "text-white" : "text-neutral-400"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Rewards grid */}
      <div className="flex-1 px-4 pb-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-neutral-500 text-center py-16 font-bold">
            No redeemed {selectedFilter.toLowerCase()} yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
            {filtered.map((item: any) => {
              const rarityColor = RARITY_COLORS[item.reward_rarity] || "text-white";
              const rarityEmoji = RARITY_EMOJI[item.reward_rarity] || "";
              const isLegendaryCashout = item.cashout_amount && item.cashout_amount > 0;
              const statusDisplay = getStatusDisplay(item);

              return (
                <div
                  key={item.id}
                  className="rounded-2xl overflow-hidden bg-neutral-900 border border-neutral-800"
                >
                  {/* Rarity label */}
                  <div className="px-3 pt-2">
                    <span className={`font-black text-sm ${rarityColor}`}>
                      {item.reward_rarity.charAt(0).toUpperCase() +
                        item.reward_rarity.slice(1)}
                      {rarityEmoji}
                    </span>
                    {isLegendaryCashout && (
                      <span className="block text-green-400 font-black text-xs">
                        Cash Out ${item.cashout_amount}
                      </span>
                    )}
                  </div>

                  {/* Image */}
                  <div className="aspect-square bg-neutral-800 mx-2 mt-1 rounded-xl overflow-hidden">
                    {item.reward_image_url ? (
                      <img
                        src={item.reward_image_url}
                        alt={item.reward_title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-4xl">🎁</span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3 text-center">
                    <p className="font-black text-sm leading-tight">
                      {item.reward_title}
                    </p>

                    {isLegendaryCashout ? (
                      <>
                        <p className="text-green-400 font-black text-xs mt-1">
                          💰 You cashed out ${item.cashout_amount}
                        </p>
                        {item.cashout_paypal && (
                          <p className="text-[10px] text-neutral-400 mt-1">
                            PayPal: {item.cashout_paypal}
                          </p>
                        )}
                        <p className={`text-xs font-bold mt-1 ${statusDisplay.color}`}>
                          {statusDisplay.text}
                        </p>
                        <p className="text-[10px] text-neutral-500 font-bold mt-1 uppercase">
                          CASHOUT REWARD
                        </p>
                      </>
                    ) : (
                      <>
                        {/* Dynamic status from admin */}
                        <p className={`text-[10px] font-bold mt-1 ${statusDisplay.color}`}>
                          {statusDisplay.text}
                        </p>

                        {/* Tracking link if shipped */}
                        {item.shipping_tracking_url && (
                          <a
                            href={item.shipping_tracking_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 font-bold text-[10px] mt-1 hover:underline inline-block"
                          >
                            📍 Track Shipment
                          </a>
                        )}

                        {/* Edit shipping - only if not shipped yet */}
                        {canEditShipping(item.status) && item.reward_type === "product" && (
                          <button
                            onClick={() => openEditShipping(item)}
                            className="text-red-500 font-bold text-xs mt-2 hover:underline flex items-center justify-center gap-1 mx-auto"
                          >
                            <Pencil className="w-3 h-3" />
                            Edit Shipping Details
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Shipping Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center">
          <div className="bg-neutral-900 w-full max-w-md rounded-t-3xl p-6 space-y-3 max-h-[85vh] overflow-y-auto pb-10">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-black text-lg">Edit Shipping Details</h2>
              <button onClick={() => setEditingItem(null)} className="text-neutral-400 font-bold text-sm">
                ✕
              </button>
            </div>

            <input
              placeholder="Full Name *"
              value={editForm.shipping_name}
              onChange={(e) => setEditForm(f => ({ ...f, shipping_name: e.target.value }))}
              className="w-full bg-white/10 border-2 border-white/20 rounded-xl px-4 py-3 font-bold text-white placeholder:text-white/40 focus:outline-none focus:border-white/50"
            />
            <input
              placeholder="Country/Region *"
              value={editForm.shipping_country}
              onChange={(e) => setEditForm(f => ({ ...f, shipping_country: e.target.value }))}
              className="w-full bg-white/10 border-2 border-white/20 rounded-xl px-4 py-3 font-bold text-white placeholder:text-white/40 focus:outline-none focus:border-white/50"
            />
            <textarea
              placeholder="Address *"
              value={editForm.shipping_address}
              onChange={(e) => setEditForm(f => ({ ...f, shipping_address: e.target.value }))}
              rows={2}
              className="w-full bg-white/10 border-2 border-white/20 rounded-xl px-4 py-3 font-bold text-white placeholder:text-white/40 focus:outline-none focus:border-white/50 resize-none"
            />
            <input
              placeholder="City"
              value={editForm.shipping_city}
              onChange={(e) => setEditForm(f => ({ ...f, shipping_city: e.target.value }))}
              className="w-full bg-white/10 border-2 border-white/20 rounded-xl px-4 py-3 font-bold text-white placeholder:text-white/40 focus:outline-none focus:border-white/50"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                placeholder="State"
                value={editForm.shipping_state}
                onChange={(e) => setEditForm(f => ({ ...f, shipping_state: e.target.value }))}
                className="w-full bg-white/10 border-2 border-white/20 rounded-xl px-4 py-3 font-bold text-white placeholder:text-white/40 focus:outline-none focus:border-white/50"
              />
              <input
                placeholder="Zip"
                value={editForm.shipping_zip}
                onChange={(e) => setEditForm(f => ({ ...f, shipping_zip: e.target.value }))}
                className="w-full bg-white/10 border-2 border-white/20 rounded-xl px-4 py-3 font-bold text-white placeholder:text-white/40 focus:outline-none focus:border-white/50"
              />
            </div>

            <button
              onClick={handleSaveShipping}
              disabled={saving}
              className="w-full bg-white text-black font-black text-lg py-3 rounded-full hover:opacity-90 transition-opacity disabled:opacity-50 mt-4"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      )}

      {/* Gifts Received - VIP only */}
      {subscribed && (
        <div className="px-4 pb-4">
          <button
            onClick={() => setShowGifts(!showGifts)}
            className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600/20 border border-purple-500/30 rounded-2xl font-black text-sm tracking-wide text-purple-300 hover:bg-purple-600/30 transition-colors"
          >
            <Gift className="w-5 h-5" />
            GIFTS RECEIVED ({giftsReceived.length})
            {showGifts ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showGifts && (
            <div className="mt-3 space-y-2">
              {giftsLoading ? (
                <div className="flex justify-center py-6">
                  <div className="w-8 h-8 border-4 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
                </div>
              ) : giftsReceived.length === 0 ? (
                <p className="text-neutral-500 text-center py-6 font-bold text-sm">
                  No gifts received yet.
                </p>
              ) : (
                giftsReceived.map((gift: any) => (
                  <div
                    key={gift.id}
                    className="flex items-center justify-between bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-purple-600/20 flex items-center justify-center">
                        <Gift className="w-5 h-5 text-purple-400" />
                      </div>
                      <div>
                        <p className="font-black text-sm">+{gift.minutes_amount} Minutes</p>
                        <p className="text-[10px] text-neutral-500">
                          From: {gift.sender_id.slice(0, 8)}...
                        </p>
                      </div>
                    </div>
                    <p className="text-[10px] text-neutral-500 font-bold">
                      {new Date(gift.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Unlock Rewards Early */}
      <div className="px-6 pb-8 pt-4">
        <button className="w-full bg-gradient-to-r from-red-600 to-orange-500 text-white font-black text-lg py-3 rounded-full hover:opacity-90 transition-opacity shadow-lg tracking-wide">
          Unlock Rewards Early
        </button>
      </div>
    </div>
  );
};

export default MyRewardsPage;
