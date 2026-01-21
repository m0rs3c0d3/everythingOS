// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHINGOS - Social Reply Workflow
// Automated social media reply workflow
// ═══════════════════════════════════════════════════════════════════════════════

import { WorkflowDefinition } from '../core/workflow/WorkflowTypes';

export const socialReplyWorkflow: WorkflowDefinition = {
  id: 'social-reply',
  name: 'Social Reply Workflow',
  description: 'Automatically respond to social media messages',
  version: 1,
  status: 'active',

  nodes: [
    {
      id: 'trigger',
      type: 'trigger',
      name: 'Message Received',
      config: {},
    },
    {
      id: 'filter',
      type: 'condition',
      name: 'Should Process?',
      config: {
        field: 'message.author.bot',
        operator: 'eq',
        value: false,
      },
    },
    {
      id: 'analyze',
      type: 'agent',
      name: 'Analyze Message',
      plugin: 'agents',
      action: 'perception:analyze',
      config: {
        extractEntities: true,
        detectSentiment: true,
      },
    },
    {
      id: 'decide',
      type: 'agent',
      name: 'Decision Agent',
      plugin: 'agents',
      action: 'decision:conversation',
      config: {
        personality: 'helpful and friendly',
        replyProbability: 0.8,
      },
    },
    {
      id: 'should_reply',
      type: 'condition',
      name: 'Should Reply?',
      config: {
        field: 'decision.shouldReply',
        operator: 'eq',
        value: true,
      },
    },
    {
      id: 'delay',
      type: 'delay',
      name: 'Natural Delay',
      config: {
        seconds: 2,
        jitter: 1,
      },
    },
    {
      id: 'send',
      type: 'action',
      name: 'Send Reply',
      plugin: 'discord',
      action: 'send_message',
      config: {},
    },
    {
      id: 'log',
      type: 'action',
      name: 'Log Interaction',
      plugin: 'logging',
      action: 'log',
      config: {
        level: 'info',
      },
    },
  ],

  edges: [
    { id: 'e1', from: 'trigger', to: 'filter' },
    { id: 'e2', from: 'filter', to: 'analyze', condition: 'true' },
    { id: 'e3', from: 'analyze', to: 'decide' },
    { id: 'e4', from: 'decide', to: 'should_reply' },
    { id: 'e5', from: 'should_reply', to: 'delay', condition: 'true' },
    { id: 'e6', from: 'delay', to: 'send' },
    { id: 'e7', from: 'send', to: 'log' },
    { id: 'e8', from: 'should_reply', to: 'log', condition: 'false' },
  ],

  triggers: [
    {
      id: 'discord-message',
      type: 'event',
      config: {
        pattern: 'discord:message:create',
      },
      enabled: true,
    },
    {
      id: 'slack-message',
      type: 'event',
      config: {
        pattern: 'slack:message',
      },
      enabled: true,
    },
  ],

  variables: {
    maxReplyLength: 500,
    cooldownMs: 5000,
  },

  metadata: {
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tags: ['social', 'automation', 'reply'],
  },
};

export default socialReplyWorkflow;
