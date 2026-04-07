import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { execSync } from "child_process";
import { RiskScheduler } from "./risk-agent/scheduler";
import { AlertScheduler } from "./alert-scheduler";
import { storage } from "./storage";
import { reviewerRoleEnum } from "@shared/schema";

// Validate ADMIN_REVIEWER_ROLE at startup so misconfigurations surface immediately
// rather than silently writing an invalid role to the database.
const rawAdminReviewerRole = process.env.ADMIN_REVIEWER_ROLE;
if (rawAdminReviewerRole) {
  const result = reviewerRoleEnum.safeParse(rawAdminReviewerRole);
  if (!result.success) {
    const valid = reviewerRoleEnum.options.join(", ");
    throw new Error(
      `Invalid ADMIN_REVIEWER_ROLE="${rawAdminReviewerRole}". Must be one of: ${valid}`
    );
  }
}

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  // Run one-time startup data migrations
  await storage.runStartupMigrations();

  // Initialize risk scan scheduler
  const riskScheduler = new RiskScheduler(storage);
  await riskScheduler.initialize();
  // Make scheduler accessible to route handlers for live reload
  (globalThis as any).__riskScheduler = riskScheduler;

  // Initialize alert scheduler
  const alertScheduler = new AlertScheduler(storage);
  await alertScheduler.initialize();
  (globalThis as any).__alertScheduler = alertScheduler;

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);

  function killPortHolder(p: number): void {
    try {
      const hex = p.toString(16).toUpperCase().padStart(4, "0");
      const tcp = execSync("cat /proc/net/tcp 2>/dev/null || true").toString();
      const lines = tcp.split("\n");
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 4) continue;
        const [, localAddr, , state] = parts;
        if (state !== "0A") continue;
        const port = localAddr.split(":")[1];
        if (port !== hex) continue;
        const inode = parts[9];
        if (!inode || inode === "0") continue;
        const pids = execSync(`for f in /proc/[0-9]*/fd/*; do readlink "$f" 2>/dev/null | grep -q "socket:\\[${inode}\\]" && echo "$f"; done || true`).toString();
        for (const fdPath of pids.split("\n").filter(Boolean)) {
          const pid = fdPath.split("/")[2];
          if (pid && pid !== String(process.pid)) {
            log(`Killing old process ${pid} holding port ${p}`);
            try { process.kill(Number(pid), "SIGKILL"); } catch {}
          }
        }
      }
    } catch {}
  }

  killPortHolder(port);
  await new Promise((r) => setTimeout(r, 500));

  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
