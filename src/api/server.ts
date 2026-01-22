// ═══════════════════════════════════════════════════════════════════════════════
// EVERYTHINGOS - API Server
// REST API for external control
// ═══════════════════════════════════════════════════════════════════════════════

import { eventBus } from '../core/event-bus/EventBus';
import { workflowRegistry } from '../core/workflow/WorkflowRegistry';
import { agentRegistry } from '../core/registry/AgentRegistry';
import { pluginRegistry } from '../core/registry/PluginRegistry';
import { worldState } from '../core/state/WorldState';

// Simple HTTP server without Express dependency for now
import { createServer, IncomingMessage, ServerResponse } from 'http';

const PORT = process.env.PORT || 3000;

// ─────────────────────────────────────────────────────────────────────────────
// Request Handling
// ─────────────────────────────────────────────────────────────────────────────

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const path = url.pathname;
  const method = req.method || 'GET';

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    const body = await parseBody(req);
    const result = await route(method, path, body, url.searchParams);
    
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(result.status);
    res.end(JSON.stringify(result.data));
  } catch (error) {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(500);
    res.end(JSON.stringify({ error: String(error) }));
  }
}

async function parseBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Routing
// ─────────────────────────────────────────────────────────────────────────────

async function route(
  method: string,
  path: string,
  body: unknown,
  params: URLSearchParams
): Promise<{ status: number; data: unknown }> {
  
  // Health check
  if (path === '/health' || path === '/api/health') {
    return { status: 200, data: { status: 'ok', timestamp: Date.now() } };
  }

  // Workflows
  if (path === '/api/workflows') {
    if (method === 'GET') {
      return { status: 200, data: workflowRegistry.list() };
    }
    if (method === 'POST') {
      workflowRegistry.register(body as Parameters<typeof workflowRegistry.register>[0]);
      return { status: 201, data: { success: true } };
    }
  }

  if (path.startsWith('/api/workflows/')) {
    const id = path.split('/')[3];
    
    if (method === 'GET') {
      const workflow = workflowRegistry.get(id);
      return workflow ? { status: 200, data: workflow } : { status: 404, data: { error: 'Not found' } };
    }
    
    if (method === 'POST' && path.endsWith('/execute')) {
      const workflowId = path.split('/')[3];
      const execution = await workflowRegistry.execute(workflowId, body as Record<string, unknown>);
      return { status: 200, data: execution };
    }
    
    if (method === 'DELETE') {
      const deleted = workflowRegistry.unregister(id);
      return { status: deleted ? 200 : 404, data: { success: deleted } };
    }
  }

  // Agents
  if (path === '/api/agents') {
    return { status: 200, data: agentRegistry.getAll().map(a => ({ id: a.id, config: a.config, status: a.status })) };
  }

  if (path.startsWith('/api/agents/')) {
    const id = path.split('/')[3];
    const action = path.split('/')[4];
    
    if (action === 'start') {
      await agentRegistry.startAgent(id);
      return { status: 200, data: { success: true } };
    }
    
    if (action === 'stop') {
      await agentRegistry.stopAgent(id);
      return { status: 200, data: { success: true } };
    }
  }

  // Plugins
  if (path === '/api/plugins') {
    return { status: 200, data: pluginRegistry.getAll().map(p => ({ id: p.id, name: p.name, version: p.version })) };
  }

  if (path === '/api/plugins/actions') {
    return { status: 200, data: pluginRegistry.getAllActions() };
  }

  if (path.startsWith('/api/plugins/') && path.includes('/execute')) {
    const parts = path.split('/');
    const pluginId = parts[3];
    const actionName = parts[5];
    const result = await pluginRegistry.execute(pluginId, actionName, body);
    return { status: 200, data: result };
  }

  // Events
  if (path === '/api/events' && method === 'POST') {
    const { type, payload } = body as { type: string; payload: unknown };
    eventBus.emit(type, payload);
    return { status: 200, data: { success: true } };
  }

  if (path === '/api/events/history') {
    const limit = parseInt(params.get('limit') || '100');
    return { status: 200, data: eventBus.getHistory({ limit }) };
  }

  // Approvals
  if (path === '/api/approvals' && method === 'GET') {
    // Get pending approvals - emit request and collect from approval gate
    const pending = agentRegistry.get('approval-gate');
    if (pending && 'getPending' in pending) {
      return { status: 200, data: (pending as { getPending: () => unknown[] }).getPending() };
    }
    return { status: 200, data: [] };
  }

  if (path.startsWith('/api/approvals/') && path.endsWith('/approve') && method === 'POST') {
    const approvalId = path.split('/')[3];
    const { approvedBy, reason } = body as { approvedBy?: string; reason?: string };
    
    eventBus.emit('approval:decision', {
      approvalId,
      approved: true,
      approvedBy: approvedBy || 'api',
      reason,
      timestamp: Date.now(),
    });
    
    return { status: 200, data: { success: true, approvalId, action: 'approved' } };
  }

  if (path.startsWith('/api/approvals/') && path.endsWith('/deny') && method === 'POST') {
    const approvalId = path.split('/')[3];
    const { deniedBy, reason } = body as { deniedBy?: string; reason?: string };
    
    eventBus.emit('approval:decision', {
      approvalId,
      approved: false,
      approvedBy: deniedBy || 'api',
      reason: reason || 'Denied via API',
      timestamp: Date.now(),
    });
    
    return { status: 200, data: { success: true, approvalId, action: 'denied' } };
  }

  // State
  if (path === '/api/state') {
    return { status: 200, data: worldState.export() };
  }

  // 404
  return { status: 404, data: { error: 'Not found' } };
}

// ─────────────────────────────────────────────────────────────────────────────
// Server
// ─────────────────────────────────────────────────────────────────────────────

export function startServer(port = PORT): void {
  const server = createServer(handleRequest);
  
  server.listen(port, () => {
    console.log(`🚀 EverythingOS API running on http://localhost:${port}`);
    console.log('');
    console.log('Endpoints:');
    console.log('  GET  /health                      - Health check');
    console.log('  GET  /api/workflows               - List workflows');
    console.log('  POST /api/workflows               - Create workflow');
    console.log('  POST /api/workflows/:id/execute   - Execute workflow');
    console.log('  GET  /api/agents                  - List agents');
    console.log('  POST /api/agents/:id/start        - Start agent');
    console.log('  POST /api/agents/:id/stop         - Stop agent');
    console.log('  GET  /api/plugins                 - List plugins');
    console.log('  POST /api/events                  - Emit event');
    console.log('  GET  /api/state                   - Get world state');
    console.log('  GET  /api/approvals               - List pending approvals');
    console.log('  POST /api/approvals/:id/approve   - Approve request');
    console.log('  POST /api/approvals/:id/deny      - Deny request');
  });

  eventBus.emit('api:started', { port });
}

// Start if run directly
if (require.main === module) {
  startServer();
}
