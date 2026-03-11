import { useState } from "react";
import { usePublicRewards, usePublicCategories, usePublicMilestones } from "@/hooks/useCrud";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Gift, Target, Crown, Star, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const RARITY_STYLES: Record<string, string> = {
  common: "bg-muted text-muted-foreground",
  rare: "bg-blue-500/10 text-blue-500 border-blue-500/30",
  legendary: "bg-amber-500/10 text-amber-500 border-amber-500/30",
};

const RewardStorePage = () => {
  const navigate = useNavigate();
  const { data: rewards, isLoading: loadingRewards } = usePublicRewards();
  const { data: categories } = usePublicCategories();
  const { data: milestones } = usePublicMilestones();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredRewards = selectedCategory
    ? rewards?.filter((r: any) => r.category_id === selectedCategory)
    : rewards;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-6 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Gift className="h-8 w-8 text-primary" />
              Reward Store
            </h1>
            <p className="text-muted-foreground mt-1">Spend your earned minutes on amazing rewards</p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-10">
        {/* Categories Filter */}
        {categories && categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedCategory === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(null)}
            >
              All
            </Button>
            {categories.map((cat: any) => (
              <Button
                key={cat.id}
                variant={selectedCategory === cat.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(cat.id)}
              >
                {cat.name}
              </Button>
            ))}
          </div>
        )}

        {/* Rewards Grid */}
        <div>
          <h2 className="text-xl font-bold text-foreground mb-4">Available Rewards</h2>
          {loadingRewards ? (
            <p className="text-muted-foreground">Loading rewards...</p>
          ) : !filteredRewards?.length ? (
            <p className="text-muted-foreground">No rewards available yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredRewards.map((reward: any) => (
                <Card key={reward.id} className="overflow-hidden hover:shadow-lg transition-shadow border-border">
                  <div className="aspect-square bg-muted flex items-center justify-center relative">
                    {reward.image_url ? (
                      <img src={reward.image_url} alt={reward.title} className="w-full h-full object-cover" />
                    ) : (
                      <Gift className="h-16 w-16 text-muted-foreground/30" />
                    )}
                    <Badge className={`absolute top-2 right-2 text-xs ${RARITY_STYLES[reward.rarity] || RARITY_STYLES.common}`}>
                      {reward.rarity === "legendary" && <Crown className="h-3 w-3 mr-1" />}
                      {reward.rarity === "rare" && <Star className="h-3 w-3 mr-1" />}
                      {reward.rarity}
                    </Badge>
                  </div>
                  <CardContent className="p-4 space-y-2">
                    <h3 className="font-bold text-foreground truncate">{reward.title}</h3>
                    {reward.reward_categories?.name && (
                      <p className="text-xs text-muted-foreground">{reward.reward_categories.name}</p>
                    )}
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-sm font-bold text-primary">
                        🪙 {reward.minutes_cost} min
                      </span>
                      <Badge variant="outline" className="text-xs">{reward.delivery}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Milestones */}
        {milestones && milestones.length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Milestones
            </h2>
            <div className="space-y-4">
              {milestones.map((ms: any) => (
                <Card key={ms.id} className="border-border">
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className="flex-shrink-0 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-lg font-bold text-primary">{ms.unlock_minutes}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-foreground">{ms.title}</h3>
                      {ms.brief && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{ms.brief}</p>}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {ms.vip_only && <Badge className="bg-amber-500/10 text-amber-500 text-xs">VIP Only</Badge>}
                        {ms.milestone_rewards?.map((mr: any) => (
                          <Badge key={mr.id} variant="outline" className="text-xs">
                            {mr.rewards?.title} ({mr.reward_type})
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Unlock at</p>
                      <p className="font-bold text-foreground">{ms.unlock_minutes} min</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RewardStorePage;
