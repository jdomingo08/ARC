import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RoleBadge } from "@/components/status-badge";
import { Shield, Loader2 } from "lucide-react";
import type { User } from "@shared/schema";

export default function LoginPage() {
  const { login, isLoggingIn } = useAuth();
  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const getInitials = (name: string) =>
    name.split(" ").map(n => n[0]).join("").toUpperCase();

  const roleDescriptions: Record<string, string> = {
    chair: "Final sign-off authority",
    reviewer: "Committee reviewer",
    requester: "Submit tool requests",
    admin: "System administrator",
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground mb-4">
            <Shield className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-app-title">
            ARC Intelligence
          </h1>
          <p className="text-muted-foreground mt-2">
            AI Governance & Risk Management Platform
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>
              Select your account to continue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {users?.map((user) => (
                <button
                  key={user.id}
                  onClick={() => login(user.email)}
                  disabled={isLoggingIn}
                  className="flex items-center gap-3 p-3 rounded-md text-left w-full hover-elevate active-elevate-2 transition-colors"
                  data-testid={`button-login-${user.email}`}
                >
                  <Avatar>
                    <AvatarFallback className="bg-muted text-muted-foreground text-sm font-medium">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{user.name}</div>
                    <div className="text-xs text-muted-foreground">{user.department} - {roleDescriptions[user.role] || user.role}</div>
                  </div>
                  <RoleBadge role={user.role} />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
