import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RoleBadge } from "@/components/status-badge";
import { Shield, Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { User } from "@shared/schema";

export default function LoginPage() {
  const { login, isLoggingIn } = useAuth();
  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });
  const { data: providers } = useQuery<{ google: boolean; emailClick: boolean }>({
    queryKey: ["/api/auth/providers"],
  });

  const searchParams = new URLSearchParams(window.location.search);
  const error = searchParams.get("error");

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

        {error === "auth_failed" && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Sign-in failed. Your Google account may not have access to this application.
            </AlertDescription>
          </Alert>
        )}

        {providers?.google && (
          <Card className="mb-4">
            <CardContent className="pt-6">
              <a href="/api/auth/google" className="block">
                <Button variant="default" className="w-full" size="lg">
                  <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Sign in with Google
                </Button>
              </a>
            </CardContent>
          </Card>
        )}

        {providers?.emailClick && (
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
        )}
      </div>
    </div>
  );
}
