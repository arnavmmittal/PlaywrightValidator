require('dotenv').config();
const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { TestOrchestrator, loadReport, getReportHistory, compareReports } = require('./orchestrator');
const { AITestOrchestrator } = require('./agent/ai-orchestrator');
const leaderboardRouter = require('./routes/leaderboard');
const { rateLimitMiddleware } = require('./middleware/rate-limit');

const app = express();
const server = http.createServer(app);

// WebSocket server
const wss = new WebSocketServer({ server });

// Store active sessions with TTL-based cleanup
const sessions = new Map();

const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

// Periodically clean up expired sessions
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of sessions) {
    const createdAt = new Date(session.createdAt).getTime();
    if (now - createdAt > SESSION_TTL_MS) {
      sessions.delete(sessionId);
    }
  }
}, CLEANUP_INTERVAL_MS);

// Prevent the interval from keeping the process alive
if (cleanupInterval.unref) {
  cleanupInterval.unref();
}

app.use(cors(
  process.env.NODE_ENV === 'production'
    ? { origin: process.env.ALLOWED_ORIGINS?.split(',') || true }
    : {}
));
app.use(express.json({ limit: '1mb' }));

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
}

// Serve screenshots
app.use('/screenshots', express.static(path.join(__dirname, '../screenshots')));

// Leaderboard API (broadcastToSession is set after its definition below)
app.use('/api/leaderboard', leaderboardRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start test run
app.post('/api/test/run', rateLimitMiddleware('test'), async (req, res) => {
  const { url, tests, options } = req.body;

  if (!url || !tests || tests.length === 0) {
    return res.status(400).json({ error: 'URL and tests are required' });
  }

  // Validate browser option if provided
  const validBrowsers = ['chromium', 'firefox', 'webkit'];
  if (options?.browser && !validBrowsers.includes(options.browser)) {
    return res.status(400).json({
      error: `Invalid browser. Must be one of: ${validBrowsers.join(', ')}`
    });
  }

  // Validate retries option if provided
  if (options?.retries !== undefined) {
    const retries = Number(options.retries);
    if (!Number.isInteger(retries) || retries < 0) {
      return res.status(400).json({ error: 'retries must be a non-negative integer' });
    }
  }

  const sessionId = uuidv4();

  sessions.set(sessionId, {
    url,
    tests,
    options,
    status: 'running',
    report: null,
    createdAt: new Date().toISOString()
  });

  res.json({ sessionId });

  // Start test execution asynchronously
  setImmediate(async () => {
    const orchestrator = new TestOrchestrator(
      sessionId,
      { url, tests, options: options || {} },
      (msg) => broadcastToSession(sessionId, msg)
    );

    try {
      const report = await orchestrator.run();
      const session = sessions.get(sessionId);
      if (session) {
        session.status = 'complete';
        session.report = report;
      }
    } catch (error) {
      console.error('Test run error:', error);
      broadcastToSession(sessionId, {
        type: 'error',
        message: error.message
      });
      const session = sessions.get(sessionId);
      if (session) {
        session.status = 'error';
      }
    }
  });
});

// Check if AI testing is available (API key configured)
app.get('/api/ai/status', (req, res) => {
  const hasKey = !!process.env.ANTHROPIC_API_KEY;
  res.json({
    available: hasKey,
    message: hasKey
      ? 'AI-powered testing is available.'
      : 'Set the ANTHROPIC_API_KEY environment variable to enable AI-powered testing.'
  });
});

// Start AI-powered test run
app.post('/api/test/ai-run', rateLimitMiddleware('ai-test'), async (req, res) => {
  const { url, agentMode, aiModel, options } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({
      error: 'AI testing unavailable. Set the ANTHROPIC_API_KEY environment variable on the server.'
    });
  }

  const validModes = ['comprehensive', 'security', 'performance', 'accessibility', 'exploratory', 'planner'];
  const mode = validModes.includes(agentMode) ? agentMode : 'comprehensive';

  // Validate browser option
  const validBrowsers = ['chromium', 'firefox', 'webkit'];
  if (options?.browser && !validBrowsers.includes(options.browser)) {
    return res.status(400).json({
      error: `Invalid browser. Must be one of: ${validBrowsers.join(', ')}`
    });
  }

  const sessionId = uuidv4();

  sessions.set(sessionId, {
    url,
    mode: 'ai-agent',
    agentMode: mode,
    options,
    status: 'running',
    report: null,
    createdAt: new Date().toISOString()
  });

  res.json({ sessionId });

  // Start AI test execution asynchronously
  setImmediate(async () => {
    const orchestrator = new AITestOrchestrator(
      sessionId,
      { url, agentMode: mode, aiModel: aiModel || 'haiku', options: options || {} },
      (msg) => broadcastToSession(sessionId, msg)
    );

    // Store orchestrator ref for abort capability
    const session = sessions.get(sessionId);
    if (session) session._orchestrator = orchestrator;

    try {
      const report = await orchestrator.run();
      const sess = sessions.get(sessionId);
      if (sess) {
        sess.status = 'complete';
        sess.report = report;
        delete sess._orchestrator;
      }
    } catch (error) {
      console.error('AI test run error:', error);
      broadcastToSession(sessionId, {
        type: 'ai_error',
        message: error.message
      });
      broadcastToSession(sessionId, {
        type: 'error',
        message: error.message
      });
      const sess = sessions.get(sessionId);
      if (sess) {
        sess.status = 'error';
        delete sess._orchestrator;
      }
    }
  });
});

// Abort an AI test run
app.post('/api/test/ai-abort/:sessionId', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  if (session._orchestrator) {
    session._orchestrator.abort();
    res.json({ status: 'aborting' });
  } else {
    res.json({ status: 'not_running' });
  }
});

// Compare two reports
app.post('/api/reports/compare', (req, res) => {
  const { sessionIdA, sessionIdB } = req.body;

  if (!sessionIdA || !sessionIdB) {
    return res.status(400).json({ error: 'sessionIdA and sessionIdB are required' });
  }

  // Load report A
  let reportA = sessions.get(sessionIdA)?.report || loadReport(sessionIdA);
  if (!reportA) {
    return res.status(404).json({ error: `Report not found: ${sessionIdA}` });
  }

  // Load report B
  let reportB = sessions.get(sessionIdB)?.report || loadReport(sessionIdB);
  if (!reportB) {
    return res.status(404).json({ error: `Report not found: ${sessionIdB}` });
  }

  const comparison = compareReports(reportA, reportB);
  res.json(comparison);
});

// Get report history
app.get('/api/reports/history', (req, res) => {
  const history = getReportHistory();
  res.json(history);
});

// Get report (from memory or disk)
app.get('/api/report/:sessionId', (req, res) => {
  const { sessionId } = req.params;

  // Check memory first
  const session = sessions.get(sessionId);
  if (session) {
    if (!session.report) {
      return res.json({ status: session.status });
    }
    return res.json(session.report);
  }

  // Check disk
  const savedReport = loadReport(sessionId);
  if (savedReport) {
    return res.json(savedReport);
  }

  return res.status(404).json({ error: 'Report not found' });
});

// Get report as PDF
app.get('/api/report/:sessionId/pdf', async (req, res) => {
  const { sessionId } = req.params;

  // Check memory first
  let report = sessions.get(sessionId)?.report;

  // Check disk if not in memory
  if (!report) {
    report = loadReport(sessionId);
  }

  if (!report) {
    return res.status(404).json({ error: 'Report not found' });
  }

  try {
    const { generatePDF } = require('./reporters/pdf-reporter');
    const pdfBuffer = await generatePDF(report);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="qa-report-${req.params.sessionId}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  const sessionId = req.url.replace('/ws/', '');
  console.log(`WebSocket connected for session: ${sessionId}`);

  ws.sessionId = sessionId;
  ws.send(JSON.stringify({ type: 'connected', sessionId }));

  ws.on('close', () => {
    console.log(`WebSocket disconnected for session: ${sessionId}`);
  });

  ws.on('error', (error) => {
    console.error(`WebSocket error for session ${sessionId}:`, error);
  });
});

// Broadcast to session
function broadcastToSession(sessionId, message) {
  wss.clients.forEach(client => {
    if (client.sessionId === sessionId && client.readyState === 1) {
      client.send(JSON.stringify(message));
    }
  });
}

// Make broadcastToSession available to routers (after function definition)
app.set('broadcastToSession', broadcastToSession);

// Catch-all for SPA in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`WebSocket available at ws://localhost:${PORT}/ws`);
});

module.exports = { app, server, sessions, broadcastToSession };
