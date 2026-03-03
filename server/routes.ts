import type { Express, Request as ExpReq, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import { storage } from "./storage";
import type { User } from "@shared/schema";

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
      cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 },
    })
  );

  await storage.seedData();

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
    req.session.destroy(() => {
      res.json({ message: "Logged out" });
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

      if (user.role === "requester" && before.requesterId !== user.id) {
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

  app.post("/api/risk/run", requireAuth, requireRole("reviewer", "chair", "admin"), async (req, res) => {
    try {
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

      const findings: any[] = [];
      const riskTemplates = [
        { classification: "low", summary: "No significant security events reported. Vendor maintains SOC2 compliance.", recommendedActions: "Continue standard monitoring.", confidence: "high" },
        { classification: "low", summary: "Minor terms of service update. No material changes to data handling.", recommendedActions: "Review updated terms. No urgent action.", confidence: "high" },
        { classification: "medium", summary: "Vendor reported a non-critical vulnerability in authentication module. Patch released.", recommendedActions: "Verify patch has been applied. Review access logs.", confidence: "medium" },
        { classification: "medium", summary: "Third-party audit identified potential data residency concerns for EU customers.", recommendedActions: "Request data residency documentation. Review DPA terms.", confidence: "medium" },
        { classification: "high", summary: "Industry report flags potential data handling concerns. Vendor under regulatory investigation.", recommendedActions: "Escalate to security team. Consider pausing new enrollments.", confidence: "low" },
      ];

      for (const platform of platformsToCheck) {
        const template = riskTemplates[Math.floor(Math.random() * riskTemplates.length)];
        const finding = await storage.createRiskFinding({
          platformId: platform.id,
          classification: template.classification,
          summary: `[${platform.toolName}] ${template.summary}`,
          sources: [{ url: `https://security-feed.example.com/${platform.toolName.toLowerCase().replace(/\s+/g, '-')}`, title: `Security Feed - ${platform.toolName}` }],
          recommendedActions: template.recommendedActions,
          confidence: template.confidence,
        });
        findings.push(finding);
      }

      const log = await storage.createAgentRunLog({
        initiatedBy: user.id,
        scope: scope === "single" ? platformsToCheck[0]?.toolName || "unknown" : "all",
        prompt: scope === "single" ? `Check for breaches/news for ${platformsToCheck[0]?.toolName}` : "Run today's sweep for all Approved + On Review tools",
        platformsChecked: platformsToCheck.map((p: any) => p.toolName),
        resultsSummary: `${platformsToCheck.length} platforms checked. ${findings.length} findings logged.`,
        findingsCount: findings.length,
      });

      res.json({ log, findings });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
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

  app.get("/api/audit/:entityType/:entityId", requireAuth, async (req, res) => {
    try {
      const logs = await storage.getAuditLogsByEntity(req.params.entityType, req.params.entityId);
      res.json(logs);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
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
