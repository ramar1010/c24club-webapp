import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateMilestone, useRewards } from "@/hooks/useCrud";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  unlock_minutes: z.coerce.number().min(0).default(0),
  enable_shipping: z.boolean().default(true),
  vip_only: z.boolean().default(false),
  brief: z.string().optional(),
});

type MilestoneForm = z.infer<typeof schema>;

const AddMilestonePage = () => {
  const navigate = useNavigate();
  const createMutation = useCreateMilestone();

  const form = useForm<MilestoneForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      unlock_minutes: 0,
      enable_shipping: true,
      vip_only: false,
    },
  });

  const onSubmit = (values: MilestoneForm) => {
    createMutation.mutate(values, {
      onSuccess: () => navigate("/admin/milestones"),
    });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight text-foreground">Add New Milestone</h2>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-primary border-b border-primary pb-2">
                ADD NEW MILESTONE DETAILS
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl><Input placeholder="Milestone title" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="unlock_minutes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Unlock on Minutes</FormLabel>
                  <FormControl><Input type="number" min={0} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="enable_shipping" render={({ field }) => (
                <FormItem className="flex items-center gap-3 pt-6">
                  <FormLabel>Enable Shipping Fee</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )} />

              <FormField control={form.control} name="vip_only" render={({ field }) => (
                <FormItem className="flex items-center gap-3 pt-6">
                  <FormLabel>VIP Only</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <FormField control={form.control} name="brief" render={({ field }) => (
                <FormItem>
                  <FormLabel>Brief</FormLabel>
                  <FormControl><Textarea rows={4} placeholder="Describe this milestone..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </CardContent>
          </Card>

          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={() => navigate("/admin/milestones")}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Saving..." : "Save Milestone"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default AddMilestonePage;
