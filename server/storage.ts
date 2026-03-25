import { db } from "./db";
import { pool } from "./db";
import { eq, desc, and, ilike, sql } from "drizzle-orm";
import {
  users, requests, reviewDecisions, platforms,
  platformAttributeDefinitions, tiers, riskFindings,
  agentRunLogs, auditLogs, scanSchedules, alertSchedules, requestComments, requestAttachments,
  platformStakeholders, expirationAlerts, platformAttachments,
  type User, type InsertUser,
  type Request, type InsertRequest,
  type ReviewDecision, type InsertReviewDecision,
  type Platform, type InsertPlatform,
  type PlatformAttributeDefinition, type InsertAttributeDefinition,
  type Tier, type InsertTier,
  type RiskFinding, type InsertRiskFinding,
  type AgentRunLog, type InsertAgentRunLog,
  type ScanSchedule, type InsertScanSchedule,
  type AlertSchedule, type InsertAlertSchedule,
  type AuditLog, type InsertAuditLog,
  type RequestComment, type InsertRequestComment,
  type RequestAttachment, type InsertRequestAttachment,
  type PlatformStakeholder, type InsertPlatformStakeholder,
  type ExpirationAlert, type InsertExpirationAlert,
  type PlatformAttachment, type InsertPlatformAttachment,
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUserRole(id: string, role: string, reviewerRole?: string): Promise<User | undefined>;

  createRequest(request: InsertRequest): Promise<Request>;
  getRequest(id: string): Promise<Request | undefined>;
  getRequestsByRequester(requesterId: string): Promise<Request[]>;
  getAllRequests(): Promise<Request[]>;
  updateRequestStatus(id: string, status: string): Promise<Request | undefined>;
  updateRequest(id: string, data: Partial<Request>): Promise<Request | undefined>;

  createReviewDecision(decision: InsertReviewDecision): Promise<ReviewDecision>;
  getReviewDecisionsByRequest(requestId: string): Promise<ReviewDecision[]>;
  supersedePriorDecisions(requestId: string, reviewerRole: string): Promise<void>;

  createPlatform(platform: InsertPlatform): Promise<Platform>;
  getPlatform(id: string): Promise<Platform | undefined>;
  getPlatformByToolName(toolName: string): Promise<Platform | undefined>;
  getAllPlatforms(): Promise<Platform[]>;
  updatePlatform(id: string, data: Partial<Platform>): Promise<Platform | undefined>;
  deletePlatform(id: string): Promise<boolean>;

  createAttributeDefinition(attr: InsertAttributeDefinition): Promise<PlatformAttributeDefinition>;
  getAllAttributeDefinitions(): Promise<PlatformAttributeDefinition[]>;
  deleteAttributeDefinition(id: string): Promise<boolean>;

  createTier(tier: InsertTier): Promise<Tier>;
  getAllTiers(): Promise<Tier[]>;
  getTier(id: string): Promise<Tier | undefined>;
  updateTier(id: string, data: Partial<Tier>): Promise<Tier | undefined>;
  deleteTier(id: string): Promise<boolean>;

  deleteUser(id: string): Promise<boolean>;

  createRiskFinding(finding: InsertRiskFinding): Promise<RiskFinding>;
  getRiskFindingsByPlatform(platformId: string): Promise<RiskFinding[]>;
  getAllRiskFindings(): Promise<RiskFinding[]>;

  createAgentRunLog(log: InsertAgentRunLog): Promise<AgentRunLog>;
  getAllAgentRunLogs(): Promise<AgentRunLog[]>;
  updateAgentRunLogStatus(id: string, status: string, resultsSummary?: string, findingsCount?: number): Promise<void>;
  getRunningAgentLogs(): Promise<AgentRunLog[]>;

  deleteRequest(id: string): Promise<boolean>;

  getScanSchedule(): Promise<ScanSchedule | undefined>;
  upsertScanSchedule(data: Partial<InsertScanSchedule> & { id?: string }): Promise<ScanSchedule>;

  getAlertSchedule(): Promise<AlertSchedule | undefined>;
  upsertAlertSchedule(data: Partial<InsertAlertSchedule> & { id?: string }): Promise<AlertSchedule>;

  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogsByEntity(entityType: string, entityId: string): Promise<AuditLog[]>;

  createRequestComment(comment: InsertRequestComment): Promise<RequestComment>;
  getCommentsByRequest(requestId: string): Promise<RequestComment[]>;
  deleteRequestComment(id: string): Promise<boolean>;

  createRequestAttachment(attachment: InsertRequestAttachment): Promise<RequestAttachment>;
  getAttachmentsByRequest(requestId: string): Promise<RequestAttachment[]>;
  getAttachment(id: string): Promise<RequestAttachment | undefined>;
  deleteRequestAttachment(id: string): Promise<boolean>;

  // Platform Stakeholders
  createPlatformStakeholder(stakeholder: InsertPlatformStakeholder): Promise<PlatformStakeholder>;
  getStakeholdersByPlatform(platformId: string): Promise<PlatformStakeholder[]>;
  deletePlatformStakeholder(id: string): Promise<boolean>;

  // Expiration Alerts
  createExpirationAlert(alert: InsertExpirationAlert): Promise<ExpirationAlert>;
  getExpirationAlertsByPlatform(platformId: string): Promise<ExpirationAlert[]>;
  getAllExpirationAlerts(): Promise<ExpirationAlert[]>;
  updateExpirationAlert(id: string, data: Partial<ExpirationAlert>): Promise<ExpirationAlert | undefined>;
  deleteExpirationAlert(id: string): Promise<boolean>;

  // Platform Attachments
  createPlatformAttachment(attachment: InsertPlatformAttachment): Promise<PlatformAttachment>;
  getAttachmentsByPlatform(platformId: string): Promise<PlatformAttachment[]>;
  getPlatformAttachment(id: string): Promise<PlatformAttachment | undefined>;
  deletePlatformAttachment(id: string): Promise<boolean>;

  seedData(): Promise<void>;
  runStartupMigrations(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(users.name);
  }

  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }

  async updateUserRole(id: string, role: string, reviewerRole?: string): Promise<User | undefined> {
    const [updated] = await db.update(users).set({ role, reviewerRole: reviewerRole || null }).where(eq(users.id, id)).returning();
    return updated;
  }

  async createRequest(request: InsertRequest & { status?: string }): Promise<Request> {
    const trackingId = `ARC-${Date.now().toString(36).toUpperCase()}`;
    const status = request.status === "draft" ? "draft" : "pending_reviews";
    const [created] = await db.insert(requests).values({ ...request, trackingId, status }).returning();
    return created;
  }

  async getRequest(id: string): Promise<Request | undefined> {
    const [request] = await db.select().from(requests).where(eq(requests.id, id));
    return request;
  }

  async getRequestsByRequester(requesterId: string): Promise<Request[]> {
    return db.select().from(requests).where(eq(requests.requesterId, requesterId)).orderBy(desc(requests.createdAt));
  }

  async getAllRequests(): Promise<Request[]> {
    return db.select().from(requests).orderBy(desc(requests.createdAt));
  }

  async updateRequestStatus(id: string, status: string): Promise<Request | undefined> {
    const [updated] = await db.update(requests).set({ status, updatedAt: new Date() }).where(eq(requests.id, id)).returning();
    return updated;
  }

  async updateRequest(id: string, data: Partial<Request>): Promise<Request | undefined> {
    const [updated] = await db.update(requests).set({ ...data, updatedAt: new Date() }).where(eq(requests.id, id)).returning();
    return updated;
  }

  async deleteRequest(id: string): Promise<boolean> {
    const result = await db.delete(requests).where(eq(requests.id, id)).returning();
    return result.length > 0;
  }

  async createReviewDecision(decision: InsertReviewDecision): Promise<ReviewDecision> {
    const [created] = await db.insert(reviewDecisions).values(decision).returning();
    return created;
  }

  async getReviewDecisionsByRequest(requestId: string): Promise<ReviewDecision[]> {
    return db.select().from(reviewDecisions).where(eq(reviewDecisions.requestId, requestId)).orderBy(desc(reviewDecisions.createdAt));
  }

  async supersedePriorDecisions(requestId: string, reviewerRole: string): Promise<void> {
    await db.update(reviewDecisions)
      .set({ superseded: true })
      .where(and(eq(reviewDecisions.requestId, requestId), eq(reviewDecisions.reviewerRole, reviewerRole)));
  }

  async createPlatform(platform: InsertPlatform): Promise<Platform> {
    const [created] = await db.insert(platforms).values(platform).returning();
    return created;
  }

  async getPlatform(id: string): Promise<Platform | undefined> {
    const [platform] = await db.select().from(platforms).where(eq(platforms.id, id));
    return platform;
  }

  async getPlatformByToolName(toolName: string): Promise<Platform | undefined> {
    const [platform] = await db.select().from(platforms).where(ilike(platforms.toolName, toolName));
    return platform;
  }

  async getAllPlatforms(): Promise<Platform[]> {
    return db.select().from(platforms).orderBy(desc(platforms.createdAt));
  }

  async updatePlatform(id: string, data: Partial<Platform>): Promise<Platform | undefined> {
    const [updated] = await db.update(platforms).set({ ...data, updatedAt: new Date() }).where(eq(platforms.id, id)).returning();
    return updated;
  }

  async deletePlatform(id: string): Promise<boolean> {
    const result = await db.delete(platforms).where(eq(platforms.id, id)).returning();
    return result.length > 0;
  }

  async createAttributeDefinition(attr: InsertAttributeDefinition): Promise<PlatformAttributeDefinition> {
    const [created] = await db.insert(platformAttributeDefinitions).values(attr).returning();
    return created;
  }

  async getAllAttributeDefinitions(): Promise<PlatformAttributeDefinition[]> {
    return db.select().from(platformAttributeDefinitions).orderBy(platformAttributeDefinitions.name);
  }

  async deleteAttributeDefinition(id: string): Promise<boolean> {
    const result = await db.delete(platformAttributeDefinitions).where(eq(platformAttributeDefinitions.id, id)).returning();
    return result.length > 0;
  }

  async createTier(tier: InsertTier): Promise<Tier> {
    const [created] = await db.insert(tiers).values(tier).returning();
    return created;
  }

  async getAllTiers(): Promise<Tier[]> {
    return db.select().from(tiers).orderBy(tiers.name);
  }

  async getTier(id: string): Promise<Tier | undefined> {
    const [tier] = await db.select().from(tiers).where(eq(tiers.id, id));
    return tier;
  }

  async updateTier(id: string, data: Partial<Tier>): Promise<Tier | undefined> {
    const [updated] = await db.update(tiers).set(data).where(eq(tiers.id, id)).returning();
    return updated;
  }

  async deleteTier(id: string): Promise<boolean> {
    const result = await db.delete(tiers).where(eq(tiers.id, id)).returning();
    return result.length > 0;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }

  async createRiskFinding(finding: InsertRiskFinding): Promise<RiskFinding> {
    const [created] = await db.insert(riskFindings).values(finding).returning();
    return created;
  }

  async getRiskFindingsByPlatform(platformId: string): Promise<RiskFinding[]> {
    return db.select().from(riskFindings).where(eq(riskFindings.platformId, platformId)).orderBy(desc(riskFindings.createdAt));
  }

  async getAllRiskFindings(): Promise<RiskFinding[]> {
    return db.select().from(riskFindings).orderBy(desc(riskFindings.createdAt));
  }

  async createAgentRunLog(log: InsertAgentRunLog): Promise<AgentRunLog> {
    const [created] = await db.insert(agentRunLogs).values(log).returning();
    return created;
  }

  async getAllAgentRunLogs(): Promise<AgentRunLog[]> {
    return db.select().from(agentRunLogs).orderBy(desc(agentRunLogs.createdAt));
  }

  async updateAgentRunLogStatus(id: string, status: string, resultsSummary?: string, findingsCount?: number): Promise<void> {
    const update: Record<string, any> = { status };
    if (resultsSummary !== undefined) update.resultsSummary = resultsSummary;
    if (findingsCount !== undefined) update.findingsCount = findingsCount;
    await db.update(agentRunLogs).set(update).where(eq(agentRunLogs.id, id));
  }

  async getRunningAgentLogs(): Promise<AgentRunLog[]> {
    return db.select().from(agentRunLogs).where(eq(agentRunLogs.status, "running"));
  }

  async getScanSchedule(): Promise<ScanSchedule | undefined> {
    const [schedule] = await db.select().from(scanSchedules).limit(1);
    return schedule;
  }

  async upsertScanSchedule(data: Partial<InsertScanSchedule> & { id?: string }): Promise<ScanSchedule> {
    const existing = await this.getScanSchedule();
    if (existing) {
      const [updated] = await db.update(scanSchedules)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(scanSchedules.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(scanSchedules).values({
      cronExpression: data.cronExpression || "0 0 * * *",
      enabled: data.enabled ?? true,
      scope: data.scope || "all",
      createdBy: data.createdBy,
    }).returning();
    return created;
  }

  async getAlertSchedule(): Promise<AlertSchedule | undefined> {
    const [schedule] = await db.select().from(alertSchedules).limit(1);
    return schedule;
  }

  async upsertAlertSchedule(data: Partial<InsertAlertSchedule> & { id?: string }): Promise<AlertSchedule> {
    const existing = await this.getAlertSchedule();
    if (existing) {
      const [updated] = await db.update(alertSchedules)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(alertSchedules.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(alertSchedules).values({
      cronExpression: data.cronExpression || "0 8 * * *",
      enabled: data.enabled ?? false,
    }).returning();
    return created;
  }

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [created] = await db.insert(auditLogs).values(log).returning();
    return created;
  }

  async getAuditLogsByEntity(entityType: string, entityId: string): Promise<AuditLog[]> {
    return db.select().from(auditLogs)
      .where(and(eq(auditLogs.entityType, entityType), eq(auditLogs.entityId, entityId)))
      .orderBy(desc(auditLogs.timestamp));
  }

  async createRequestComment(comment: InsertRequestComment): Promise<RequestComment> {
    const [created] = await db.insert(requestComments).values(comment).returning();
    return created;
  }

  async getCommentsByRequest(requestId: string): Promise<RequestComment[]> {
    return db.select().from(requestComments).where(eq(requestComments.requestId, requestId)).orderBy(desc(requestComments.createdAt));
  }

  async deleteRequestComment(id: string): Promise<boolean> {
    const result = await db.delete(requestComments).where(eq(requestComments.id, id)).returning();
    return result.length > 0;
  }

  async createRequestAttachment(attachment: InsertRequestAttachment): Promise<RequestAttachment> {
    const [created] = await db.insert(requestAttachments).values(attachment).returning();
    return created;
  }

  async getAttachmentsByRequest(requestId: string): Promise<RequestAttachment[]> {
    return db.select().from(requestAttachments).where(eq(requestAttachments.requestId, requestId)).orderBy(desc(requestAttachments.createdAt));
  }

  async getAttachment(id: string): Promise<RequestAttachment | undefined> {
    const [attachment] = await db.select().from(requestAttachments).where(eq(requestAttachments.id, id));
    return attachment;
  }

  async deleteRequestAttachment(id: string): Promise<boolean> {
    const result = await db.delete(requestAttachments).where(eq(requestAttachments.id, id)).returning();
    return result.length > 0;
  }

  // Platform Stakeholders
  async createPlatformStakeholder(stakeholder: InsertPlatformStakeholder): Promise<PlatformStakeholder> {
    const [created] = await db.insert(platformStakeholders).values(stakeholder).returning();
    return created;
  }

  async getStakeholdersByPlatform(platformId: string): Promise<PlatformStakeholder[]> {
    return db.select().from(platformStakeholders).where(eq(platformStakeholders.platformId, platformId)).orderBy(platformStakeholders.name);
  }

  async deletePlatformStakeholder(id: string): Promise<boolean> {
    const result = await db.delete(platformStakeholders).where(eq(platformStakeholders.id, id)).returning();
    return result.length > 0;
  }

  // Expiration Alerts
  async createExpirationAlert(alert: InsertExpirationAlert): Promise<ExpirationAlert> {
    const [created] = await db.insert(expirationAlerts).values(alert).returning();
    return created;
  }

  async getExpirationAlertsByPlatform(platformId: string): Promise<ExpirationAlert[]> {
    return db.select().from(expirationAlerts).where(eq(expirationAlerts.platformId, platformId)).orderBy(desc(expirationAlerts.createdAt));
  }

  async getAllExpirationAlerts(): Promise<ExpirationAlert[]> {
    return db.select().from(expirationAlerts).orderBy(desc(expirationAlerts.createdAt));
  }

  async updateExpirationAlert(id: string, data: Partial<ExpirationAlert>): Promise<ExpirationAlert | undefined> {
    const [updated] = await db.update(expirationAlerts).set(data).where(eq(expirationAlerts.id, id)).returning();
    return updated;
  }

  async deleteExpirationAlert(id: string): Promise<boolean> {
    const result = await db.delete(expirationAlerts).where(eq(expirationAlerts.id, id)).returning();
    return result.length > 0;
  }

  // Platform Attachments
  async createPlatformAttachment(attachment: InsertPlatformAttachment): Promise<PlatformAttachment> {
    const [created] = await db.insert(platformAttachments).values(attachment).returning();
    return created;
  }

  async getAttachmentsByPlatform(platformId: string): Promise<PlatformAttachment[]> {
    return db.select().from(platformAttachments).where(eq(platformAttachments.platformId, platformId)).orderBy(desc(platformAttachments.createdAt));
  }

  async getPlatformAttachment(id: string): Promise<PlatformAttachment | undefined> {
    const [attachment] = await db.select().from(platformAttachments).where(eq(platformAttachments.id, id));
    return attachment;
  }

  async deletePlatformAttachment(id: string): Promise<boolean> {
    const result = await db.delete(platformAttachments).where(eq(platformAttachments.id, id)).returning();
    return result.length > 0;
  }

  async seedData(): Promise<void> {
    // Runtime migration: add logo_url column if missing
    await pool.query(`
      ALTER TABLE platforms ADD COLUMN IF NOT EXISTS logo_url TEXT;
    `).catch(() => { /* column may already exist */ });

    const existingUsers = await db.select().from(users);
    if (existingUsers.length > 0) return;

    const seedUsers: InsertUser[] = [
      { name: "LeaAnna Hernandez", email: "leaanna.hernandez@entravision.com", department: "AI Strategy", role: "chair", reviewerRole: "strategic" },
      { name: "Kirun Amiri", email: "kirun.amiri@entravision.com", department: "IT Governance", role: "reviewer", reviewerRole: "chair" },
      { name: "Josh Silva", email: "josh.silva@entravision.com", department: "Cyber Security", role: "reviewer", reviewerRole: "security" },
      { name: "Jorge Domingo", email: "jorge.domingo@entravision.com", department: "Technology", role: "admin", reviewerRole: "technical_financial" },
    ];

    const createdUsers: User[] = [];
    for (const u of seedUsers) {
      const [created] = await db.insert(users).values(u).returning();
      createdUsers.push(created);
    }

    const [tier0] = await db.insert(tiers).values({
      name: "Tier 0 - Experimental",
      description: "Tools in trial phase with limited data access. No PII or client data allowed.",
      allowedDataTypes: ["public"],
      requiredControls: [],
    }).returning();

    const [tier1] = await db.insert(tiers).values({
      name: "Tier 1 - Approved",
      description: "Approved for general business use. Internal data allowed with SSO.",
      allowedDataTypes: ["public", "internal"],
      requiredControls: ["SSO"],
    }).returning();

    const [tier2] = await db.insert(tiers).values({
      name: "Tier 2 - Enterprise Standard",
      description: "Enterprise-grade tools with full data access. Contract and SSO required.",
      allowedDataTypes: ["public", "internal", "pii", "client_data"],
      requiredControls: ["SSO", "Contract", "DPA"],
    }).returning();

    const leaanna = createdUsers.find(u => u.email === "leaanna.hernandez@entravision.com")!;
    const kirun = createdUsers.find(u => u.email === "kirun.amiri@entravision.com")!;
    const josh = createdUsers.find(u => u.email === "josh.silva@entravision.com")!;
    const jorge = createdUsers.find(u => u.email === "jorge.domingo@entravision.com")!;

    const [platform1] = await db.insert(platforms).values({
      toolName: "ChatGPT Enterprise",
      status: "approved",
      tierId: tier2.id,
      department: "Engineering",
      primaryGoal: "Code generation, documentation, and analysis assistance",
      estimatedUsers: "department",
      impactLevel: "high",
      costStructure: "per_seat",
      annualCost: "48000.00",
      dataInput: ["internal_financials", "public"],
      dataTraining: "no",
      loginMethod: "SSO",
      decisionSummary: "Approved for enterprise use with SSO. Training disabled. Contract signed.",
      approvalDate: new Date("2025-11-15"),
      ownerId: jorge.id,
      lastReviewedAt: new Date("2025-11-15"),
    }).returning();

    const [platform2] = await db.insert(platforms).values({
      toolName: "Jasper AI",
      status: "on_review",
      department: "Marketing",
      primaryGoal: "Marketing content creation and brand voice consistency",
      estimatedUsers: "team",
      impactLevel: "medium",
      costStructure: "monthly_subscription",
      annualCost: "12000.00",
      dataInput: ["public"],
      dataTraining: "unsure",
      loginMethod: "email_password",
      ownerId: jorge.id,
    }).returning();

    const [platform3] = await db.insert(platforms).values({
      toolName: "Copilot for M365",
      status: "approved",
      tierId: tier1.id,
      department: "IT",
      primaryGoal: "Productivity across Office suite - document drafting, email summaries",
      estimatedUsers: "department",
      impactLevel: "high",
      costStructure: "per_seat",
      annualCost: "72000.00",
      dataInput: ["internal_financials", "client_data"],
      dataTraining: "no",
      loginMethod: "SSO",
      decisionSummary: "Approved with M365 integration. Data stays within tenant.",
      approvalDate: new Date("2025-10-01"),
      ownerId: kirun.id,
      lastReviewedAt: new Date("2025-10-01"),
    }).returning();

    await db.insert(platforms).values({
      toolName: "DeepSeek Coder",
      status: "rejected",
      department: "Engineering",
      primaryGoal: "Open-source code completion",
      estimatedUsers: "individual",
      impactLevel: "low",
      costStructure: "",
      annualCost: "0",
      dataInput: ["public"],
      dataTraining: "yes",
      loginMethod: "other",
      decisionSummary: "Rejected due to data training concerns and lack of enterprise security controls.",
    });

    const [req1] = await db.insert(requests).values({
      trackingId: "ARC-001",
      requesterId: jorge.id,
      department: "Engineering",
      toolName: "ChatGPT Enterprise",
      status: "approved",
      requesterName: "Jorge Domingo",
      primaryGoal: "Code generation, documentation, and analysis assistance",
      estimatedUsers: "department",
      estimatedUsersCount: 45,
      workflowIntegration: "IDE plugins, CI/CD pipeline documentation",
      alternativesChecked: true,
      alternativesText: "Evaluated GitHub Copilot, Amazon CodeWhisperer",
      impactLevel: "high",
      compatibility: ["outlook", "other"],
      compatibilityNotes: "API integration with internal dev tools",
      costStructure: "per_seat",
      annualCost: "48000.00",
      dataInput: ["internal_financials", "public"],
      dataTraining: "no",
      loginMethod: "SSO",
      platformId: platform1.id,
    }).returning();

    await db.insert(reviewDecisions).values([
      { requestId: req1.id, reviewerRole: "security", reviewerId: josh.id, decision: "pass", rationale: "SSO enforced, training disabled, data handling compliant with policy.", riskNotes: "Monitor for any changes to OpenAI data processing terms." },
      { requestId: req1.id, reviewerRole: "technical_financial", reviewerId: jorge.id, decision: "pass", rationale: "API capabilities strong. Cost per seat reasonable for expected productivity gains. ROI estimated at 3x.", conditions: "Annual review of usage metrics required." },
      { requestId: req1.id, reviewerRole: "chair", reviewerId: leaanna.id, decision: "pass", rationale: "Aligns with digital transformation strategy. Approved for enterprise rollout." },
      { requestId: req1.id, reviewerRole: "chair", reviewerId: kirun.id, decision: "pass", rationale: "IT governance requirements met. SSO and audit logging confirmed." },
    ]);

    const [req2] = await db.insert(requests).values({
      trackingId: "ARC-002",
      requesterId: kirun.id,
      department: "Marketing",
      toolName: "Jasper AI",
      status: "pending_reviews",
      requesterName: "Kirun Amiri",
      primaryGoal: "Marketing content creation and brand voice consistency",
      estimatedUsers: "team",
      estimatedUsersCount: 8,
      workflowIntegration: "Content calendar workflow, social media scheduling tools",
      alternativesChecked: true,
      alternativesText: "Looked at Copy.ai and Writesonic",
      impactLevel: "medium",
      compatibility: ["outlook", "crm"],
      costStructure: "monthly_subscription",
      annualCost: "12000.00",
      dataInput: ["public"],
      dataTraining: "unsure",
      loginMethod: "email_password",
      platformId: platform2.id,
    }).returning();

    await db.insert(reviewDecisions).values({
      requestId: req2.id, reviewerRole: "strategic", reviewerId: leaanna.id, decision: "pass", rationale: "Good strategic fit for marketing team. Content automation aligns with Q1 goals.",
    });

    await db.insert(riskFindings).values([
      {
        platformId: platform1.id,
        classification: "low",
        summary: "OpenAI updated terms of service for enterprise customers. No material changes to data handling.",
        sources: [{ url: "https://openai.com/policies/terms-of-use", title: "OpenAI Terms of Service Update" }],
        recommendedActions: "No action required. Continue monitoring.",
        confidence: "high",
      },
      {
        platformId: platform2.id,
        classification: "medium",
        summary: "Jasper AI reported a minor data exposure incident affecting free-tier users. Enterprise accounts not impacted per vendor statement.",
        sources: [{ url: "https://jasper.ai/security", title: "Jasper Security Advisory" }],
        recommendedActions: "Request formal incident report from vendor. Verify enterprise isolation.",
        confidence: "medium",
      },
      {
        platformId: platform3.id,
        classification: "low",
        summary: "Microsoft released security patch for Copilot M365 integration. Auto-updated for all tenants.",
        sources: [{ url: "https://microsoft.com/security", title: "Microsoft Security Update" }],
        recommendedActions: "Verify patch applied to tenant. No manual action needed.",
        confidence: "high",
      },
    ]);

    await db.insert(agentRunLogs).values({
      initiatedBy: null,
      scope: "all",
      prompt: "Daily sweep for all Approved and On Review platforms",
      platformsChecked: ["ChatGPT Enterprise", "Jasper AI", "Copilot for M365"],
      resultsSummary: "3 platforms checked. 3 findings logged (2 low, 1 medium).",
      findingsCount: 3,
    });

    await db.insert(platformAttributeDefinitions).values([
      { name: "Contract Expiration Date", dataType: "date", required: false },
      { name: "Data Residency", dataType: "dropdown", options: ["US", "EU", "APAC", "Global"], required: false },
      { name: "SOC2 Certified", dataType: "boolean", required: false, defaultValue: "false" },
    ]);
  }

  async runStartupMigrations(): Promise<void> {
    // Allow nullable fields for draft requests
    await pool.query(`
      ALTER TABLE requests ALTER COLUMN primary_goal DROP NOT NULL;
      ALTER TABLE requests ALTER COLUMN impact_level DROP NOT NULL;
      ALTER TABLE requests ALTER COLUMN login_method DROP NOT NULL;
      ALTER TABLE requests ALTER COLUMN estimated_users DROP NOT NULL;
    `).catch(() => { /* columns may already be nullable */ });

    // Add new Basics section fields
    await pool.query(`
      ALTER TABLE requests ADD COLUMN IF NOT EXISTS division TEXT;
      ALTER TABLE requests ADD COLUMN IF NOT EXISTS tool_category TEXT;
      ALTER TABLE requests ADD COLUMN IF NOT EXISTS tool_category_other TEXT;
      ALTER TABLE requests ADD COLUMN IF NOT EXISTS already_in_use TEXT;
      ALTER TABLE requests ADD COLUMN IF NOT EXISTS authorized_requestor BOOLEAN DEFAULT FALSE;
      ALTER TABLE requests ADD COLUMN IF NOT EXISTS training_plan TEXT;
      ALTER TABLE requests ADD COLUMN IF NOT EXISTS training_plan_details TEXT;
      ALTER TABLE requests ADD COLUMN IF NOT EXISTS ai_policy_acknowledged BOOLEAN DEFAULT FALSE;
      ALTER TABLE requests ADD COLUMN IF NOT EXISTS use_case_type TEXT;
      ALTER TABLE requests ADD COLUMN IF NOT EXISTS cost_notes TEXT;
      ALTER TABLE requests ADD COLUMN IF NOT EXISTS budget_owner TEXT;
      ALTER TABLE requests ADD COLUMN IF NOT EXISTS cost_center TEXT;
    `).catch(() => { /* columns may already exist */ });

    // Rename "Contract Expiry" and "Contract Expiration" → "Contract Expiration Date"
    await db.execute(sql`
      UPDATE platform_attribute_definitions
      SET name = 'Contract Expiration Date'
      WHERE name IN ('Contract Expiry', 'Contract Expiration')
    `);

    // Rename the JSON key in all platform dynamic_attributes
    await db.execute(sql`
      UPDATE platforms
      SET dynamic_attributes = (dynamic_attributes - 'Contract Expiry' - 'Contract Expiration')
        || CASE WHEN dynamic_attributes ? 'Contract Expiry'
                THEN jsonb_build_object('Contract Expiration Date', dynamic_attributes->'Contract Expiry')
                WHEN dynamic_attributes ? 'Contract Expiration'
                THEN jsonb_build_object('Contract Expiration Date', dynamic_attributes->'Contract Expiration')
                ELSE '{}'::jsonb END
      WHERE dynamic_attributes ? 'Contract Expiry' OR dynamic_attributes ? 'Contract Expiration'
    `);
  }
}

export const storage = new DatabaseStorage();
