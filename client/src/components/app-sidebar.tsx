import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { RoleBadge } from "@/components/status-badge";
import {
  LayoutDashboard,
  FilePlus,
  FileText,
  Inbox,
  Server,
  Settings,
  ShieldAlert,
  LogOut,
  Shield,
  Bot,
} from "lucide-react";

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const mainItems = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard, roles: ["requester", "reviewer", "chair", "admin"] },
    { title: "New Request", url: "/requests/new", icon: FilePlus, roles: ["requester", "reviewer", "chair", "admin"] },
    { title: "My Requests", url: "/requests", icon: FileText, roles: ["requester", "reviewer", "chair", "admin"] },
    { title: "Review Inbox", url: "/reviews", icon: Inbox, roles: ["reviewer", "chair"] },
    { title: "Platforms", url: "/platforms", icon: Server, roles: ["requester", "reviewer", "chair", "admin"] },
  ];

  const adminItems = [
    { title: "Admin", url: "/admin", icon: Settings, roles: ["admin", "chair"] },
    { title: "Risk Agent", url: "/risk", icon: ShieldAlert, roles: ["reviewer", "chair", "admin"] },
    { title: "Agent Modules", url: "/agents", icon: Bot, roles: ["reviewer", "chair", "admin"] },
  ];

  const filteredMain = mainItems.filter(item => user && item.roles.includes(user.role));
  const filteredAdmin = adminItems.filter(item => user && item.roles.includes(user.role));

  const getInitials = (name: string) =>
    name.split(" ").map(n => n[0]).join("").toUpperCase();

  const isActive = (url: string) => {
    if (url === "/") return location === "/";
    return location.startsWith(url);
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground">
            <Shield className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">ARC Intelligence</h2>
            <p className="text-xs text-muted-foreground">AI Governance</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredMain.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild data-active={isActive(item.url)}>
                    <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s/g, '-')}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {filteredAdmin.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Management</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredAdmin.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild data-active={isActive(item.url)}>
                      <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s/g, '-')}`}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      {user && (
        <SidebarFooter className="p-4">
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs bg-muted">{getInitials(user.name)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <div className="flex items-center gap-1">
                <RoleBadge role={user.role} />
              </div>
            </div>
            <Button size="icon" variant="ghost" onClick={() => logout()} data-testid="button-logout">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
