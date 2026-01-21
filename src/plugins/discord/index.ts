// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHINGOS - Discord Plugin
// Discord bot integration
// ═══════════════════════════════════════════════════════════════════════════════

import { PluginConfig, PluginContext } from '../../core/registry/PluginRegistry';
import { eventBus } from '../../core/event-bus/EventBus';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface DiscordConfig {
  botToken: string;
  applicationId?: string;
  guildId?: string;
}

export interface DiscordMessage {
  id: string;
  channelId: string;
  guildId?: string;
  author: { id: string; username: string; bot: boolean };
  content: string;
  timestamp: string;
  attachments?: Array<{ url: string; filename: string }>;
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text: string };
  timestamp?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Discord Client (Skeleton)
// ─────────────────────────────────────────────────────────────────────────────

class DiscordClient {
  private token: string;
  private ws: WebSocket | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private seq: number | null = null;
  private sessionId: string | null = null;

  constructor(token: string) {
    this.token = token;
  }

  async connect(): Promise<void> {
    // TODO: Implement Gateway connection
    // 1. GET /gateway/bot for WSS URL
    // 2. Connect WebSocket
    // 3. Handle HELLO, send IDENTIFY
    // 4. Start heartbeat
    throw new Error('Not implemented - add ws package');
  }

  disconnect(): void {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.ws?.close();
    this.ws = null;
  }

  async sendMessage(channelId: string, content: string, embeds?: DiscordEmbed[]): Promise<DiscordMessage> {
    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bot ${this.token}`,
      },
      body: JSON.stringify({ content, embeds }),
    });

    if (!response.ok) {
      throw new Error(`Discord API error: ${response.status}`);
    }

    return response.json();
  }

  async editMessage(channelId: string, messageId: string, content: string, embeds?: DiscordEmbed[]): Promise<void> {
    await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bot ${this.token}`,
      },
      body: JSON.stringify({ content, embeds }),
    });
  }

  async deleteMessage(channelId: string, messageId: string): Promise<void> {
    await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bot ${this.token}` },
    });
  }

  async addReaction(channelId: string, messageId: string, emoji: string): Promise<void> {
    await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`,
      {
        method: 'PUT',
        headers: { 'Authorization': `Bot ${this.token}` },
      }
    );
  }

  async getChannel(channelId: string): Promise<unknown> {
    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}`, {
      headers: { 'Authorization': `Bot ${this.token}` },
    });
    return response.json();
  }

  async getGuild(guildId: string): Promise<unknown> {
    const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}`, {
      headers: { 'Authorization': `Bot ${this.token}` },
    });
    return response.json();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Plugin Definition
// ─────────────────────────────────────────────────────────────────────────────

let client: DiscordClient | null = null;

export const discordPlugin: PluginConfig = {
  id: 'discord',
  name: 'Discord',
  version: '1.0.0',
  description: 'Discord bot integration for EverythingOS',

  actions: [
    {
      name: 'send_message',
      description: 'Send a message to a Discord channel',
      schema: {
        type: 'object',
        properties: {
          channelId: { type: 'string' },
          content: { type: 'string' },
          embeds: { type: 'array' },
        },
        required: ['channelId', 'content'],
      },
      handler: async (input) => {
        const { channelId, content, embeds } = input as { channelId: string; content: string; embeds?: DiscordEmbed[] };
        if (!client) throw new Error('Discord client not initialized');
        return client.sendMessage(channelId, content, embeds);
      },
    },

    {
      name: 'edit_message',
      description: 'Edit an existing message',
      schema: {
        type: 'object',
        properties: {
          channelId: { type: 'string' },
          messageId: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['channelId', 'messageId', 'content'],
      },
      handler: async (input) => {
        const { channelId, messageId, content, embeds } = input as { channelId: string; messageId: string; content: string; embeds?: DiscordEmbed[] };
        if (!client) throw new Error('Discord client not initialized');
        await client.editMessage(channelId, messageId, content, embeds);
        return { success: true };
      },
    },

    {
      name: 'delete_message',
      description: 'Delete a message',
      schema: {
        type: 'object',
        properties: {
          channelId: { type: 'string' },
          messageId: { type: 'string' },
        },
        required: ['channelId', 'messageId'],
      },
      handler: async (input) => {
        const { channelId, messageId } = input as { channelId: string; messageId: string };
        if (!client) throw new Error('Discord client not initialized');
        await client.deleteMessage(channelId, messageId);
        return { success: true };
      },
    },

    {
      name: 'add_reaction',
      description: 'Add a reaction to a message',
      schema: {
        type: 'object',
        properties: {
          channelId: { type: 'string' },
          messageId: { type: 'string' },
          emoji: { type: 'string' },
        },
        required: ['channelId', 'messageId', 'emoji'],
      },
      handler: async (input) => {
        const { channelId, messageId, emoji } = input as { channelId: string; messageId: string; emoji: string };
        if (!client) throw new Error('Discord client not initialized');
        await client.addReaction(channelId, messageId, emoji);
        return { success: true };
      },
    },
  ],

  initialize: async (context) => {
    const token = context.getConfig<string>('botToken') || process.env.DISCORD_BOT_TOKEN;
    if (!token) {
      console.warn('Discord: No bot token configured');
      return;
    }

    client = new DiscordClient(token);
    
    // Don't auto-connect - let user call connect action
    context.emit('initialized', { status: 'ready' });
  },

  shutdown: async () => {
    client?.disconnect();
    client = null;
  },
};

export default discordPlugin;
