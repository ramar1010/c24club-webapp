import { useNavigate, useParams } from "react-router-dom";
import { useForm, useFieldArray } from "react-hook-form";
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
import { useEffect, useState } from "react";
import { Plus, Trash2, X, Link, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  target_gender: z.string().optional(),
  
  minutes_cost: z.coerce.number().min(0).default(0),
  shipping_fee: z.coerce.number().min(0).default(0),
  grant_amount: z.coerce.number().min(0).default(0),
});

type RewardForm = z.infer<typeof rewardSchema>;

const TYPES = ["Product / Giftcard", "Badge", "Trophy", "Certificate", "Points Bonus", "Spins", "Ad Points"];
const RARITIES = ["common", "rare", "legendary"];
const DELIVERIES = ["digital", "physical", "both"];
const GENDERS = [{ value: "both", label: "Both (no filter)" }, { value: "male", label: "Male" }, { value: "female", label: "Female" }];

const AddRewardPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const createMutation = useCreateReward();
  const updateMutation = useUpdateReward();
  const { data: categories } = useRewardCategories();
  const { data: allRewards } = useRewards();

  const existingReward = isEdit ? allRewards?.find((r: any) => r.id === id) : null;

  // AliExpress import
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);

  const handleImport = async () => {
    if (!importUrl.trim()) return;
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("scrape-product", {
        body: { url: importUrl.trim() },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Import failed");

      // Fill form fields
      if (data.title) form.setValue("title", data.title);
      if (data.description) form.setValue("brief", data.description);
      if (data.images?.length > 0) {
        form.setValue("image_url", data.images[0]);
        setVariationImages(data.images.slice(1));
      }
      if (data.sizes?.length > 0) {
        form.setValue("sizes", data.sizes.join(", "));
      }
      if (data.colors?.length > 0) {
        setColorOptions(data.colors);
      }
      form.setValue("type", "Product / Giftcard");
      form.setValue("delivery", "physical");

      toast.success(`Imported "${data.title}" with ${data.images?.length || 0} images`);
    } catch (e: any) {
      toast.error(e.message || "Failed to import product");
    } finally {
      setImporting(false);
    }
  };

  // Variation images (array of URLs)
  const [variationImages, setVariationImages] = useState<string[]>([]);
  const [newVariationUrl, setNewVariationUrl] = useState("");

  // Bulk URL paste
  const [bulkUrlText, setBulkUrlText] = useState("");
  const parsedBulkUrls = (() => {
    // Extract anything that looks like an http(s) image URL from pasted text/HTML
    const matches = bulkUrlText.match(/https?:\/\/[^\s"'<>)]+\.(?:jpe?g|png|webp|gif|avif)(?:\?[^\s"'<>)]*)?/gi) ?? [];
    // Also accept plain URLs one-per-line even without image extension (CDNs sometimes omit it)
    const lineUrls = bulkUrlText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => /^https?:\/\/\S+$/i.test(l));
    return Array.from(new Set([...matches, ...lineUrls]));
  })();
  const addBulkUrls = (asMain: boolean) => {
    if (parsedBulkUrls.length === 0) return;
    let urls = parsedBulkUrls;
    if (asMain && !form.getValues("image_url")) {
      form.setValue("image_url", urls[0]);
      urls = urls.slice(1);
    }
    setVariationImages((prev) => Array.from(new Set([...prev, ...urls])));
    setBulkUrlText("");
    toast.success(`Added ${parsedBulkUrls.length} image${parsedBulkUrls.length === 1 ? "" : "s"}`);
  };

  // Color options: { name, hex, image_url }
  const [colorOptions, setColorOptions] = useState<{ name: string; hex: string; image_url: string }[]>([]);

  const form = useForm<RewardForm>({
    resolver: zodResolver(rewardSchema),
    defaultValues: {
      title: "",
      type: "Product / Giftcard",
      delivery: "digital",
      rarity: "common",
      visible: true,
      minutes_cost: 0,
      shipping_fee: 0,
      grant_amount: 0,
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
        target_gender: existingReward.target_gender || "both",
        
        minutes_cost: existingReward.minutes_cost || 0,
        shipping_fee: existingReward.shipping_fee || 0,
        grant_amount: existingReward.grant_amount || 0,
      });
      setVariationImages(existingReward.variation_images || []);
      setColorOptions(Array.isArray(existingReward.color_options) ? existingReward.color_options as any[] : []);
    }
  }, [existingReward, form]);

  const mutation = isEdit ? updateMutation : createMutation;

  const onSubmit = (values: RewardForm) => {
    const payload = {
      ...values,
      category_id: values.category_id || null,
      target_gender: values.target_gender === "both" ? null : values.target_gender || null,
      
      variation_images: variationImages,
      color_options: colorOptions,
      ...(isEdit ? { id } : {}),
    };
    mutation.mutate(payload, {
      onSuccess: () => navigate("/admin/rewards"),
    });
  };

  const addVariationImage = () => {
    if (newVariationUrl.trim()) {
      setVariationImages((prev) => [...prev, newVariationUrl.trim()]);
      setNewVariationUrl("");
    }
  };

  const removeVariationImage = (index: number) => {
    setVariationImages((prev) => prev.filter((_, i) => i !== index));
  };

  const addColorOption = () => {
    setColorOptions((prev) => [...prev, { name: "", hex: "#000000", image_url: "" }]);
  };

  const updateColorOption = (index: number, field: string, value: string) => {
    setColorOptions((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
  };

  const removeColorOption = (index: number) => {
    setColorOptions((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight text-foreground">
        {isEdit ? "Edit Reward" : "Add New Reward"}
      </h2>

      {!isEdit && (
        <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-primary flex items-center gap-2">
              <Link className="w-4 h-4" /> QUICK IMPORT FROM URL
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              Paste an AliExpress (or any product) link to auto-fill title, images, sizes, colors & description.
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="https://www.aliexpress.com/item/..."
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleImport())}
                disabled={importing}
              />
              <Button type="button" onClick={handleImport} disabled={importing || !importUrl.trim()} className="gap-2 shrink-0">
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link className="w-4 h-4" />}
                {importing ? "Importing..." : "Import"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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

              <FormField control={form.control} name="shipping_fee" render={({ field }) => (
                <FormItem>
                  <FormLabel>Shipping Fee ($) <span className="text-xs text-muted-foreground">0 = free</span></FormLabel>
                  <FormControl><Input type="number" min={0} step="0.01" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {(form.watch("type") === "Spins" || form.watch("type") === "Ad Points") && (
                <FormField control={form.control} name="grant_amount" render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {form.watch("type") === "Spins" ? "Spins Granted" : "Ad Points Granted"}
                    </FormLabel>
                    <FormControl><Input type="number" min={1} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              )}

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

              <FormField control={form.control} name="info" render={({ field }) => (
                <FormItem>
                  <FormLabel>Info</FormLabel>
                  <FormControl><Input placeholder="Additional info" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="target_gender" render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Gender <span className="text-xs text-muted-foreground">(for reward carousel)</span></FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || "both"}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Both genders" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {GENDERS.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* Images Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-primary border-b border-primary pb-2">IMAGES</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Main image */}
              <FormField control={form.control} name="image_url" render={({ field }) => (
                <FormItem>
                  <FormLabel>Main Image URL</FormLabel>
                  <FormControl><Input placeholder="https://..." {...field} /></FormControl>
                  {field.value && (
                    <img src={field.value} alt="Preview" className="w-20 h-20 object-cover rounded-lg mt-2 border" />
                  )}
                  <FormMessage />
                </FormItem>
              )} />


              {/* Bulk URL paste */}
              <div className="rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-3 space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Link className="w-4 h-4 text-primary" /> BULK IMAGE PASTE
                </label>
                <p className="text-xs text-muted-foreground">
                  Paste image URLs (one per line) <em>or</em> the raw HTML of a product page (Ctrl+U → copy). We'll auto-extract every image link.
                  Use with browser extensions like <strong>AliPrice</strong>, <strong>Fatkun</strong>, or <strong>Image Downloader</strong>.
                </p>
                <Textarea
                  placeholder={"https://cdn.example.com/image1.jpg\nhttps://cdn.example.com/image2.jpg\n...or paste raw HTML here"}
                  value={bulkUrlText}
                  onChange={(e) => setBulkUrlText(e.target.value)}
                  rows={4}
                  className="font-mono text-xs"
                />
                {parsedBulkUrls.length > 0 && (
                  <>
                    <p className="text-xs text-primary font-medium">
                      Detected {parsedBulkUrls.length} image{parsedBulkUrls.length === 1 ? "" : "s"}:
                    </p>
                    <div className="flex gap-2 flex-wrap max-h-32 overflow-y-auto">
                      {parsedBulkUrls.slice(0, 30).map((u, i) => (
                        <img
                          key={i}
                          src={u}
                          alt={`Preview ${i + 1}`}
                          className="w-12 h-12 object-cover rounded border"
                          onError={(e) => ((e.target as HTMLImageElement).style.opacity = "0.2")}
                        />
                      ))}
                      {parsedBulkUrls.length > 30 && (
                        <span className="text-xs text-muted-foreground self-center">+{parsedBulkUrls.length - 30} more</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" onClick={() => addBulkUrls(true)}>
                        Add All (1st as Main)
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => addBulkUrls(false)}>
                        Add All as Variations
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setBulkUrlText("")}>
                        Clear
                      </Button>
                    </div>
                  </>
                )}
              </div>

              {/* Variation images */}
              <div>
                <label className="text-sm font-medium">Variation Images</label>
                <p className="text-xs text-muted-foreground mb-2">Additional product photos users can browse</p>
                <div className="flex gap-2 mb-2">
                  <Input
                    placeholder="https://..."
                    value={newVariationUrl}
                    onChange={(e) => setNewVariationUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addVariationImage())}
                  />
                  <Button type="button" size="sm" onClick={addVariationImage}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {variationImages.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {variationImages.map((url, i) => (
                      <div key={i} className="relative group">
                        <img src={url} alt={`Variation ${i + 1}`} className="w-16 h-16 object-cover rounded-lg border" />
                        <button
                          type="button"
                          onClick={() => removeVariationImage(i)}
                          className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Color Options Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-primary border-b border-primary pb-2">COLOR OPTIONS</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Add colors users can choose from. Each color can have its own product image — paste a URL directly, or paste raw HTML / multiple URLs into the smart field and we'll grab the first image.
              </p>
              {colorOptions.map((color, i) => {
                const extractFirstImage = (text: string) => {
                  const m = text.match(/https?:\/\/[^\s"'<>)]+\.(?:jpe?g|png|webp|gif|avif)(?:\?[^\s"'<>)]*)?/i);
                  if (m) return m[0];
                  const line = text.split(/\r?\n/).map((l) => l.trim()).find((l) => /^https?:\/\/\S+$/i.test(l));
                  return line || text.trim();
                };
                return (
                  <div key={i} className="p-3 rounded-lg border bg-muted/30 space-y-3">
                    <div className="flex items-end gap-3 flex-wrap">
                      <div className="flex-1 min-w-[160px] space-y-1">
                        <label className="text-xs font-medium">Color Name</label>
                        <Input
                          placeholder="e.g. Midnight Black"
                          value={color.name}
                          onChange={(e) => updateColorOption(i, "name", e.target.value)}
                        />
                      </div>
                      <div className="w-20 space-y-1">
                        <label className="text-xs font-medium">Hex</label>
                        <div className="flex items-center gap-1">
                          <input
                            type="color"
                            value={color.hex}
                            onChange={(e) => updateColorOption(i, "hex", e.target.value)}
                            className="w-8 h-8 rounded cursor-pointer border-0"
                          />
                          <span className="text-xs text-muted-foreground">{color.hex}</span>
                        </div>
                      </div>
                      <div className="flex-1 min-w-[200px] space-y-1">
                        <label className="text-xs font-medium">Image URL</label>
                        <Input
                          placeholder="https://..."
                          value={color.image_url}
                          onChange={(e) => updateColorOption(i, "image_url", e.target.value)}
                        />
                      </div>
                      {color.image_url && (
                        <img src={color.image_url} alt={color.name} className="w-12 h-12 object-cover rounded border" />
                      )}
                      <Button type="button" size="icon" variant="ghost" onClick={() => removeColorOption(i)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>

                    {/* Smart paste — extract image URL from HTML or multi-line */}
                    <div className="space-y-1">
                      <label className="text-xs font-medium flex items-center gap-1.5 text-primary">
                        <Link className="w-3 h-3" /> Smart paste (HTML or URLs)
                      </label>
                      <div className="flex gap-2">
                        <Textarea
                          placeholder="Paste raw HTML, multiple URLs, or right-click → Copy image address"
                          rows={2}
                          className="font-mono text-xs"
                          onPaste={(e) => {
                            const text = e.clipboardData.getData("text");
                            const url = extractFirstImage(text);
                            if (url && /^https?:\/\//i.test(url)) {
                              e.preventDefault();
                              updateColorOption(i, "image_url", url);
                              toast.success(`Image set for ${color.name || "color"}`);
                              (e.target as HTMLTextAreaElement).value = "";
                            }
                          }}
                        />
                        {variationImages[i] && !color.image_url && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="shrink-0"
                            onClick={() => updateColorOption(i, "image_url", variationImages[i])}
                          >
                            Use variation #{i + 1}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="flex gap-2 flex-wrap">
                <Button type="button" variant="outline" size="sm" onClick={addColorOption} className="gap-1">
                  <Plus className="w-4 h-4" /> Add Color
                </Button>
                {variationImages.length > 0 && colorOptions.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setColorOptions((prev) =>
                        prev.map((c, i) => (c.image_url || !variationImages[i] ? c : { ...c, image_url: variationImages[i] }))
                      );
                      toast.success("Auto-assigned variation images to colors");
                    }}
                  >
                    Auto-assign from variations
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Brief */}
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
