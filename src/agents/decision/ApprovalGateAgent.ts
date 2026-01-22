// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHINGOS - Approval Gate Agent
// Human-in-the-loop for sensitive decisions
// Bridges automation and safety
// ═══════════════════════════════════════════════════════════════════════════════

import { Agent, AgentConfig } from '../../runtime/Agent';
import { eventBus } from '../../core/event-bus/EventBus';
import { toolRegistry } from '../../services/tools';
import { intentManager, Intent } from '../../runtime/IntentContract';
import { ToolApprovalRequest } from '../../services/tools/ToolTypes';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ApprovalChannel = 'cli' | 'webhook' | 'discord' | 'slack' | 'email';

export interface PendingApproval {
  id: string;
  type: 'tool' | 'intent';
  request: ToolApprovalRequest | Intent;
  summary: string;
  risk: 'low' | 'medium' | 'high' | 'critical';
  createdAt: number;
  expiresAt: number;
  notifiedChannels: ApprovalChannel[];
}

export interface ApprovalDecision {
  approvalId: string;
  approved: boolean;
  approvedBy: string;
  reason?: string;
  timestamp: number;
}

export interface ApprovalGateConfig {
  channels: ApprovalChannel[];
  defaultTimeout: number;          // ms before auto-deny
  webhookUrl?: string;
  discordChannelId?: string;
  slackChannelId?: string;
  emailTo?: string;
  autoApprove?: {
    lowRisk?: boolean;             // Auto-approve low risk
    trustedAgents?: string[];      // Auto-approve from these agents
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Approval Gate Agent
// ─────────────────────────────────────────────────────────────────────────────

export class ApprovalGateAgent extends Agent {
  private pending: Map<string, PendingApproval> = new Map();
  private history: ApprovalDecision[] = [];
  private gateConfig: ApprovalGateConfig;

  constructor(config?: Partial<ApprovalGateConfig>) {
    const agentConfig: AgentConfig = {
      id: 'approval-gate',
      name: 'Approval Gate',
      type: 'decision',
      description: 'Human-in-the-loop approval for sensitive actions',
      tickRate: 5000, // Check for expired approvals every 5s
    };

    super(agentConfig);

    this.gateConfig = {
      channels: config?.channels ?? ['cli'],
      defaultTimeout: config?.defaultTimeout ?? 300000, // 5 minutes
      webhookUrl: config?.webhookUrl,
      discordChannelId: config?.discordChannelId,
      slackChannelId: config?.slackChannelId,
      emailTo: config?.emailTo,
      autoApprove: config?.autoApprove,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  protected async onStart(): Promise<void> {
    // Listen for tool approval requests
    this.subscribe('tools:approval:request', (event) => {
      this.handleToolApproval(event.payload as ToolApprovalRequest);
    });

    // Listen for intent approval requests
    this.subscribe('intent:approval:required', (event) => {
      this.handleIntentApproval((event.payload as { intent: Intent }).intent);
    });

    // Listen for approval decisions (from external sources)
    this.subscribe('approval:decision', (event) => {
      this.processDecision(event.payload as ApprovalDecision);
    });

    this.log('info', `Approval Gate started with channels: ${this.gateConfig.channels.join(', ')}`);
  }

  protected async onStop(): Promise<void> {
    // Deny all pending on shutdown
    for (const [id, pending] of this.pending) {
      this.deny(id, 'system', 'Agent shutdown');
    }
    this.pending.clear();
  }

  protected async onTick(): Promise<void> {
    // Check for expired approvals
    const now = Date.now();
    
    for (const [id, pending] of this.pending) {
      if (now > pending.expiresAt) {
        this.log('warn', `Approval ${id} expired`);
        this.deny(id, 'timeout', 'Approval request timed out');
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Handle Incoming Requests
  // ─────────────────────────────────────────────────────────────────────────

  private handleToolApproval(request: ToolApprovalRequest): void {
    const risk = this.assessToolRisk(request);
    
    // Check auto-approve
    if (this.shouldAutoApprove(request.agentId, risk)) {
      this.log('info', `Auto-approving tool ${request.tool} for ${request.agentId}`);
      toolRegistry.approve(request.callId, 'approval-gate:auto');
      return;
    }

    const pending: PendingApproval = {
      id: request.callId,
      type: 'tool',
      request,
      summary: this.summarizeToolRequest(request),
      risk,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.gateConfig.defaultTimeout,
      notifiedChannels: [],
    };

    this.pending.set(request.callId, pending);
    this.notifyChannels(pending);
    
    this.emit('approval:pending', { approval: pending });
  }

  private handleIntentApproval(intent: Intent): void {
    const risk = this.assessIntentRisk(intent);

    // Check auto-approve
    if (this.shouldAutoApprove(intent.agentId, risk)) {
      this.log('info', `Auto-approving intent ${intent.type}:${intent.action} for ${intent.agentId}`);
      intentManager.approve(intent.id, 'approval-gate:auto');
      return;
    }

    const pending: PendingApproval = {
      id: intent.id,
      type: 'intent',
      request: intent,
      summary: this.summarizeIntent(intent),
      risk,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.gateConfig.defaultTimeout,
      notifiedChannels: [],
    };

    this.pending.set(intent.id, pending);
    this.notifyChannels(pending);

    this.emit('approval:pending', { approval: pending });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Risk Assessment
  // ─────────────────────────────────────────────────────────────────────────

  private assessToolRisk(request: ToolApprovalRequest): PendingApproval['risk'] {
    const trustLevel = request.trustLevel;
    
    switch (trustLevel) {
      case 'dangerous': return 'critical';
      case 'sensitive': return 'high';
      case 'moderate': return 'medium';
      default: return 'low';
    }
  }

  private assessIntentRisk(intent: Intent): PendingApproval['risk'] {
    // Assess based on intent type and confidence
    const typeRisk: Record<string, PendingApproval['risk']> = {
      'execute': 'high',
      'communicate': 'medium',
      'store': 'low',
      'query': 'low',
      'delegate': 'medium',
      'escalate': 'low',
      'schedule': 'medium',
    };

    let risk = typeRisk[intent.type] ?? 'medium';

    // Lower confidence = higher risk
    if (intent.confidence < 0.5) {
      if (risk === 'low') risk = 'medium';
      else if (risk === 'medium') risk = 'high';
    }

    // High priority escalates risk
    if (intent.priority === 'critical') {
      if (risk === 'medium') risk = 'high';
      else if (risk === 'high') risk = 'critical';
    }

    return risk;
  }

  private shouldAutoApprove(agentId: string, risk: PendingApproval['risk']): boolean {
    if (!this.gateConfig.autoApprove) return false;

    // Auto-approve low risk if configured
    if (risk === 'low' && this.gateConfig.autoApprove.lowRisk) {
      return true;
    }

    // Auto-approve trusted agents
    if (this.gateConfig.autoApprove.trustedAgents?.includes(agentId)) {
      return true;
    }

    return false;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Notification
  // ─────────────────────────────────────────────────────────────────────────

  private async notifyChannels(pending: PendingApproval): Promise<void> {
    for (const channel of this.gateConfig.channels) {
      try {
        await this.notifyChannel(channel, pending);
        pending.notifiedChannels.push(channel);
      } catch (error) {
        this.log('error', `Failed to notify ${channel}: ${error}`);
      }
    }
  }

  private async notifyChannel(channel: ApprovalChannel, pending: PendingApproval): Promise<void> {
    const message = this.formatApprovalMessage(pending);

    switch (channel) {
      case 'cli':
        this.notifyCLI(pending, message);
        break;
      
      case 'webhook':
        await this.notifyWebhook(pending, message);
        break;
      
      case 'discord':
        await this.notifyDiscord(pending, message);
        break;
      
      case 'slack':
        await this.notifySlack(pending, message);
        break;
      
      case 'email':
        await this.notifyEmail(pending, message);
        break;
    }
  }

  private formatApprovalMessage(pending: PendingApproval): string {
    const riskEmoji = {
      low: '🟢',
      medium: '🟡',
      high: '🟠',
      critical: '🔴',
    };

    const lines = [
      `${riskEmoji[pending.risk]} APPROVAL REQUIRED [${pending.risk.toUpperCase()}]`,
      ``,
      `ID: ${pending.id}`,
      `Type: ${pending.type}`,
      ``,
      pending.summary,
      ``,
      `Expires: ${new Date(pending.expiresAt).toISOString()}`,
      ``,
      `To approve: POST /api/approvals/${pending.id}/approve`,
      `To deny: POST /api/approvals/${pending.id}/deny`,
    ];

    return lines.join('\n');
  }

  private notifyCLI(pending: PendingApproval, message: string): void {
    console.log('\n' + '═'.repeat(60));
    console.log(message);
    console.log('═'.repeat(60) + '\n');
  }

  private async notifyWebhook(pending: PendingApproval, message: string): Promise<void> {
    if (!this.gateConfig.webhookUrl) return;

    await fetch(this.gateConfig.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'approval_required',
        approval: pending,
        message,
      }),
    });
  }

  private async notifyDiscord(pending: PendingApproval, message: string): Promise<void> {
    if (!this.gateConfig.discordChannelId) return;

    // Emit event for Discord plugin to handle
    this.emit('discord:send_message', {
      channelId: this.gateConfig.discordChannelId,
      content: '```\n' + message + '\n```',
      embeds: [{
        title: `Approval Required: ${pending.id}`,
        color: pending.risk === 'critical' ? 0xff0000 : 
               pending.risk === 'high' ? 0xff8800 :
               pending.risk === 'medium' ? 0xffff00 : 0x00ff00,
        fields: [
          { name: 'Type', value: pending.type, inline: true },
          { name: 'Risk', value: pending.risk, inline: true },
        ],
      }],
    });
  }

  private async notifySlack(pending: PendingApproval, message: string): Promise<void> {
    if (!this.gateConfig.slackChannelId) return;

    // Emit event for Slack plugin to handle
    this.emit('slack:send_message', {
      channel: this.gateConfig.slackChannelId,
      text: message,
      blocks: [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `*Approval Required*\n${pending.summary}` },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Approve' },
              style: 'primary',
              action_id: `approve_${pending.id}`,
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Deny' },
              style: 'danger',
              action_id: `deny_${pending.id}`,
            },
          ],
        },
      ],
    });
  }

  private async notifyEmail(pending: PendingApproval, message: string): Promise<void> {
    if (!this.gateConfig.emailTo) return;

    // Emit event for email plugin to handle
    this.emit('email:send', {
      to: this.gateConfig.emailTo,
      subject: `[EverythingOS] Approval Required: ${pending.type} - ${pending.risk.toUpperCase()}`,
      body: message,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Summaries
  // ─────────────────────────────────────────────────────────────────────────

  private summarizeToolRequest(request: ToolApprovalRequest): string {
    return [
      `Tool: ${request.tool}`,
      `Agent: ${request.agentId}`,
      `Trust Level: ${request.trustLevel}`,
      `Input: ${JSON.stringify(request.input, null, 2)}`,
      `Reason: ${request.reason}`,
    ].join('\n');
  }

  private summarizeIntent(intent: Intent): string {
    return [
      `Intent: ${intent.type}:${intent.action}`,
      `Agent: ${intent.agentId}`,
      `Target: ${intent.target ?? 'none'}`,
      `Confidence: ${(intent.confidence * 100).toFixed(0)}%`,
      `Reasoning: ${intent.reasoning}`,
      `Payload: ${JSON.stringify(intent.payload, null, 2)}`,
    ].join('\n');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Decision Processing
  // ─────────────────────────────────────────────────────────────────────────

  private processDecision(decision: ApprovalDecision): void {
    const pending = this.pending.get(decision.approvalId);
    if (!pending) {
      this.log('warn', `No pending approval found for ${decision.approvalId}`);
      return;
    }

    if (decision.approved) {
      this.approve(decision.approvalId, decision.approvedBy, decision.reason);
    } else {
      this.deny(decision.approvalId, decision.approvedBy, decision.reason ?? 'Denied by user');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────

  approve(approvalId: string, approvedBy: string, reason?: string): boolean {
    const pending = this.pending.get(approvalId);
    if (!pending) return false;

    this.log('info', `Approved ${pending.type} ${approvalId} by ${approvedBy}`);

    // Record decision
    this.history.push({
      approvalId,
      approved: true,
      approvedBy,
      reason,
      timestamp: Date.now(),
    });

    // Execute approval
    if (pending.type === 'tool') {
      toolRegistry.approve(approvalId, approvedBy);
    } else {
      intentManager.approve(approvalId, approvedBy);
    }

    this.pending.delete(approvalId);
    this.emit('approval:approved', { approvalId, approvedBy, reason });

    return true;
  }

  deny(approvalId: string, deniedBy: string, reason: string): boolean {
    const pending = this.pending.get(approvalId);
    if (!pending) return false;

    this.log('info', `Denied ${pending.type} ${approvalId} by ${deniedBy}: ${reason}`);

    // Record decision
    this.history.push({
      approvalId,
      approved: false,
      approvedBy: deniedBy,
      reason,
      timestamp: Date.now(),
    });

    // Execute denial
    if (pending.type === 'tool') {
      toolRegistry.deny(approvalId, deniedBy, reason);
    } else {
      intentManager.deny(approvalId, deniedBy, reason);
    }

    this.pending.delete(approvalId);
    this.emit('approval:denied', { approvalId, deniedBy, reason });

    return true;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Query
  // ─────────────────────────────────────────────────────────────────────────

  getPending(): PendingApproval[] {
    return Array.from(this.pending.values());
  }

  getPendingByRisk(risk: PendingApproval['risk']): PendingApproval[] {
    return this.getPending().filter(p => p.risk === risk);
  }

  getHistory(limit = 100): ApprovalDecision[] {
    return this.history.slice(-limit);
  }

  getStats(): {
    pending: number;
    approved: number;
    denied: number;
    byRisk: Record<string, number>;
  } {
    const approved = this.history.filter(h => h.approved).length;
    const denied = this.history.filter(h => !h.approved).length;
    
    const byRisk: Record<string, number> = {};
    for (const p of this.pending.values()) {
      byRisk[p.risk] = (byRisk[p.risk] || 0) + 1;
    }

    return {
      pending: this.pending.size,
      approved,
      denied,
      byRisk,
    };
  }
}

// Export singleton factory
export function createApprovalGate(config?: Partial<ApprovalGateConfig>): ApprovalGateAgent {
  return new ApprovalGateAgent(config);
}
