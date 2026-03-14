import { Menu, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import AdminNotifications from "./AdminNotifications";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AdminTopbarProps {
  onToggleSidebar: () => void;
  pageTitle?: string;
}

const AdminTopbar = ({ onToggleSidebar, pageTitle }: AdminTopbarProps) => {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center border-b bg-topbar border-topbar-border px-4 gap-4">
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleSidebar}
        className="text-topbar-foreground hover:bg-muted"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {pageTitle && (
        <h1 className="text-lg font-semibold text-topbar-foreground">{pageTitle}</h1>
      )}

      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="icon" className="text-topbar-foreground hover:bg-muted relative">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-topbar-foreground hover:bg-muted">
              <User className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuItem>Logout</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default AdminTopbar;
