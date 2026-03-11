import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
import { adminMenu, type MenuItem } from "@/config/menu";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/useAuth";

interface AdminSidebarProps {
  collapsed: boolean;
}

const SidebarItem = ({ item, collapsed }: { item: MenuItem; collapsed: boolean }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(() => {
    if (!item.submenu) return false;
    return item.submenu.some((sub) => location.pathname === sub.path);
  });

  const isActive = item.path
    ? location.pathname === item.path
    : item.submenu?.some((sub) => location.pathname === sub.path);

  const Icon = item.icon;

  const { signOut } = useAuth();

  if (!item.submenu) {
    const handleClick = () => {
      if (item.key === "logout") {
        signOut().then(() => navigate("/admin/login"));
      } else if (item.path) {
        navigate(item.path);
      }
    };
    return (
      <button
        onClick={handleClick}
        className={cn(
          "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
          "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          isActive && "bg-sidebar-accent text-sidebar-accent-foreground"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span className="truncate">{item.title}</span>}
      </button>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
          "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          isActive && "text-sidebar-primary"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {!collapsed && (
          <>
            <span className="flex-1 truncate text-left">{item.title}</span>
            {open ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
            )}
          </>
        )}
      </button>
      {open && !collapsed && (
        <div className="ml-4 mt-0.5 space-y-0.5 border-l border-sidebar-border pl-3">
          {item.submenu.map((sub) => (
            <button
              key={sub.key}
              onClick={() => navigate(sub.path)}
              className={cn(
                "flex w-full items-center rounded-md px-3 py-2 text-[13px] transition-colors",
                "text-sidebar-muted hover:text-sidebar-accent-foreground hover:bg-sidebar-accent",
                location.pathname === sub.path &&
                  "text-sidebar-primary font-medium bg-sidebar-accent"
              )}
            >
              <span className="truncate">{sub.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const AdminSidebar = ({ collapsed }: AdminSidebarProps) => {
  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-30 flex h-screen flex-col bg-sidebar transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-sidebar-border px-4">
        {collapsed ? (
          <span className="mx-auto text-lg font-bold text-sidebar-primary">A</span>
        ) : (
          <span className="text-lg font-bold tracking-tight text-sidebar-primary-foreground">
            Admin Panel
          </span>
        )}
      </div>

      {/* Nav */}
      <ScrollArea className="flex-1 px-2 py-3">
        <nav className="space-y-0.5">
          {adminMenu.map((item) => (
            <SidebarItem key={item.key} item={item} collapsed={collapsed} />
          ))}
        </nav>
      </ScrollArea>
    </aside>
  );
};

export default AdminSidebar;
