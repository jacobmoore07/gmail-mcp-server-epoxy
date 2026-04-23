import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import { tools, handleTool } from './src/tools/index.js';

let StreamableHTTPServerTransport = null;
try {
  const mod = await import('@modelcontextprotocol/sdk/server/streamableHttp.js');
  StreamableHTTPServerTransport = mod.StreamableHTTPServerTransport;
} catch { /* SSE-only fallback */ }

function createServer() {
  const server = new Server(
    { name: 'gmail-mcp-server', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      const result = await handleTool(name, args);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  });

  return server;
}

function authMiddleware(req, res, next) {
  const requiredKey = process.env.MCP_API_KEY;
  if (!requiredKey) return next();
  const auth = req.headers.authorization;
  if (auth === `Bearer ${requiredKey}`) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

async function startHttp() {
  const app = express();
  app.use(express.json());

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  app.get('/health', (_req, res) =>
    res.json({ status: 'ok', tools: tools.length }),
  );

  if (StreamableHTTPServerTransport) {
    app.post('/mcp', authMiddleware, async (req, res) => {
      const server = createServer();
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      await server.close();
    });
  }

  const sseTransports = new Map();

  app.get('/sse', authMiddleware, async (req, res) => {
    const server = createServer();
    const transport = new SSEServerTransport('/messages', res);
    sseTransports.set(transport.sessionId, { transport, server });
    res.on('close', () => sseTransports.delete(transport.sessionId));
    await server.connect(transport);
  });

  app.post('/messages', authMiddleware, async (req, res) => {
    const sessionId = req.query.sessionId;
    const entry = sseTransports.get(sessionId);
    if (!entry) return res.status(404).json({ error: 'Session not found' });
    await entry.transport.handlePostMessage(req, res);
  });

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Gmail MCP Server running on port ${port}`);
    console.log(`StreamableHTTP: http://localhost:${port}/mcp`);
    console.log(`SSE (legacy):   http://localhost:${port}/sse`);
    console.log(`Health:         http://localhost:${port}/health`);
    console.log(`Auth:           ${process.env.MCP_API_KEY ? 'enabled' : 'disabled'}`);
    console.log(`Tools:          ${tools.length}`);
  });
}

async function startStdio() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

const mode = process.env.MCP_TRANSPORT || 'http';
if (mode === 'stdio') {
  startStdio().catch(console.error);
} else {
  startHttp().catch(console.error);
}
