import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateReward, useUpdateReward, useRewardCategories, useRewards } from "@/hooks/useCrud";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect } from "react";

const rewardSchema = z.object({
  title: z.string().min(1, "Title is required"),
  type: z.string().min(1, "Type is required"),
  sub_type: z.string().optional(),
  delivery: z.string().default("digital"),
  rarity: z.string().default("common"),
  category_id: z.string().optional(),
  product_name: z.string().optional(),
  sizes: z.string().optional(),
  visible: z.boolean().default(true),
  brief: z.string().optional(),
  info: z.string().optional(),
  image_url: z.string().optional(),
  minutes_cost: z.coerce.number().min(0).default(0),
});

type RewardForm = z.infer<typeof rewardSchema>;

const TYPES = ["Product / Giftcard", "Badge", "Trophy", "Certificate", "Points Bonus"];
const RARITIES = ["common", "rare", "legendary"];
const DELIVERIES = ["digital", "physical", "both"];

const AddRewardPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const createMutation = useCreateReward();
  const updateMutation = useUpdateReward();
  const { data: categories } = useRewardCategories();
  const { data: allRewards } = useRewards();

  const existingReward = isEdit ? allRewards?.find((r: any) => r.id === id) : null;

  const form = useForm<RewardForm>({
    resolver: zodResolver(rewardSchema),
    defaultValues: {
      title: "",
      type: "Product / Giftcard",
      delivery: "digital",
      rarity: "common",
      visible: true,
      minutes_cost: 0,
    },
  });

  // Populate form when editing
  useEffect(() => {
    if (existingReward) {
      form.reset({
        title: existingReward.title || "",
        type: existingReward.type || "Product / Giftcard",
        sub_type: existingReward.sub_type || "",
        delivery: existingReward.delivery || "digital",
        rarity: existingReward.rarity || "common",
        category_id: existingReward.category_id || "",
        product_name: existingReward.product_name || "",
        sizes: existingReward.sizes || "",
        visible: existingReward.visible ?? true,
        brief: existingReward.brief || "",
        info: existingReward.info || "",
        image_url: existingReward.image_url || "",
        minutes_cost: existingReward.minutes_cost || 0,
      });
    }
  }, [existingReward, form]);

  const mutation = isEdit ? updateMutation : createMutation;

  const onSubmit = (values: RewardForm) => {
    const payload = {
      ...values,
      category_id: values.category_id || null,
      ...(isEdit ? { id } : {}),
    };
    mutation.mutate(payload, {
      onSuccess: () => navigate("/admin/rewards"),
    });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight text-foreground">
        {isEdit ? "Edit Reward" : "Add New Reward"}
      </h2>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-primary border-b border-primary pb-2">
                {isEdit ? "EDIT REWARD DETAILS" : "ADD NEW REWARD DETAILS"}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl><Input placeholder="Reward title" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="sub_type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Sub Type</FormLabel>
                  <FormControl><Input placeholder="Sub type" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="delivery" render={({ field }) => (
                <FormItem>
                  <FormLabel>Delivery</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {DELIVERIES.map((d) => <SelectItem key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="rarity" render={({ field }) => (
                <FormItem>
                  <FormLabel>Rarity</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {RARITIES.map((r) => <SelectItem key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="category_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {categories?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="product_name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Product / Gift Card Name</FormLabel>
                  <FormControl><Input placeholder="Product name" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="minutes_cost" render={({ field }) => (
                <FormItem>
                  <FormLabel>Minutes Cost</FormLabel>
                  <FormControl><Input type="number" min={0} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="sizes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Sizes <span className="text-xs text-muted-foreground">(comma separated)</span></FormLabel>
                  <FormControl><Input placeholder="S, M, L, XL" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="visible" render={({ field }) => (
                <FormItem className="flex items-center gap-3 pt-6">
                  <FormLabel>Visible on Store</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )} />

              <FormField control={form.control} name="image_url" render={({ field }) => (
                <FormItem>
                  <FormLabel>Image URL</FormLabel>
                  <FormControl><Input placeholder="https://..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="info" render={({ field }) => (
                <FormItem>
                  <FormLabel>Info</FormLabel>
                  <FormControl><Input placeholder="Additional info" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <FormField control={form.control} name="brief" render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Brief</FormLabel>
                  <FormControl><Textarea rows={5} placeholder="Describe this reward..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={() => navigate("/admin/rewards")}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : isEdit ? "Update Reward" : "Save Reward"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default AddRewardPage;
