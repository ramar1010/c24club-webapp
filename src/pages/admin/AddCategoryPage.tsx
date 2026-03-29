import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateCategory, useUpdateCategory, useRewardCategories } from "@/hooks/useCrud";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useEffect } from "react";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  show_as: z.string().default("Only as normal Reward"),
  status: z.string().default("active"),
  image_url: z.string().optional(),
});

type CategoryForm = z.infer<typeof schema>;

const SHOW_AS_OPTIONS = ["Only as normal Reward", "As VIP Reward", "As Featured"];

const AddCategoryPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const { data: allCategories } = useRewardCategories();

  const existingCategory = isEdit ? allCategories?.find((c: any) => c.id === id) : null;

  const form = useForm<CategoryForm>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", show_as: "Only as normal Reward", status: "active" },
  });

  useEffect(() => {
    if (existingCategory) {
      form.reset({
        name: existingCategory.name || "",
        show_as: existingCategory.show_as || "Only as normal Reward",
        status: existingCategory.status || "active",
        image_url: existingCategory.image_url || "",
      });
    }
  }, [existingCategory, form]);

  const mutation = isEdit ? updateMutation : createMutation;

  const onSubmit = (values: CategoryForm) => {
    const payload = isEdit ? { ...values, id } : values;
    mutation.mutate(payload, {
      onSuccess: () => navigate("/admin/categories"),
    });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight text-foreground">
        {isEdit ? "Edit Category" : "Add New Category"}
      </h2>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-primary border-b border-primary pb-2">
                {isEdit ? "EDIT CATEGORY DETAILS" : "ADD NEW CATEGORY DETAILS"}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl><Input placeholder="Category name" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="show_as" render={({ field }) => (
                <FormItem>
                  <FormLabel>Category Show As</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {SHOW_AS_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Category Status</FormLabel>
                  <FormControl>
                    <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-6 mt-2">
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="active" id="active" />
                        <Label htmlFor="active">Active</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="inactive" id="inactive" />
                        <Label htmlFor="inactive">Inactive</Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="image_url" render={({ field }) => (
                <FormItem>
                  <FormLabel>Image URL <span className="text-xs text-muted-foreground">(100x100px)</span></FormLabel>
                  <FormControl><Input placeholder="https://..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={() => navigate("/admin/categories")}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving..." : isEdit ? "Update Category" : "Save"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default AddCategoryPage;
