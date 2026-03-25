import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Loader2 } from "lucide-react";

import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import NewRequestPage from "@/pages/new-request";
import MyRequestsPage from "@/pages/my-requests";
import RequestDetailPage from "@/pages/request-detail";
import ReviewerInboxPage from "@/pages/reviewer-inbox";
import PlatformListPage from "@/pages/platform-list";
import PlatformDetailPage from "@/pages/platform-detail";
import AdminPage from "@/pages/admin";
import RiskAgentPage from "@/pages/risk-agent";
import AgentModulesPage from "@/pages/agent-modules";
import VendorFormPage from "@/pages/vendor-form";
import NotFound from "@/pages/not-found";

function AppContent() {
  const { user, isLoading, isAuthenticated } = useAuth();

  // Public vendor form route — no auth required
  const path = window.location.pathname;
  if (path.startsWith("/vendor-form/")) {
    return (
      <Switch>
        <Route path="/vendor-form/:token" component={VendorFormPage} />
      </Switch>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center gap-2 p-2 border-b shrink-0">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
          </header>
          <main className="flex-1 overflow-auto">
            <Switch>
              <Route path="/" component={DashboardPage} />
              <Route path="/requests/new" component={NewRequestPage} />
              <Route path="/requests/:id" component={RequestDetailPage} />
              <Route path="/requests" component={MyRequestsPage} />
              <Route path="/reviews" component={ReviewerInboxPage} />
              <Route path="/platforms/:id" component={PlatformDetailPage} />
              <Route path="/platforms" component={PlatformListPage} />
              <Route path="/admin" component={AdminPage} />
              <Route path="/risk" component={RiskAgentPage} />
              <Route path="/agents" component={AgentModulesPage} />
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
