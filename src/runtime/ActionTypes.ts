// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHINGOS - Action Types
// Standard action definitions for agents
// ═══════════════════════════════════════════════════════════════════════════════

export type ActionResult<T = unknown> = 
  | { success: true; data: T }
  | { success: false; error: string };

// ─────────────────────────────────────────────────────────────────────────────
// Perception Actions
// ─────────────────────────────────────────────────────────────────────────────

export interface PerceptionInput {
  source: string;
  data: unknown;
  timestamp: number;
}

export interface PerceptionOutput {
  entities: Entity[];
  events: DetectedEvent[];
  context: Record<string, unknown>;
}

export interface Entity {
  id: string;
  type: string;
  attributes: Record<string, unknown>;
  confidence: number;
}

export interface DetectedEvent {
  type: string;
  description: string;
  importance: 'low' | 'medium' | 'high' | 'critical';
  data: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Analysis Actions
// ─────────────────────────────────────────────────────────────────────────────

export interface AnalysisInput {
  entities: Entity[];
  events: DetectedEvent[];
  context: Record<string, unknown>;
  history?: unknown[];
}

export interface AnalysisOutput {
  insights: Insight[];
  patterns: Pattern[];
  recommendations: Recommendation[];
}

export interface Insight {
  id: string;
  type: string;
  description: string;
  confidence: number;
  evidence: unknown[];
}

export interface Pattern {
  id: string;
  type: string;
  description: string;
  frequency: number;
  lastSeen: number;
}

export interface Recommendation {
  id: string;
  action: string;
  priority: number;
  reasoning: string;
  confidence: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Decision Actions
// ─────────────────────────────────────────────────────────────────────────────

export interface DecisionInput {
  context: Record<string, unknown>;
  options: DecisionOption[];
  constraints?: Constraint[];
  goals?: Goal[];
}

export interface DecisionOption {
  id: string;
  action: string;
  parameters: Record<string, unknown>;
  expectedOutcome?: string;
  risk?: 'low' | 'medium' | 'high';
}

export interface Constraint {
  type: string;
  condition: string;
  value: unknown;
}

export interface Goal {
  id: string;
  description: string;
  priority: number;
  metrics?: Record<string, unknown>;
}

export interface DecisionOutput {
  selectedOption: DecisionOption;
  reasoning: string;
  confidence: number;
  alternativeOptions?: DecisionOption[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Execution Actions
// ─────────────────────────────────────────────────────────────────────────────

export interface ExecutionInput {
  action: string;
  parameters: Record<string, unknown>;
  target?: string;
  timeout?: number;
}

export interface ExecutionOutput {
  status: 'success' | 'partial' | 'failed';
  result?: unknown;
  error?: string;
  duration: number;
  sideEffects?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Learning Actions
// ─────────────────────────────────────────────────────────────────────────────

export interface LearningInput {
  experience: Experience;
  feedback?: Feedback;
}

export interface Experience {
  context: Record<string, unknown>;
  action: string;
  outcome: unknown;
  timestamp: number;
}

export interface Feedback {
  type: 'positive' | 'negative' | 'neutral';
  score?: number;
  comment?: string;
}

export interface LearningOutput {
  updated: boolean;
  improvements?: string[];
  newPatterns?: Pattern[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Communication Actions
// ─────────────────────────────────────────────────────────────────────────────

export interface Message {
  id: string;
  type: 'text' | 'image' | 'audio' | 'video' | 'file' | 'embed';
  content: string;
  metadata?: Record<string, unknown>;
  attachments?: Attachment[];
}

export interface Attachment {
  type: string;
  url?: string;
  data?: unknown;
  filename?: string;
}

export interface ConversationContext {
  conversationId: string;
  platform: string;
  participants: Participant[];
  history: Message[];
  metadata?: Record<string, unknown>;
}

export interface Participant {
  id: string;
  name: string;
  role?: string;
  metadata?: Record<string, unknown>;
}

export interface ReplyDecision {
  shouldReply: boolean;
  content?: string;
  delay?: number;
  reasoning: string;
  tone?: string;
  actions?: string[];
}
