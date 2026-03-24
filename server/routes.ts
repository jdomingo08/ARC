import type { Express, Request as ExpReq, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import passport from "passport";
import multer from "multer";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import { configurePassport } from "./auth";
import { createLLMProvider } from "./ai/provider";
import { RiskScanner } from "./risk-agent/scanner";
import { getLogoUrl } from "./logo-resolver";
import { TOOL_INSIGHTS_SYSTEM_PROMPT, buildToolInsightsPrompt } from "./ai/tool-insights-prompts";
import type { User, PlatformAttributeDefinition } from "@shared/schema";

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

async function requireAuth(req: ExpReq, res: Response, next: NextFunction) {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  const user = await storage.getUser(req.session.userId);
  if (!user) return res.status(401).json({ message: "User not found" });
  (req as any).user = user;
  next();
}

function requireRole(...roles: string[]) {
  return (req: ExpReq, res: Response, next: NextFunction) => {
    const user = (req as any).user as User;
    if (!roles.includes(user.role)) return res.status(403).json({ message: "Insufficient permissions" });
    next();
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "arc-intelligence-dev-secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: "lax",
      },
    })
  );

  // Initialize Passport for Google SSO
  configurePassport();
  app.use(passport.initialize());
  app.use(passport.session());

  // Bridge: sync passport's req.user into req.session.userId so existing
  // requireAuth / requireRole middleware works unchanged for both login methods
  app.use((req: ExpReq, _res: Response, next: NextFunction) => {
    if (req.user && !req.session.userId) {
      req.session.userId = (req.user as User).id;
    }
    next();
  });

  await storage.seedData();

  // Initialize AI/LLM provider for risk scanning
  const llmProvider = createLLMProvider();

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || typeof email !== "string") return res.status(400).json({ message: "Email required" });
      const user = await storage.getUserByEmail(email);
      if (!user) return res.status(404).json({ message: "User not found" });
      req.session.userId = user.id;
      res.json(user);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    try {
      if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
      const user = await storage.getUser(req.session.userId);
      if (!user) return res.status(401).json({ message: "User not found" });
      res.json(user);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout(() => {
      req.session.destroy(() => {
        res.json({ message: "Logged out" });
      });
    });
  });

  // Google SSO routes (only active when credentials are configured)
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    app.get(
      "/api/auth/google",
      passport.authenticate("google", {
        scope: ["email", "profile"],
        hd: process.env.GOOGLE_ALLOWED_DOMAIN, // hint to show only Workspace accounts
      } as any)
    );

    app.get(
      "/api/auth/google/callback",
      passport.authenticate("google", { failureRedirect: "/login?error=auth_failed" }),
      (req: ExpReq, res: Response) => {
        if (req.user) {
          req.session.userId = (req.user as User).id;
        }
        res.redirect("/");
      }
    );
  }

  // Tell the frontend which auth providers are available
  app.get("/api/auth/providers", (_req, res) => {
    res.json({
      google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      emailClick: process.env.NODE_ENV !== "production",
    });
  });

  app.get("/api/users", async (_req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      res.json(allUsers);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/users", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const { name, email, department, role } = req.body;
      if (!name || !email) return res.status(400).json({ message: "Name and email are required" });
      const existing = await storage.getUserByEmail(email);
      if (existing) return res.status(409).json({ message: "A user with that email already exists" });
      const user = await storage.createUser({ name, email, department: department || null, role: role || "requester" });
      res.json(user);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/requests", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user as User;
      let reqs;
      if (user.role === "requester") {
        reqs = await storage.getRequestsByRequester(user.id);
      } else {
        reqs = await storage.getAllRequests();
      }
      res.json(reqs);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/requests", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user as User;
      const data = req.body;

      if (!data.toolName || !data.primaryGoal || !data.impactLevel || !data.loginMethod) {
        return res.status(400).json({ message: "Missing required fields: toolName, primaryGoal, impactLevel, loginMethod" });
      }
      if (!data.dataInput || !Array.isArray(data.dataInput) || data.dataInput.length === 0) {
        return res.status(400).json({ message: "At least one data input category is required" });
      }

      data.requesterId = user.id;
      data.requesterName = user.name;
      data.department = data.department || user.department;

      let platform = await storage.getPlatformByToolName(data.toolName);
      if (!platform) {
        platform = await storage.createPlatform({
          toolName: data.toolName,
          status: "on_review",
          department: data.department,
          primaryGoal: data.primaryGoal,
          estimatedUsers: data.estimatedUsers,
          impactLevel: data.impactLevel,
          costStructure: data.costStructure || null,
          annualCost: data.annualCost || null,
          dataInput: data.dataInput || null,
          dataTraining: data.dataTraining || null,
          loginMethod: data.loginMethod,
          ownerId: user.id,
        });
      } else if (data.annualCost) {
        platform = await storage.updatePlatform(platform.id, {
          annualCost: data.annualCost,
          costStructure: data.costStructure || platform.costStructure,
        }) || platform;
      }

      data.platformId = platform.id;
      const request = await storage.createRequest(data);

      await storage.createAuditLog({
        entityType: "request",
        entityId: request.id,
        action: "created",
        before: null,
        after: request,
        actorId: user.id,
      });

      res.json(request);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/requests/:id", requireAuth, async (req, res) => {
    try {
      const request = await storage.getRequest(req.params.id);
      if (!request) return res.status(404).json({ message: "Request not found" });
      const user = (req as any).user as User;
      if (user.role === "requester" && request.requesterId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      res.json(request);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/requests/:id", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user as User;
      const before = await storage.getRequest(req.params.id);
      if (!before) return res.status(404).json({ message: "Request not found" });

      // Lock enforcement: if locked, only admin can edit
      if (before.locked && user.role !== "admin") {
        return res.status(403).json({ message: "This request is locked. Only an admin can edit it." });
      }

      // Non-admin users can only edit their own requests
      if (user.role !== "admin" && user.role !== "chair" && before.requesterId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const updated = await storage.updateRequest(req.params.id, req.body);
      if (!updated) return res.status(404).json({ message: "Request not found" });

      if (req.body.status === "pending_reviews" && before.status === "waiting_on_requester") {
        await storage.createAuditLog({
          entityType: "request",
          entityId: updated.id,
          action: "resubmitted",
          before: { status: before.status },
          after: { status: updated.status },
          actorId: user.id,
        });
      }

      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Lock / Unlock request (admin only)
  app.patch("/api/requests/:id/lock", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = (req as any).user as User;
      const request = await storage.getRequest(req.params.id);
      if (!request) return res.status(404).json({ message: "Request not found" });

      const locked = !!req.body.locked;
      const updated = await storage.updateRequest(req.params.id, { locked });

      await storage.createAuditLog({
        entityType: "request",
        entityId: req.params.id,
        action: locked ? "locked" : "unlocked",
        before: { locked: request.locked },
        after: { locked },
        actorId: user.id,
      });

      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Delete request (admin only)
  app.delete("/api/requests/:id", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const request = await storage.getRequest(req.params.id);
      if (!request) return res.status(404).json({ message: "Request not found" });
      await storage.deleteRequest(req.params.id);
      res.json({ message: "Request deleted" });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/requests/:id/reviews", requireAuth, async (req, res) => {
    try {
      const reviews = await storage.getReviewDecisionsByRequest(req.params.id);
      res.json(reviews);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/requests/:id/reviews", requireAuth, requireRole("reviewer", "chair"), async (req, res) => {
    try {
      const user = (req as any).user as User;
      const request = await storage.getRequest(req.params.id);
      if (!request) return res.status(404).json({ message: "Request not found" });
      if (request.status !== "pending_reviews") {
        return res.status(400).json({ message: "Request is not pending reviews" });
      }

      const { decision, rationale, riskNotes, conditions } = req.body;
      if (!decision || !rationale) {
        return res.status(400).json({ message: "Decision and rationale are required" });
      }
      if (!["pass", "fail", "needs_more_info"].includes(decision)) {
        return res.status(400).json({ message: "Invalid decision" });
      }

      const reviewerRole = user.reviewerRole;
      if (!reviewerRole) return res.status(400).json({ message: "User has no reviewer role assigned" });

      if (reviewerRole === "chair" && decision === "pass") {
        const allReviews = await storage.getReviewDecisionsByRequest(req.params.id);
        const activeReviews = allReviews.filter(r => !r.superseded);
        const securityPass = activeReviews.some(r => r.reviewerRole === "security" && r.decision === "pass");
        const techPass = activeReviews.some(r => r.reviewerRole === "technical_financial" && r.decision === "pass");
        if (!securityPass || !techPass) {
          return res.status(400).json({ message: "Chair cannot approve until Security and Tech/Financial reviews both pass" });
        }
      }

      await storage.supersedePriorDecisions(req.params.id, reviewerRole);

      const reviewDecision = await storage.createReviewDecision({
        requestId: req.params.id,
        reviewerRole,
        reviewerId: user.id,
        decision,
        rationale,
        riskNotes: riskNotes || null,
        conditions: conditions || null,
      });

      await storage.createAuditLog({
        entityType: "request",
        entityId: req.params.id,
        action: `review_${decision}`,
        before: null,
        after: { reviewerRole, decision, rationale },
        actorId: user.id,
      });

      if (decision === "needs_more_info") {
        await storage.updateRequestStatus(req.params.id, "waiting_on_requester");
      } else if (decision === "fail") {
        await storage.updateRequestStatus(req.params.id, "rejected");
        await storage.updateRequest(req.params.id, { locked: true });
        if (request.platformId) {
          await storage.updatePlatform(request.platformId, { status: "rejected", decisionSummary: `Rejected by ${reviewerRole}: ${rationale}` });
        }
      } else if (decision === "pass") {
        const allReviews = await storage.getReviewDecisionsByRequest(req.params.id);
        const activeReviews = allReviews.filter(r => !r.superseded);

        const securityPass = activeReviews.some(r => r.reviewerRole === "security" && r.decision === "pass");
        const techPass = activeReviews.some(r => r.reviewerRole === "technical_financial" && r.decision === "pass");
        const chairPasses = activeReviews.filter(r => r.reviewerRole === "chair" && r.decision === "pass");

        if (securityPass && techPass && chairPasses.length >= 2) {
          await storage.updateRequestStatus(req.params.id, "approved");
          await storage.updateRequest(req.params.id, { locked: true });
          if (request.platformId) {
            const allConditions = activeReviews.filter(r => r.conditions).map(r => r.conditions).join("; ");
            await storage.updatePlatform(request.platformId, {
              status: "approved",
              approvalDate: new Date(),
              decisionSummary: `Approved. ${allConditions ? "Conditions: " + allConditions : ""}`,
              lastReviewedAt: new Date(),
            });
          }
        }
      }

      res.json(reviewDecision);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/admin/platforms", requireAuth, requireRole("admin", "chair"), async (req, res) => {
    try {
      const user = (req as any).user as User;
      const data = req.body;
      if (!data.toolName) return res.status(400).json({ message: "Tool name is required" });

      const existing = await storage.getPlatformByToolName(data.toolName);
      if (existing) return res.status(409).json({ message: "A platform with that name already exists" });

      data.ownerId = user.id;
      if (!data.status) data.status = "on_review";
      if (!data.logoUrl) data.logoUrl = getLogoUrl(data.toolName);
      const platform = await storage.createPlatform(data);

      await storage.createAuditLog({
        entityType: "platform",
        entityId: platform.id,
        action: "created",
        before: null,
        after: platform,
        actorId: user.id,
      });

      res.json(platform);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.delete("/api/admin/platforms/:id", requireAuth, requireRole("admin", "chair"), async (req, res) => {
    try {
      const user = (req as any).user as User;
      const platform = await storage.getPlatform(req.params.id as string);
      if (!platform) return res.status(404).json({ message: "Platform not found" });

      await storage.createAuditLog({
        entityType: "platform",
        entityId: req.params.id as string,
        action: "deleted",
        before: platform,
        after: null,
        actorId: user.id,
      });

      const deleted = await storage.deletePlatform(req.params.id as string);
      if (!deleted) return res.status(404).json({ message: "Platform not found" });

      res.json({ message: "Platform deleted" });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/platforms", requireAuth, async (_req, res) => {
    try {
      const allPlatforms = await storage.getAllPlatforms();
      res.json(allPlatforms);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/platforms/:id", requireAuth, async (req, res) => {
    try {
      const platform = await storage.getPlatform(req.params.id);
      if (!platform) return res.status(404).json({ message: "Platform not found" });
      res.json(platform);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/platforms/:id", requireAuth, requireRole("admin", "chair"), async (req, res) => {
    try {
      const user = (req as any).user as User;
      const before = await storage.getPlatform(req.params.id);
      const updated = await storage.updatePlatform(req.params.id, req.body);
      if (!updated) return res.status(404).json({ message: "Platform not found" });

      await storage.createAuditLog({
        entityType: "platform",
        entityId: req.params.id,
        action: "updated",
        before,
        after: updated,
        actorId: user.id,
      });

      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/platforms/:id/findings", requireAuth, async (req, res) => {
    try {
      const findings = await storage.getRiskFindingsByPlatform(req.params.id);
      res.json(findings);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/platforms/:id/requests", requireAuth, async (req, res) => {
    try {
      const allReqs = await storage.getAllRequests();
      const linked = allReqs.filter(r => r.platformId === req.params.id);
      res.json(linked);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Batch resolve logos for all platforms that don't have one
  app.post("/api/admin/platforms/resolve-logos", requireAuth, requireRole("admin", "chair"), async (_req, res) => {
    try {
      const allPlatforms = await storage.getAllPlatforms();
      let updated = 0;
      for (const platform of allPlatforms) {
        if (!platform.logoUrl) {
          const logoUrl = getLogoUrl(platform.toolName);
          await storage.updatePlatform(platform.id, { logoUrl });
          updated++;
        }
      }
      res.json({ message: `Resolved logos for ${updated} platforms`, updated });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/admin/attributes", requireAuth, async (_req, res) => {
    try {
      const attrs = await storage.getAllAttributeDefinitions();
      res.json(attrs);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/admin/attributes", requireAuth, requireRole("admin", "chair"), async (req, res) => {
    try {
      const { name, dataType } = req.body;
      if (!name || !dataType) return res.status(400).json({ message: "Name and dataType are required" });
      const attr = await storage.createAttributeDefinition(req.body);
      res.json(attr);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.delete("/api/admin/attributes/:id", requireAuth, requireRole("admin", "chair"), async (req, res) => {
    try {
      const deleted = await storage.deleteAttributeDefinition(req.params.id);
      if (!deleted) return res.status(404).json({ message: "Attribute not found" });
      res.json({ message: "Attribute deleted" });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/admin/tiers", requireAuth, async (_req, res) => {
    try {
      const allTiers = await storage.getAllTiers();
      res.json(allTiers);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/admin/tiers", requireAuth, requireRole("admin", "chair"), async (req, res) => {
    try {
      const { name } = req.body;
      if (!name) return res.status(400).json({ message: "Name is required" });
      const tier = await storage.createTier(req.body);
      res.json(tier);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/admin/tiers/:id", requireAuth, requireRole("admin", "chair"), async (req, res) => {
    try {
      const updated = await storage.updateTier(req.params.id, req.body);
      if (!updated) return res.status(404).json({ message: "Tier not found" });
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.delete("/api/admin/tiers/:id", requireAuth, requireRole("admin", "chair"), async (req, res) => {
    try {
      const deleted = await storage.deleteTier(req.params.id);
      if (!deleted) return res.status(404).json({ message: "Tier not found" });
      res.json({ message: "Tier deleted" });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/admin/users", requireAuth, requireRole("admin", "chair"), async (_req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      res.json(allUsers);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/admin/users/:id/role", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const { role, reviewerRole } = req.body;
      if (!role) return res.status(400).json({ message: "Role is required" });
      const updated = await storage.updateUserRole(req.params.id, role, reviewerRole);
      if (!updated) return res.status(404).json({ message: "User not found" });
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.delete("/api/admin/users/:id", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = (req as any).user as User;
      if (user.id === req.params.id) return res.status(400).json({ message: "Cannot delete yourself" });
      const deleted = await storage.deleteUser(req.params.id);
      if (!deleted) return res.status(404).json({ message: "User not found" });
      res.json({ message: "User deleted" });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/risk/run", requireAuth, requireRole("reviewer", "chair", "admin"), async (req, res) => {
    try {
      if (!llmProvider) {
        return res.status(503).json({
          message: "AI provider not configured. Set OPENAI_API_KEY environment variable to enable risk scanning.",
        });
      }

      // Check for concurrent scan
      const runningLogs = await storage.getRunningAgentLogs();
      if (runningLogs.length > 0) {
        return res.status(409).json({ message: "A risk scan is already in progress. Please wait for it to complete." });
      }

      const user = (req as any).user as User;
      const { scope, platformId } = req.body;
      let platformsToCheck: any[] = [];

      if (scope === "single" && platformId) {
        const platform = await storage.getPlatform(platformId);
        if (platform) platformsToCheck = [platform];
      } else {
        const all = await storage.getAllPlatforms();
        platformsToCheck = all.filter(p => p.status === "approved" || p.status === "on_review");
      }

      if (platformsToCheck.length === 0) {
        return res.status(400).json({ message: "No platforms to scan." });
      }

      // Set up SSE streaming
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      const scanner = new RiskScanner(llmProvider, storage);

      const sendEvent = (event: string, data: any) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      scanner.on("scan-start", (data) => sendEvent("scan-start", data));
      scanner.on("platform-start", (data) => sendEvent("platform-start", data));
      scanner.on("finding", (data) => sendEvent("finding", data));
      scanner.on("platform-complete", (data) => sendEvent("platform-complete", data));
      scanner.on("platform-error", (data) => sendEvent("platform-error", data));
      scanner.on("complete", (data) => {
        sendEvent("complete", data);
        res.end();
      });
      scanner.on("error", (data) => {
        sendEvent("error", data);
        res.end();
      });

      // Handle client disconnect
      req.on("close", () => {
        scanner.abort();
      });

      const scopeLabel = scope === "single"
        ? platformsToCheck[0]?.toolName || "unknown"
        : "all";

      await scanner.scanPlatforms(platformsToCheck, user.id, "manual", scopeLabel);
    } catch (e: any) {
      // If headers already sent (SSE started), we can't send JSON error
      if (!res.headersSent) {
        res.status(500).json({ message: e.message });
      }
    }
  });

  app.get("/api/risk/logs", requireAuth, requireRole("reviewer", "chair", "admin"), async (_req, res) => {
    try {
      const logs = await storage.getAllAgentRunLogs();
      res.json(logs);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/risk/findings", requireAuth, requireRole("reviewer", "chair", "admin"), async (_req, res) => {
    try {
      const findings = await storage.getAllRiskFindings();
      res.json(findings);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // AI provider status check
  app.get("/api/risk/status", requireAuth, requireRole("reviewer", "chair", "admin"), async (_req, res) => {
    res.json({
      aiConfigured: llmProvider !== null,
      provider: llmProvider?.name || null,
    });
  });

  // Schedule management endpoints
  app.get("/api/risk/schedule", requireAuth, requireRole("reviewer", "chair", "admin"), async (_req, res) => {
    try {
      const schedule = await storage.getScanSchedule();
      res.json(schedule || { enabled: false, cronExpression: "0 0 * * *", scope: "all" });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.put("/api/risk/schedule", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const user = (req as any).user as User;
      const { enabled, cronExpression, scope } = req.body;
      const schedule = await storage.upsertScanSchedule({
        enabled,
        cronExpression,
        scope,
        createdBy: user.id,
      });

      // Notify scheduler to reload (handled via export)
      if ((globalThis as any).__riskScheduler) {
        (globalThis as any).__riskScheduler.reload(schedule);
      }

      res.json(schedule);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/audit/:entityType/:entityId", requireAuth, async (req, res) => {
    try {
      const logs = await storage.getAuditLogsByEntity(req.params.entityType, req.params.entityId);
      res.json(logs);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // --- Comments ---
  app.get("/api/requests/:id/comments", requireAuth, async (req, res) => {
    try {
      const comments = await storage.getCommentsByRequest(req.params.id);
      res.json(comments);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/requests/:id/comments", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user as User;
      const request = await storage.getRequest(req.params.id);
      if (!request) return res.status(404).json({ message: "Request not found" });

      const { body } = req.body;
      if (!body || !body.trim()) return res.status(400).json({ message: "Comment body is required" });

      const comment = await storage.createRequestComment({
        requestId: req.params.id,
        authorId: user.id,
        authorName: user.name,
        body: body.trim(),
      });
      res.json(comment);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.delete("/api/requests/:id/comments/:commentId", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user as User;
      const comments = await storage.getCommentsByRequest(req.params.id);
      const comment = comments.find(c => c.id === req.params.commentId);
      if (!comment) return res.status(404).json({ message: "Comment not found" });

      if (comment.authorId !== user.id && user.role !== "admin") {
        return res.status(403).json({ message: "You can only delete your own comments" });
      }

      await storage.deleteRequestComment(req.params.commentId);
      res.json({ message: "Comment deleted" });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // --- Attachments ---
  app.get("/api/requests/:id/attachments", requireAuth, async (req, res) => {
    try {
      const attachments = await storage.getAttachmentsByRequest(req.params.id);
      res.json(attachments);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/requests/:id/attachments", requireAuth, upload.single("file"), async (req, res) => {
    try {
      const user = (req as any).user as User;
      const request = await storage.getRequest(req.params.id);
      if (!request) return res.status(404).json({ message: "Request not found" });

      const file = req.file;
      if (!file) return res.status(400).json({ message: "No file uploaded" });

      const attachment = await storage.createRequestAttachment({
        requestId: req.params.id,
        uploadedBy: user.id,
        uploaderName: user.name,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype || null,
        storagePath: file.path,
      });
      res.json(attachment);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/attachments/:id/download", requireAuth, async (req, res) => {
    try {
      const attachment = await storage.getAttachment(req.params.id);
      if (!attachment) return res.status(404).json({ message: "Attachment not found" });

      if (!fs.existsSync(attachment.storagePath)) {
        return res.status(404).json({ message: "File not found on disk" });
      }

      res.download(attachment.storagePath, attachment.fileName);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.delete("/api/attachments/:id", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user as User;
      const attachment = await storage.getAttachment(req.params.id);
      if (!attachment) return res.status(404).json({ message: "Attachment not found" });

      if (attachment.uploadedBy !== user.id && user.role !== "admin") {
        return res.status(403).json({ message: "You can only delete your own uploads" });
      }

      // Remove file from disk
      if (fs.existsSync(attachment.storagePath)) {
        fs.unlinkSync(attachment.storagePath);
      }

      await storage.deleteRequestAttachment(req.params.id);
      res.json({ message: "Attachment deleted" });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // --- Platform Stakeholders ---
  app.get("/api/platforms/:id/stakeholders", requireAuth, async (req, res) => {
    try {
      const stakeholders = await storage.getStakeholdersByPlatform(req.params.id);
      res.json(stakeholders);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/platforms/:id/stakeholders", requireAuth, requireRole("admin", "chair", "reviewer"), async (req, res) => {
    try {
      const user = (req as any).user as User;
      const platform = await storage.getPlatform(req.params.id);
      if (!platform) return res.status(404).json({ message: "Platform not found" });

      const { name, email, role } = req.body;
      if (!name || !email) return res.status(400).json({ message: "Name and email are required" });

      const stakeholder = await storage.createPlatformStakeholder({
        platformId: req.params.id,
        name,
        email,
        role: role || null,
        source: "manual",
        sourceId: null,
        addedBy: user.id,
      });
      res.json(stakeholder);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.delete("/api/platforms/:platformId/stakeholders/:id", requireAuth, requireRole("admin", "chair", "reviewer"), async (req, res) => {
    try {
      const deleted = await storage.deletePlatformStakeholder(req.params.id);
      if (!deleted) return res.status(404).json({ message: "Stakeholder not found" });
      res.json({ message: "Stakeholder removed" });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // --- Expiration Alerts ---
  app.get("/api/platforms/:id/alerts", requireAuth, async (req, res) => {
    try {
      const alerts = await storage.getExpirationAlertsByPlatform(req.params.id);
      res.json(alerts);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/platforms/:id/alerts", requireAuth, requireRole("admin", "chair"), async (req, res) => {
    try {
      const platform = await storage.getPlatform(req.params.id);
      if (!platform) return res.status(404).json({ message: "Platform not found" });

      const { alertDaysBefore } = req.body;
      const alert = await storage.createExpirationAlert({
        platformId: req.params.id,
        alertDaysBefore: alertDaysBefore || 30,
      });
      res.json(alert);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.delete("/api/alerts/:id", requireAuth, requireRole("admin", "chair"), async (req, res) => {
    try {
      const deleted = await storage.deleteExpirationAlert(req.params.id);
      if (!deleted) return res.status(404).json({ message: "Alert not found" });
      res.json({ message: "Alert deleted" });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Check expiration alerts — returns platforms expiring soon and sends notifications
  app.post("/api/alerts/check", requireAuth, requireRole("admin", "chair"), async (_req, res) => {
    try {
      const allPlatforms = await storage.getAllPlatforms();
      const allAlerts = await storage.getAllExpirationAlerts();
      const attrDefs = await storage.getAllAttributeDefinitions();
      const contractAttr = attrDefs.find((a: PlatformAttributeDefinition) => a.name === "Contract Expiration Date");

      if (!contractAttr) {
        return res.json({ message: "No 'Contract Expiration' attribute defined", notifications: [] });
      }

      const notifications: any[] = [];
      const now = new Date();

      for (const platform of allPlatforms) {
        const dynAttrs = (platform.dynamicAttributes || {}) as Record<string, any>;
        const expiryDate = dynAttrs["Contract Expiration Date"];
        if (!expiryDate) continue;

        const expiry = new Date(expiryDate);
        if (isNaN(expiry.getTime())) continue;

        // Find alert config for this platform, or use default 30 days
        const alertConfig = allAlerts.find(a => a.platformId === platform.id);
        const daysBefore = alertConfig?.alertDaysBefore || 30;

        const alertDate = new Date(expiry);
        alertDate.setDate(alertDate.getDate() - daysBefore);

        if (now >= alertDate && now < expiry) {
          // Already sent?
          if (alertConfig?.alertSent) continue;

          const stakeholders = await storage.getStakeholdersByPlatform(platform.id);
          const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

          const notification = {
            platformId: platform.id,
            platformName: platform.toolName,
            expirationDate: expiryDate,
            daysUntilExpiry,
            stakeholders: stakeholders.map(s => ({ name: s.name, email: s.email })),
            message: `The platform "${platform.toolName}" contract is set to expire on ${new Date(expiryDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}. ${daysUntilExpiry} day(s) remaining.`,
          };
          notifications.push(notification);

          // Mark alert as sent if config exists
          if (alertConfig) {
            await storage.updateExpirationAlert(alertConfig.id, { alertSent: true, alertSentAt: new Date() });
          }
        }
      }

      res.json({ notifications, checked: allPlatforms.length });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // --- Alert Schedule ---
  app.get("/api/alerts/schedule", requireAuth, requireRole("admin", "chair"), async (_req, res) => {
    try {
      const schedule = await storage.getAlertSchedule();
      res.json(schedule || { enabled: false, cronExpression: "0 8 * * *", lastRunAt: null });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.put("/api/alerts/schedule", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const { enabled, cronExpression } = req.body;
      const schedule = await storage.upsertAlertSchedule({ enabled, cronExpression });
      if ((globalThis as any).__alertScheduler) {
        (globalThis as any).__alertScheduler.reload(schedule);
      }
      res.json(schedule);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // --- Platform Attachments ---
  app.get("/api/platforms/:id/attachments", requireAuth, async (req, res) => {
    try {
      const attachments = await storage.getAttachmentsByPlatform(req.params.id);
      res.json(attachments);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/platforms/:id/attachments", requireAuth, upload.single("file"), async (req, res) => {
    try {
      const user = (req as any).user as User;
      const platform = await storage.getPlatform(req.params.id);
      if (!platform) return res.status(404).json({ message: "Platform not found" });

      const file = req.file;
      if (!file) return res.status(400).json({ message: "No file uploaded" });

      const attachment = await storage.createPlatformAttachment({
        platformId: req.params.id,
        uploadedBy: user.id,
        uploaderName: user.name,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype || null,
        storagePath: file.path,
      });
      res.json(attachment);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.get("/api/platform-attachments/:id/download", requireAuth, async (req, res) => {
    try {
      const attachment = await storage.getPlatformAttachment(req.params.id);
      if (!attachment) return res.status(404).json({ message: "Attachment not found" });

      if (!fs.existsSync(attachment.storagePath)) {
        return res.status(404).json({ message: "File not found on disk" });
      }

      res.download(attachment.storagePath, attachment.fileName);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.delete("/api/platform-attachments/:id", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user as User;
      const attachment = await storage.getPlatformAttachment(req.params.id);
      if (!attachment) return res.status(404).json({ message: "Attachment not found" });

      if (attachment.uploadedBy !== user.id && user.role !== "admin") {
        return res.status(403).json({ message: "You can only delete your own uploads" });
      }

      if (fs.existsSync(attachment.storagePath)) {
        fs.unlinkSync(attachment.storagePath);
      }

      await storage.deletePlatformAttachment(req.params.id);
      res.json({ message: "Attachment deleted" });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // --- Tool Insights AI Feed ---
  app.post("/api/tool-insights", requireAuth, async (req, res) => {
    try {
      if (!llmProvider) {
        return res.status(503).json({
          message: "AI provider not configured. Set OPENAI_API_KEY environment variable to enable tool insights.",
        });
      }

      const { toolName } = req.body;
      if (!toolName || typeof toolName !== "string" || toolName.trim().length < 2) {
        return res.status(400).json({ message: "A valid tool name is required (at least 2 characters)" });
      }

      const result = await llmProvider.complete({
        systemPrompt: TOOL_INSIGHTS_SYSTEM_PROMPT,
        userPrompt: buildToolInsightsPrompt(toolName.trim()),
        enableWebSearch: true,
        responseFormat: "json",
        temperature: 0.4,
      });

      let parsed;
      try {
        parsed = JSON.parse(result.content);
      } catch {
        return res.status(500).json({ message: "Failed to parse AI response" });
      }

      res.json({ ...parsed, citations: result.citations });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // --- Agent Prompts Registry ---
  app.get("/api/agent-prompts", requireAuth, async (_req, res) => {
    const { RISK_ANALYSIS_SYSTEM_PROMPT, buildPlatformPrompt } = await import("./risk-agent/prompts");

    const samplePlatform = {
      toolName: "ExampleTool",
      primaryGoal: "Example goal",
      department: "Engineering",
      dataInput: ["public"],
      loginMethod: "SSO",
      dataTraining: "no",
      costStructure: "per_seat",
    };

    res.json([
      {
        id: "risk-scanner",
        name: "Risk Scanner Agent",
        description: "Analyzes vendor/platform security posture by searching for recent security events, CVEs, breaches, and regulatory actions.",
        category: "Security & Compliance",
        systemPrompt: RISK_ANALYSIS_SYSTEM_PROMPT,
        userPromptTemplate: buildPlatformPrompt(samplePlatform as any),
        userPromptDescription: "Dynamically built from platform details (tool name, department, data types, login method, etc.)",
        model: process.env.OPENAI_MODEL || "gpt-4o",
        features: ["Web Search", "JSON Response", "Risk Classification"],
      },
      {
        id: "tool-insights",
        name: "Tool Insights Agent",
        description: "Researches AI/software tools to provide comprehensive analysis including pricing, integrations, competitive landscape, and enterprise fit for Entravision.",
        category: "Research & Analysis",
        systemPrompt: TOOL_INSIGHTS_SYSTEM_PROMPT,
        userPromptTemplate: buildToolInsightsPrompt("ExampleTool"),
        userPromptDescription: "Built from the tool name entered in the New Request form. Triggers web search for current pricing and feature data.",
        model: process.env.OPENAI_MODEL || "gpt-4o",
        features: ["Web Search", "JSON Response", "Cost Analysis", "Competitive Analysis"],
      },
    ]);
  });

  app.get("/api/stats", requireAuth, async (_req, res) => {
    try {
      const allRequests = await storage.getAllRequests();
      const allPlatforms = await storage.getAllPlatforms();
      const allFindings = await storage.getAllRiskFindings();

      res.json({
        totalRequests: allRequests.length,
        pendingReviews: allRequests.filter(r => r.status === "pending_reviews").length,
        approvedPlatforms: allPlatforms.filter(p => p.status === "approved").length,
        totalPlatforms: allPlatforms.length,
        activeRisks: allFindings.filter(f => f.classification === "high" || f.classification === "critical").length,
        recentRequests: allRequests.slice(0, 5),
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  return httpServer;
}
