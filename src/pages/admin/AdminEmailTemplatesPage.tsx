import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Mail, Save, ChevronDown, ChevronUp, Info, Zap, Send,
  UserPlus, Package, Truck, AlertTriangle, MapPinOff, Eye,
} from "lucide-react";

const ICON_MAP: Record<string, React.ReactNode> = {
  welcome: <UserPlus className="h-5 w-5" />,
  order_placed: <Package className="h-5 w-5" />,
  order_shipped: <Truck className="h-5 w-5" />,
  item_out_of_stock: <AlertTriangle className="h-5 w-5" />,
  address_not_exist: <MapPinOff className="h-5 w-5" />,
};

const VARIABLE_HELP: Record<string, string[]> = {
  welcome: ["{{user_name}}"],
  order_placed: ["{{user_name}}", "{{reward_title}}", "{{order_date}}"],
  order_shipped: ["{{user_name}}", "{{reward_title}}", "{{tracking_url}}"],
  item_out_of_stock: ["{{user_name}}", "{{reward_title}}"],
  address_not_exist: ["{{user_name}}", "{{reward_title}}"],
};

interface EmailTemplate {
  id: string;
  template_key: string;
  name: string;
  description: string | null;
  trigger_info: string | null;
  subject: string;
  body: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const AdminEmailTemplatesPage = () => {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editState, setEditState] = useState<Record<string, { subject: string; body: string; is_active: boolean }>>({});
  const [previewId, setPreviewId] = useState<string | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["email-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as EmailTemplate[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, subject, body, is_active }: { id: string; subject: string; body: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("email_templates")
        .update({ subject, body, is_active, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
      toast.success("Email template saved!");
    },
    onError: (e: Error) => toast.error("Failed to save", { description: e.message }),
  });

  const toggleExpand = (id: string, template: EmailTemplate) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!editState[id]) {
      setEditState((prev) => ({
        ...prev,
        [id]: { subject: template.subject, body: template.body, is_active: template.is_active },
      }));
    }
  };

  const handleSave = (id: string) => {
    const state = editState[id];
    if (state) updateMutation.mutate({ id, ...state });
  };

  const renderPreview = (template: EmailTemplate) => {
    const state = editState[template.id] || { subject: template.subject, body: template.body };
    const previewBody = state.body
      .replace(/\{\{user_name\}\}/g, "Alex")
      .replace(/\{\{reward_title\}\}/g, "Nike Air Max 90")
      .replace(/\{\{order_date\}\}/g, "March 13, 2026")
      .replace(/\{\{tracking_url\}\}/g, "https://tracking.example.com/12345");

    return (
      <div className="mt-4 border rounded-lg bg-white p-6 text-sm text-gray-800 whitespace-pre-wrap font-sans max-w-2xl">
        <div className="mb-3 pb-3 border-b">
          <span className="text-xs text-muted-foreground">Subject: </span>
          <span className="font-semibold">{state.subject}</span>
        </div>
        {previewBody}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* System Overview */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Info className="h-5 w-5 text-primary" />
            Email System Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p>
            C24Club sends emails at key moments in the user journey. Here's how the system works:
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-background border">
              <Zap className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Automatic Triggers</p>
                <p className="text-muted-foreground text-xs mt-1">
                  The <strong>Welcome Email</strong> is sent automatically when a new user signs up. No manual action needed.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-background border">
              <Send className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Admin-Triggered Emails</p>
                <p className="text-muted-foreground text-xs mt-1">
                  Order status emails (Placed, Shipped, Out of Stock, Address Not Found) are sent when you update a redemption status in <strong>Member Rewards</strong>.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-background border">
              <Mail className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Custom Sender Domain Required</p>
                <p className="text-muted-foreground text-xs mt-1">
                  To actually deliver emails to users, a custom email domain must be configured (e.g., <code>notify@c24club.com</code>). Until then, emails are logged but not delivered.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-background border">
              <Eye className="h-5 w-5 text-purple-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Template Variables</p>
                <p className="text-muted-foreground text-xs mt-1">
                  Use <code>{"{{user_name}}"}</code>, <code>{"{{reward_title}}"}</code>, etc. in your templates. They get replaced with real data when the email is sent.
                </p>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <p className="font-medium mb-2">📧 Email Flow Diagram</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              <Badge variant="outline">User Action / Admin Action</Badge>
              <span>→</span>
              <Badge variant="outline">Edge Function Triggered</Badge>
              <span>→</span>
              <Badge variant="outline">Template Loaded from DB</Badge>
              <span>→</span>
              <Badge variant="outline">Variables Replaced</Badge>
              <span>→</span>
              <Badge variant="outline">Email Sent to User</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Templates List */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Mail className="h-5 w-5" /> Email Templates ({templates.length})
        </h2>

        {isLoading && <p className="text-muted-foreground text-sm">Loading templates...</p>}

        {templates.map((template) => {
          const isExpanded = expandedId === template.id;
          const state = editState[template.id];
          const variables = VARIABLE_HELP[template.template_key] || [];

          return (
            <Card key={template.id} className={isExpanded ? "ring-2 ring-primary/30" : ""}>
              <CardHeader
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => toggleExpand(template.id, template)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {ICON_MAP[template.template_key] || <Mail className="h-5 w-5" />}
                    <div>
                      <CardTitle className="text-base">{template.name}</CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {template.trigger_info}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={template.is_active ? "default" : "secondary"}>
                      {template.is_active ? "Active" : "Disabled"}
                    </Badge>
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </div>
              </CardHeader>

              {isExpanded && state && (
                <CardContent className="space-y-4 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{template.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`active-${template.id}`} className="text-sm">Enabled</Label>
                      <Switch
                        id={`active-${template.id}`}
                        checked={state.is_active}
                        onCheckedChange={(checked) =>
                          setEditState((prev) => ({ ...prev, [template.id]: { ...prev[template.id], is_active: checked } }))
                        }
                      />
                    </div>
                  </div>

                  {variables.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground">Available variables:</span>
                      {variables.map((v) => (
                        <Badge key={v} variant="outline" className="text-xs font-mono">{v}</Badge>
                      ))}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Subject Line</Label>
                    <Input
                      value={state.subject}
                      onChange={(e) =>
                        setEditState((prev) => ({ ...prev, [template.id]: { ...prev[template.id], subject: e.target.value } }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Email Body</Label>
                    <Textarea
                      className="min-h-[250px] font-mono text-sm"
                      value={state.body}
                      onChange={(e) =>
                        setEditState((prev) => ({ ...prev, [template.id]: { ...prev[template.id], body: e.target.value } }))
                      }
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <Button onClick={() => handleSave(template.id)} disabled={updateMutation.isPending}>
                      <Save className="h-4 w-4 mr-2" />
                      Save Template
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setPreviewId(previewId === template.id ? null : template.id)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      {previewId === template.id ? "Hide Preview" : "Preview"}
                    </Button>
                  </div>

                  {previewId === template.id && renderPreview(template)}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default AdminEmailTemplatesPage;
