const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { TestOrchestrator, loadReport, getReportHistory } = require('./orchestrator');

const app = express();
const server = http.createServer(app);

// WebSocket server
const wss = new WebSocketServer({ server });

// Store active sessions
const sessions = new Map();

app.use(cors());
app.use(express.json());

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
}

// Serve screenshots
app.use('/screenshots', express.static(path.join(__dirname, '../screenshots')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start test run
app.post('/api/test/run', async (req, res) => {
  const { url, tests, options } = req.body;

  if (!url || !tests || tests.length === 0) {
    return res.status(400).json({ error: 'URL and tests are required' });
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
