import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, subHours, startOfDay, endOfDay } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Mail,
  Send,
  AlertTriangle,
  Ban,
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  MailWarning,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

const STATUS_COLORS: Record<string, string> = {
  sent: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  failed: "bg-red-500/20 text-red-400 border-red-500/30",
  dlq: "bg-red-500/20 text-red-400 border-red-500/30",
  pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  rate_limited: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  suppressed: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

const PRESET_RANGES = [
  { label: "Last 24h", getValue: () => ({ from: subHours(new Date(), 24), to: new Date() }) },
  { label: "7 days", getValue: () => ({ from: subDays(new Date(), 7), to: new Date() }) },
  { label: "30 days", getValue: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
];

const PAGE_SIZE = 50;

export default function AdminEmailDashboardPage() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });
  const [templateFilter, setTemplateFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(0);

  const rangeFrom = dateRange?.from ? startOfDay(dateRange.from).toISOString() : undefined;
  const rangeTo = dateRange?.to ? endOfDay(dateRange.to).toISOString() : undefined;

  // Fetch all logs in range (deduplicated by message_id done client-side)
  const { data: rawLogs, isLoading } = useQuery({
    queryKey: ["email-dashboard-logs", rangeFrom, rangeTo],
    queryFn: async () => {
      if (!rangeFrom || !rangeTo) return [];
      const { data, error } = await supabase
        .from("email_send_log")
        .select("id, message_id, template_name, recipient_email, status, error_message, created_at")
        .gte("created_at", rangeFrom)
        .lte("created_at", rangeTo)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data || [];
    },
    enabled: !!rangeFrom && !!rangeTo,
  });

  // Deduplicate by message_id — keep latest status per message
  const deduped = useMemo(() => {
    if (!rawLogs) return [];
    const map = new Map<string, typeof rawLogs[0]>();
    for (const row of rawLogs) {
      const key = row.message_id || row.id;
      if (!map.has(key)) {
        map.set(key, row);
      }
    }
    return Array.from(map.values());
  }, [rawLogs]);

  // Template names for filter
  const templateNames = useMemo(() => {
    const set = new Set(deduped.map((r) => r.template_name));
    return Array.from(set).sort();
  }, [deduped]);

  // Filtered
  const filtered = useMemo(() => {
    return deduped.filter((r) => {
      if (templateFilter !== "all" && r.template_name !== templateFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      return true;
    });
  }, [deduped, templateFilter, statusFilter]);

  // Stats
  const stats = useMemo(() => {
    const s = { total: 0, sent: 0, failed: 0, suppressed: 0 };
    for (const r of filtered) {
      s.total++;
      if (r.status === "sent") s.sent++;
      else if (r.status === "failed" || r.status === "dlq") s.failed++;
      else if (r.status === "suppressed") s.suppressed++;
    }
    return s;
  }, [filtered]);

  // Paginated
  const paginated = useMemo(() => {
    const start = page * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Email Analytics</h1>
        <p className="text-muted-foreground text-sm">Monitor email delivery across all templates</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        {PRESET_RANGES.map((preset) => (
          <Button
            key={preset.label}
            size="sm"
            variant="outline"
            onClick={() => {
              setDateRange(preset.getValue());
              setPage(0);
            }}
          >
            {preset.label}
          </Button>
        ))}

        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1.5">
              <CalendarIcon className="h-3.5 w-3.5" />
              {dateRange?.from && dateRange?.to
                ? `${format(dateRange.from, "MMM d")} – ${format(dateRange.to, "MMM d")}`
                : "Custom range"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={(range) => {
                setDateRange(range);
                setPage(0);
              }}
              numberOfMonths={2}
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>

        <Select value={templateFilter} onValueChange={(v) => { setTemplateFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="All templates" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All templates</SelectItem>
            {templateNames.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="dlq">DLQ</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="rate_limited">Rate Limited</SelectItem>
            <SelectItem value="suppressed">Suppressed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Mail className="h-4 w-4" /> Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-emerald-400 flex items-center gap-2">
              <Send className="h-4 w-4" /> Sent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-400">{stats.sent}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-400 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Failed / DLQ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-400">{stats.failed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-purple-400 flex items-center gap-2">
              <Ban className="h-4 w-4" /> Suppressed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-purple-400">{stats.suppressed}</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MailWarning className="h-4 w-4" />
            Email Log
            <span className="text-muted-foreground font-normal text-sm ml-auto">
              {filtered.length} emails
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading…</div>
          ) : paginated.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No emails found for this filter.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Template</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead className="max-w-[200px]">Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">{row.template_name}</TableCell>
                      <TableCell className="text-sm max-w-[180px] truncate">{row.recipient_email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-xs", STATUS_COLORS[row.status] || "")}>
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(row.created_at), "MMM d, h:mm a")}
                      </TableCell>
                      <TableCell className="text-xs text-red-400 max-w-[200px] truncate" title={row.error_message || ""}>
                        {row.error_message || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <span className="text-xs text-muted-foreground">
                Page {page + 1} of {totalPages}
              </span>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
