import { useMemo } from "react";
import DataTable, { DataTableColumn } from "@/components/admin/DataTable";
import { generateMembers, type Member } from "@/data/mock-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Pencil, Trash2, User } from "lucide-react";

const memberColumns: DataTableColumn<Member>[] = [
  { key: "id", header: "ID", className: "w-16" },
  {
    key: "image_thumb",
    header: "Photo",
    sortable: false,
    className: "w-14",
    render: (row) => (
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
    render: (row) => (
      <Badge variant="secondary" className="text-xs font-normal">
        {row.gender}
      </Badge>
    ),
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
      return (
        <Badge className={`text-xs font-medium ${colors[row.membership] || ""}`}>
          {row.membership}
        </Badge>
      );
    },
  },
];

const MembersPage = () => {
  const data = useMemo(() => generateMembers(150), []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">All Members</h2>
          <p className="text-muted-foreground mt-1">Manage all registered members.</p>
        </div>
        <Button>
          <User className="mr-2 h-4 w-4" />
          Add New Member
        </Button>
      </div>

      <DataTable
        data={data}
        columns={memberColumns}
        expandable
        searchKeys={["name", "email", "country", "gender", "membership"]}
        renderExpandedRow={(row) => (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-3 text-sm">
            <div>
              <span className="text-muted-foreground">Title:</span>{" "}
              <span className="font-medium">{row.title}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Name:</span>{" "}
              <span className="font-medium">{row.name}</span>
            </div>
            <div>
              <span className="text-muted-foreground">City:</span>{" "}
              <span className="font-medium">{row.city}</span>
            </div>
            <div>
              <span className="text-muted-foreground">State:</span>{" "}
              <span className="font-medium">{row.state}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Country:</span>{" "}
              <span className="font-medium">{row.country}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Zip:</span>{" "}
              <span className="font-medium">{row.zip}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Email:</span>{" "}
              <span className="font-medium">{row.email}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Profession:</span>{" "}
              <span className="font-medium">{row.profession}</span>
            </div>
          </div>
        )}
        actions={(row) => (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Eye className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      />
    </div>
  );
};

export default MembersPage;
