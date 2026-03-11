import { useState } from "react";
import DataTable, { DataTableColumn } from "@/components/admin/DataTable";
import { useMembers, useDeleteMember } from "@/hooks/useCrud";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, User } from "lucide-react";
import DeleteDialog from "@/components/admin/DeleteDialog";

type Member = {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  country: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  profession: string | null;
  stats: string | null;
  birthdate: string | null;
  gender: string | null;
  membership: string | null;
};

const memberColumns: DataTableColumn<Member>[] = [
  {
    key: "id",
    header: "ID",
    className: "w-20",
    render: (row) => <span className="font-mono text-xs">{row.id.slice(0, 8)}</span>,
  },
  {
    key: "name" as any,
    header: "Photo",
    sortable: false,
    className: "w-14",
    render: () => (
      <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
        <User className="h-4 w-4 text-muted-foreground" />
      </div>
    ),
  },
  { key: "name", header: "Name" },
  { key: "email", header: "Email" },
  { key: "country", header: "Country" },
  { key: "stats", header: "Stats" },
  { key: "birthdate", header: "Birth Date" },
  {
    key: "gender",
    header: "Gender",
    render: (row) => row.gender ? (
      <Badge variant="secondary" className="text-xs font-normal">{row.gender}</Badge>
    ) : null,
  },
  {
    key: "membership",
    header: "Membership",
    render: (row) => {
      const colors: Record<string, string> = {
        Free: "bg-muted text-muted-foreground",
        Premium: "bg-primary/10 text-primary",
        Gold: "bg-warning/10 text-warning",
        Platinum: "bg-accent/10 text-accent",
      };
      return row.membership ? (
        <Badge className={`text-xs font-medium ${colors[row.membership] || ""}`}>{row.membership}</Badge>
      ) : null;
    },
  },
];

const MembersPage = () => {
  const { data, isLoading } = useMembers();
  const deleteMutation = useDeleteMember();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">All Members</h2>
          <p className="text-muted-foreground mt-1">
            {isLoading ? "Loading..." : `${data?.length ?? 0} members total.`}
          </p>
        </div>
        <Button>
          <User className="mr-2 h-4 w-4" />
          Add New Member
        </Button>
      </div>

      <DataTable
        data={(data as Member[]) ?? []}
        columns={memberColumns}
        expandable
        searchKeys={["name", "email", "country", "gender", "membership"]}
        renderExpandedRow={(row) => (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-3 text-sm">
            <div><span className="text-muted-foreground">Title:</span> <span className="font-medium">{row.title}</span></div>
            <div><span className="text-muted-foreground">City:</span> <span className="font-medium">{row.city}</span></div>
            <div><span className="text-muted-foreground">State:</span> <span className="font-medium">{row.state}</span></div>
            <div><span className="text-muted-foreground">Zip:</span> <span className="font-medium">{row.zip}</span></div>
            <div><span className="text-muted-foreground">Email:</span> <span className="font-medium">{row.email}</span></div>
            <div><span className="text-muted-foreground">Profession:</span> <span className="font-medium">{row.profession}</span></div>
          </div>
        )}
        actions={(row) => (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(row.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      />

      <DeleteDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={() => { if (deleteId) { deleteMutation.mutate(deleteId); setDeleteId(null); } }}
        title="this member"
        isPending={deleteMutation.isPending}
      />
    </div>
  );
};

export default MembersPage;
