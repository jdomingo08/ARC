import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoleEnum = z.enum(["requester", "reviewer", "chair", "admin"]);
export type UserRole = z.infer<typeof userRoleEnum>;

export const reviewerRoleEnum = z.enum(["security", "technical_financial", "strategic", "chair"]);
export type ReviewerRole = z.infer<typeof reviewerRoleEnum>;

export const requestStatusEnum = z.enum(["draft", "pending_reviews", "waiting_on_requester", "waiting_on_reviewer", "approved", "rejected"]);
export type RequestStatus = z.infer<typeof requestStatusEnum>;

export const platformStatusEnum = z.enum(["on_review", "approved", "rejected", "retired"]);
export type PlatformStatus = z.infer<typeof platformStatusEnum>;

export const decisionEnum = z.enum(["pass", "fail", "needs_more_info"]);
export type Decision = z.infer<typeof decisionEnum>;

export const impactLevelEnum = z.enum(["high", "medium", "low"]);
export type ImpactLevel = z.infer<typeof impactLevelEnum>;

export const estimatedUsersEnum = z.enum(["individual", "team", "department"]);
export type EstimatedUsers = z.infer<typeof estimatedUsersEnum>;

export const costStructureEnum = z.enum(["monthly_subscription", "per_seat", "one_time", "other", ""]);
export type CostStructure = z.infer<typeof costStructureEnum>;

export const dataTrainingEnum = z.enum(["yes", "no", "unsure"]);
export type DataTraining = z.infer<typeof dataTrainingEnum>;

export const riskClassificationEnum = z.enum(["low", "medium", "high", "critical"]);
export type RiskClassification = z.infer<typeof riskClassificationEnum>;

export const confidenceEnum = z.enum(["low", "medium", "high"]);
export type Confidence = z.infer<typeof confidenceEnum>;

export const attributeTypeEnum = z.enum(["text", "number", "dropdown", "multi_select", "date", "boolean"]);
export type AttributeType = z.infer<typeof attributeTypeEnum>;

export const runStatusEnum = z.enum(["running", "completed", "failed"]);
export type RunStatus = z.infer<typeof runStatusEnum>;

export const runTriggerEnum = z.enum(["manual", "scheduled"]);
export type RunTrigger = z.infer<typeof runTriggerEnum>;

export const users = pgTable("users", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  department: text("department").notNull(),
  role: text("role").notNull().default("requester"),
  reviewerRole: text("reviewer_role"),
});

export const requests = pgTable("requests", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  trackingId: text("tracking_id").notNull().unique(),
  requesterId: varchar("requester_id", { length: 36 }).notNull(),
  department: text("department").notNull(),
  toolName: text("tool_name").notNull(),
  status: text("status").notNull().default("pending_reviews"),
  locked: boolean("locked").default(false).notNull(),
  requesterName: text("requester_name").notNull(),
  primaryGoal: text("primary_goal").notNull(),
  estimatedUsers: text("estimated_users").notNull(),
  estimatedUsersCount: integer("estimated_users_count"),
  workflowIntegration: text("workflow_integration"),
  alternativesChecked: boolean("alternatives_checked").default(false),
  alternativesText: text("alternatives_text"),
  impactLevel: text("impact_level").notNull(),
  compatibility: text("compatibility").array(),
  compatibilityNotes: text("compatibility_notes"),
  costStructure: text("cost_structure"),
  annualCost: decimal("annual_cost", { precision: 12, scale: 2 }),
  dataInput: text("data_input").array(),
  dataInputNotes: text("data_input_notes"),
  dataTraining: text("data_training"),
  loginMethod: text("login_method").notNull(),
  division: text("division"),
  toolCategory: text("tool_category").array(),
  toolCategoryOther: text("tool_category_other"),
  alreadyInUse: text("already_in_use"),
  authorizedRequestor: boolean("authorized_requestor").default(false),
  trainingPlan: text("training_plan"),
  trainingPlanDetails: text("training_plan_details"),
  aiPolicyAcknowledged: boolean("ai_policy_acknowledged").default(false),
  costNotes: text("cost_notes"),
  budgetOwner: text("budget_owner"),
  costCenter: text("cost_center"),
  tierAssignment: text("tier_assignment"),
  useCaseType: text("use_case_type"),
  vendorPacketAcknowledged: boolean("vendor_packet_acknowledged").default(false),
  vendorQuestionnaireToken: text("vendor_questionnaire_token"),
  vendorQuestionnaireCompleted: boolean("vendor_questionnaire_completed").default(false),
  vendorQuestionnaireData: jsonb("vendor_questionnaire_data"),
  vendorSecurityReview: jsonb("vendor_security_review"),
  vendorSecurityReviewerId: varchar("vendor_security_reviewer_id", { length: 36 }),
  vendorSecurityReviewedAt: timestamp("vendor_security_reviewed_at"),
  platformId: varchar("platform_id", { length: 36 }),
  waitingOnRole: text("waiting_on_role"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const reviewDecisions = pgTable("review_decisions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  requestId: varchar("request_id", { length: 36 }).notNull(),
  reviewerRole: text("reviewer_role").notNull(),
  reviewerId: varchar("reviewer_id", { length: 36 }).notNull(),
  decision: text("decision").notNull(),
  rationale: text("rationale").notNull(),
  riskNotes: text("risk_notes"),
  conditions: text("conditions"),
  routedToRole: text("routed_to_role"),
  superseded: boolean("superseded").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const platforms = pgTable("platforms", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  toolName: text("tool_name").notNull().unique(),
  status: text("status").notNull().default("on_review"),
  tierId: varchar("tier_id", { length: 36 }),
  department: text("department"),
  primaryGoal: text("primary_goal"),
  estimatedUsers: text("estimated_users"),
  impactLevel: text("impact_level"),
  costStructure: text("cost_structure"),
  annualCost: decimal("annual_cost", { precision: 12, scale: 2 }),
  dataInput: text("data_input").array(),
  dataTraining: text("data_training"),
  loginMethod: text("login_method"),
  decisionSummary: text("decision_summary"),
  approvalDate: timestamp("approval_date"),
  logoUrl: text("logo_url"),
  dynamicAttributes: jsonb("dynamic_attributes").default({}),
  ownerId: varchar("owner_id", { length: 36 }),
  lastReviewedAt: timestamp("last_reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const platformAttributeDefinitions = pgTable("platform_attribute_definitions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  dataType: text("data_type").notNull(),
  options: jsonb("options"),
  required: boolean("required").default(false),
  defaultValue: text("default_value"),
  scopeStatuses: text("scope_statuses").array(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tiers = pgTable("tiers", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  allowedDataTypes: jsonb("allowed_data_types"),
  requiredControls: jsonb("required_controls"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const riskFindings = pgTable("risk_findings", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  platformId: varchar("platform_id", { length: 36 }).notNull(),
  classification: text("classification").notNull(),
  summary: text("summary").notNull(),
  sources: jsonb("sources"),
  recommendedActions: text("recommended_actions"),
  confidence: text("confidence").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const agentRunLogs = pgTable("agent_run_logs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  initiatedBy: varchar("initiated_by", { length: 36 }),
  scope: text("scope").notNull(),
  prompt: text("prompt"),
  platformsChecked: jsonb("platforms_checked"),
  resultsSummary: text("results_summary"),
  findingsCount: integer("findings_count").default(0),
  status: text("status").notNull().default("completed"),
  trigger: text("trigger").notNull().default("manual"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const scanSchedules = pgTable("scan_schedules", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  cronExpression: text("cron_expression").notNull().default("0 0 * * *"),
  enabled: boolean("enabled").notNull().default(true),
  scope: text("scope").notNull().default("all"),
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at"),
  createdBy: varchar("created_by", { length: 36 }),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  entityType: text("entity_type").notNull(),
  entityId: varchar("entity_id", { length: 36 }).notNull(),
  action: text("action").notNull(),
  before: jsonb("before"),
  after: jsonb("after"),
  actorId: varchar("actor_id", { length: 36 }),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const requestComments = pgTable("request_comments", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  requestId: varchar("request_id", { length: 36 }).notNull(),
  authorId: varchar("author_id", { length: 36 }).notNull(),
  authorName: text("author_name").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const requestAttachments = pgTable("request_attachments", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  requestId: varchar("request_id", { length: 36 }).notNull(),
  uploadedBy: varchar("uploaded_by", { length: 36 }).notNull(),
  uploaderName: text("uploader_name").notNull(),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: text("mime_type"),
  storagePath: text("storage_path").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const platformStakeholders = pgTable("platform_stakeholders", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  platformId: varchar("platform_id", { length: 36 }).notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role"), // e.g., "owner", "technical_lead", "business_sponsor"
  source: text("source").notNull().default("manual"), // "manual" | "google" | "slack" — extensible for future integrations
  sourceId: text("source_id"), // external ID from Google/Slack when integrated
  addedBy: varchar("added_by", { length: 36 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const expirationAlerts = pgTable("expiration_alerts", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  platformId: varchar("platform_id", { length: 36 }).notNull(),
  alertDaysBefore: integer("alert_days_before").notNull().default(30),
  alertSent: boolean("alert_sent").default(false).notNull(),
  alertSentAt: timestamp("alert_sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const alertSchedules = pgTable("alert_schedules", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  cronExpression: text("cron_expression").notNull().default("0 8 * * *"),
  enabled: boolean("enabled").notNull().default(false),
  lastRunAt: timestamp("last_run_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const platformAttachments = pgTable("platform_attachments", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  platformId: varchar("platform_id", { length: 36 }).notNull(),
  uploadedBy: varchar("uploaded_by", { length: 36 }).notNull(),
  uploaderName: text("uploader_name").notNull(),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: text("mime_type"),
  storagePath: text("storage_path").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const workflowSteps = pgTable("workflow_steps", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  reviewerRole: text("reviewer_role").notNull(),
  sortOrder: integer("sort_order").notNull(),
  required: boolean("required").notNull().default(true),
  minApprovals: integer("min_approvals").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertWorkflowStepSchema = createInsertSchema(workflowSteps).omit({ id: true, createdAt: true });

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertRequestSchema = createInsertSchema(requests).omit({ id: true, trackingId: true, createdAt: true, updatedAt: true, platformId: true, status: true, locked: true });
export const insertReviewDecisionSchema = createInsertSchema(reviewDecisions).omit({ id: true, createdAt: true, superseded: true });
export const insertPlatformSchema = createInsertSchema(platforms).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAttributeDefinitionSchema = createInsertSchema(platformAttributeDefinitions).omit({ id: true, createdAt: true });
export const insertTierSchema = createInsertSchema(tiers).omit({ id: true, createdAt: true });
export const insertRiskFindingSchema = createInsertSchema(riskFindings).omit({ id: true, createdAt: true });
export const insertAgentRunLogSchema = createInsertSchema(agentRunLogs).omit({ id: true, createdAt: true });
export const insertScanScheduleSchema = createInsertSchema(scanSchedules).omit({ id: true, updatedAt: true });
export const insertAlertScheduleSchema = createInsertSchema(alertSchedules).omit({ id: true, updatedAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, timestamp: true });
export const insertRequestCommentSchema = createInsertSchema(requestComments).omit({ id: true, createdAt: true });
export const insertRequestAttachmentSchema = createInsertSchema(requestAttachments).omit({ id: true, createdAt: true });
export const insertPlatformStakeholderSchema = createInsertSchema(platformStakeholders).omit({ id: true, createdAt: true });
export const insertExpirationAlertSchema = createInsertSchema(expirationAlerts).omit({ id: true, createdAt: true });
export const insertPlatformAttachmentSchema = createInsertSchema(platformAttachments).omit({ id: true, createdAt: true });

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Request = typeof requests.$inferSelect;
export type InsertRequest = z.infer<typeof insertRequestSchema>;
export type ReviewDecision = typeof reviewDecisions.$inferSelect;
export type InsertReviewDecision = z.infer<typeof insertReviewDecisionSchema>;
export type Platform = typeof platforms.$inferSelect;
export type InsertPlatform = z.infer<typeof insertPlatformSchema>;
export type PlatformAttributeDefinition = typeof platformAttributeDefinitions.$inferSelect;
export type InsertAttributeDefinition = z.infer<typeof insertAttributeDefinitionSchema>;
export type Tier = typeof tiers.$inferSelect;
export type InsertTier = z.infer<typeof insertTierSchema>;
export type RiskFinding = typeof riskFindings.$inferSelect;
export type InsertRiskFinding = z.infer<typeof insertRiskFindingSchema>;
export type AgentRunLog = typeof agentRunLogs.$inferSelect;
export type InsertAgentRunLog = z.infer<typeof insertAgentRunLogSchema>;
export type ScanSchedule = typeof scanSchedules.$inferSelect;
export type InsertScanSchedule = z.infer<typeof insertScanScheduleSchema>;
export type AlertSchedule = typeof alertSchedules.$inferSelect;
export type InsertAlertSchedule = z.infer<typeof insertAlertScheduleSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type RequestComment = typeof requestComments.$inferSelect;
export type InsertRequestComment = z.infer<typeof insertRequestCommentSchema>;
export type RequestAttachment = typeof requestAttachments.$inferSelect;
export type InsertRequestAttachment = z.infer<typeof insertRequestAttachmentSchema>;
export type PlatformStakeholder = typeof platformStakeholders.$inferSelect;
export type InsertPlatformStakeholder = z.infer<typeof insertPlatformStakeholderSchema>;
export type ExpirationAlert = typeof expirationAlerts.$inferSelect;
export type InsertExpirationAlert = z.infer<typeof insertExpirationAlertSchema>;
export type PlatformAttachment = typeof platformAttachments.$inferSelect;
export type InsertPlatformAttachment = z.infer<typeof insertPlatformAttachmentSchema>;
export type WorkflowStep = typeof workflowSteps.$inferSelect;
export type InsertWorkflowStep = z.infer<typeof insertWorkflowStepSchema>;
