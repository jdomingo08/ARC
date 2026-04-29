import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Render error:", error, info.componentStack);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-lg w-full text-center space-y-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Something went wrong</h1>
              <p className="text-sm text-muted-foreground mt-1">
                The page failed to render. Try reloading, or return to the dashboard.
              </p>
            </div>
            <pre className="text-xs text-left bg-muted p-3 rounded overflow-auto max-h-48">
              {this.state.error.message}
            </pre>
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={this.reset}>Try again</Button>
              <Button onClick={() => { window.location.href = "/"; }}>Go to Dashboard</Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
