import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, ChevronRight, ChevronUp, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  expandable?: boolean;
  renderExpandedRow?: (row: T) => React.ReactNode;
  searchKeys?: string[];
  pageTitle?: string;
  actions?: (row: T) => React.ReactNode;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  idKey?: string;
}

const PAGE_SIZE_OPTIONS = [
  { label: "10", value: 10 },
  { label: "25", value: 25 },
  { label: "50", value: 50 },
  { label: "100", value: 100 },
  { label: "All", value: -1 },
];

function DataTable<T extends Record<string, any>>({
  data,
  columns,
  expandable = false,
  renderExpandedRow,
  searchKeys,
  actions,
  selectable = false,
  selectedIds,
  onSelectionChange,
  idKey = "id",
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(0);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    const keys = searchKeys || columns.map((c) => c.key);
    return data.filter((row) =>
      keys.some((key) => {
        const val = row[key];
        return val != null && String(val).toLowerCase().includes(q);
      })
    );
  }, [data, search, searchKeys, columns]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const aVal = a[sortKey] ?? "";
      const bVal = b[sortKey] ?? "";
      const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = pageSize === -1 ? 1 : Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginated = pageSize === -1 ? sorted : sorted.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const toggleRow = (idx: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const handleSearch = (val: string) => {
    setSearch(val);
    setCurrentPage(0);
  };

  const handlePageSize = (val: string) => {
    setPageSize(Number(val));
    setCurrentPage(0);
  };

  // Selection helpers
  const allPageIds = paginated.map((row) => row[idKey] as string);
  const allPageSelected = selectable && allPageIds.length > 0 && allPageIds.every((id) => selectedIds?.has(id));
  const somePageSelected = selectable && allPageIds.some((id) => selectedIds?.has(id));

  const toggleAll = () => {
    if (!onSelectionChange || !selectedIds) return;
    const next = new Set(selectedIds);
    if (allPageSelected) {
      allPageIds.forEach((id) => next.delete(id));
    } else {
      allPageIds.forEach((id) => next.add(id));
    }
    onSelectionChange(next);
  };

  const toggleOne = (id: string) => {
    if (!onSelectionChange || !selectedIds) return;
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    onSelectionChange(next);
  };

  const colSpanTotal = columns.length + (expandable ? 1 : 0) + (actions ? 1 : 0) + (selectable ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Show</span>
          <Select value={String(pageSize)} onValueChange={handlePageSize}>
            <SelectTrigger className="w-20 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={String(o.value)}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">entries</span>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              {selectable && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={allPageSelected ? true : somePageSelected ? "indeterminate" : false}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
              )}
              {expandable && <TableHead className="w-10" />}
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={cn("text-xs font-semibold uppercase tracking-wider", col.className)}
                >
                  {col.sortable !== false ? (
                    <button
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                      onClick={() => handleSort(col.key)}
                    >
                      {col.header}
                      {sortKey === col.key ? (
                        sortDir === "asc" ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )
                      ) : (
                        <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </TableHead>
              ))}
              {actions && <TableHead className="text-xs font-semibold uppercase tracking-wider">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={colSpanTotal}
                  className="h-24 text-center text-muted-foreground"
                >
                  No results found.
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((row, idx) => {
                const globalIdx = pageSize === -1 ? idx : currentPage * pageSize + idx;
                const isExpanded = expandedRows.has(globalIdx);
                const rowId = row[idKey] as string;
                return (
                  <>
                    <TableRow
                      key={globalIdx}
                      className={cn(
                        "hover:bg-muted/30 transition-colors",
                        isExpanded && "bg-muted/20",
                        selectable && selectedIds?.has(rowId) && "bg-primary/5"
                      )}
                    >
                      {selectable && (
                        <TableCell className="w-10">
                          <Checkbox
                            checked={selectedIds?.has(rowId) ?? false}
                            onCheckedChange={() => toggleOne(rowId)}
                          />
                        </TableCell>
                      )}
                      {expandable && (
                        <TableCell className="w-10 cursor-pointer" onClick={() => toggleRow(globalIdx)}>
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                      )}
                      {columns.map((col) => (
                        <TableCell key={col.key} className={cn("text-sm", col.className)}>
                          {col.render ? col.render(row) : row[col.key] ?? "—"}
                        </TableCell>
                      ))}
                      {actions && <TableCell className="text-sm">{actions(row)}</TableCell>}
                    </TableRow>
                    {expandable && isExpanded && renderExpandedRow && (
                      <TableRow key={`${globalIdx}-expanded`}>
                        <TableCell colSpan={colSpanTotal} className="bg-muted/10 p-4">
                          {renderExpandedRow(row)}
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm text-muted-foreground">
        <div>
          Showing {sorted.length === 0 ? 0 : (pageSize === -1 ? 1 : currentPage * pageSize + 1)} to{" "}
          {pageSize === -1 ? sorted.length : Math.min((currentPage + 1) * pageSize, sorted.length)} of{" "}
          {sorted.length} entries
          {search && ` (filtered from ${data.length} total)`}
        </div>
        {pageSize !== -1 && totalPages > 1 && (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 0}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              Previous
            </Button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let page: number;
              if (totalPages <= 5) {
                page = i;
              } else if (currentPage < 3) {
                page = i;
              } else if (currentPage > totalPages - 4) {
                page = totalPages - 5 + i;
              } else {
                page = currentPage - 2 + i;
              }
              return (
                <Button
                  key={page}
                  variant={page === currentPage ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(page)}
                  className="w-9"
                >
                  {page + 1}
                </Button>
              );
            })}
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages - 1}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default DataTable;
