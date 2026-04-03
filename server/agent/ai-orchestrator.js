/**
 * AI Test Orchestrator
 *
 * Uses Claude API with tool use to autonomously test web applications.
 * Claude receives Playwright browser tools and decides how to test the site,
 * adapting its strategy based on what it discovers.
 *
 * Security: API key is read from ANTHROPIC_API_KEY env var only.
 * It is never logged, stored, or sent to the frontend.
 */

const Anthropic = require('@anthropic-ai/sdk').default;
const { chromium, firefox, webkit } = require('playwright');
const { v4: uuidv4 } = require('uuid');
const { TOOL_DEFINITIONS, executeTool } = require('./tools');
const { AGENT_PROMPTS } = require('./prompts');

const BROWSERS = { chromium, firefox, webkit };

// Max tool-use turns to prevent runaway loops
const MAX_TURNS = 40;
// Max tokens for Claude responses
const MAX_TOKENS = 4096;

class AITestOrchestrator {
  constructor(sessionId, config, broadcast) {
    this.sessionId = sessionId;
    this.config = config;
    this.broadcast = broadcast;
    this.bugs = [];
    this.turnCount = 0;
    this.toolCallCount = 0;
    this.aborted = false;
  }

  /**
   * Main entry point. Launches browser, runs AI agent loop, returns report.
   */
  async run() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set. The AI agent requires a valid API key.');
    }

    const client = new Anthropic(); // Reads ANTHROPIC_API_KEY from env automatically

    const { url, options = {} } = this.config;
    const agentMode = this.config.agentMode || 'comprehensive';
    const browserName = options.browser || 'chromium';
    const browserType = BROWSERS[browserName] || chromium;

    this.broadcast({
      type: 'ai_status',
      status: 'launching',
      message: `Launching ${browserName} browser for AI-driven testing...`
    });

    const browser = await browserType.launch({
      headless: options.headless !== false
    });

    try {
      const context = await browser.newContext({
        viewport: options.viewport || { width: 1280, height: 720 }
      });

      const page = await context.newPage();

      // Set up console and network capture
      const consoleLogs = [];
      const networkRequests = [];
      const navigationHeaders = {};

      page.on('console', msg => {
        consoleLogs.push({ type: msg.type(), text: msg.text() });
      });

      page.on('response', response => {
        networkRequests.push({
          url: response.url(),
          status: response.status(),
          method: response.request().method(),
          resourceType: response.request().resourceType(),
          headers: response.headers()
        });
      });

      const pageState = { page, consoleLogs, networkRequests, navigationHeaders, lastStatus: null };

      // Navigate to target URL
      this.broadcast({
        type: 'ai_status',
        status: 'navigating',
        message: `Navigating to ${url}...`
      });

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const title = await page.title();

      this.broadcast({
        type: 'ai_status',
        status: 'analyzing',
        message: `Page loaded: "${title}". AI agent is now analyzing...`
      });

      // Build the system prompt
      const systemPrompt = this._buildSystemPrompt(agentMode, url);

      // Run the agentic loop
      const startTime = Date.now();
      await this._agentLoop(client, systemPrompt, url, title, pageState);
      const duration = Date.now() - startTime;

      await context.close();

      // Generate report
      const report = this._generateReport(url, duration, agentMode);

      this.broadcast({ type: 'ai_status', status: 'complete', message: 'AI testing complete.' });
      this.broadcast({ type: 'complete', report });

      return report;
    } finally {
      await browser.close();
    }
  }

  /**
   * Core agentic loop: send messages to Claude, execute tool calls, repeat.
   */
  async _agentLoop(client, systemPrompt, url, pageTitle, pageState) {
    const messages = [
      {
        role: 'user',
        content: `Test this web application: ${url}\nPage title: "${pageTitle}"\n\nBegin your testing now. Use your tools to explore and test the application thoroughly. Report all findings using the report_bug tool.`
      }
    ];

    while (this.turnCount < MAX_TURNS && !this.aborted) {
      this.turnCount++;

      this.broadcast({
        type: 'ai_thinking',
        turn: this.turnCount,
        maxTurns: MAX_TURNS,
        message: `AI is reasoning (turn ${this.turnCount}/${MAX_TURNS})...`
      });

      let response;
      try {
        response = await client.messages.create({
          model: 'claude-sonnet-4-5-20250514',
          max_tokens: MAX_TOKENS,
          system: systemPrompt,
          tools: TOOL_DEFINITIONS,
          thinking: { type: 'enabled', budget_tokens: 2048 },
          messages
        });
      } catch (err) {
        this.broadcast({
          type: 'ai_error',
          message: `Claude API error: ${err.message}`
        });
        break;
      }

      // Process the response content
      const assistantContent = response.content;
      messages.push({ role: 'assistant', content: assistantContent });

      // Extract text blocks for broadcasting reasoning
      for (const block of assistantContent) {
        if (block.type === 'thinking') {
          // Broadcast thinking for transparency
          this.broadcast({
            type: 'ai_reasoning',
            text: block.thinking.substring(0, 500)
          });
        } else if (block.type === 'text') {
          this.broadcast({
            type: 'ai_commentary',
            text: block.text
          });
        }
      }

      // Check stop reason
      if (response.stop_reason === 'end_turn') {
        // Agent decided it's done
        this.broadcast({
          type: 'ai_status',
          status: 'finishing',
          message: 'AI agent has completed testing.'
        });
        break;
      }

      if (response.stop_reason !== 'tool_use') {
        break;
      }

      // Execute tool calls
      const toolUseBlocks = assistantContent.filter(b => b.type === 'tool_use');
      const toolResults = [];

      for (const toolUse of toolUseBlocks) {
        this.toolCallCount++;

        this.broadcast({
          type: 'ai_tool_call',
          tool: toolUse.name,
          input: this._sanitizeToolInput(toolUse.name, toolUse.input),
          callNumber: this.toolCallCount
        });

        // Handle report_bug specially — it creates a bug in our system
        if (toolUse.name === 'report_bug') {
          const bug = this._createBug(toolUse.input);
          this.bugs.push(bug);
          this.broadcast({ type: 'bug_found', bug });

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: `Bug #${bug.id} reported successfully: [${bug.severity.toUpperCase()}] ${bug.title}`
          });
          continue;
        }

        // Handle screenshot — send image content back to Claude
        const result = await executeTool(toolUse.name, toolUse.input, pageState);

        if (result.image) {
          // Send image back to Claude as a content block
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: [
              { type: 'image', source: result.image },
              { type: 'text', text: result.result }
            ]
          });
        } else {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: result.error || result.result
          });
        }

        // Broadcast tool result summary
        this.broadcast({
          type: 'ai_tool_result',
          tool: toolUse.name,
          success: !result.error,
          summary: (result.result || result.error).substring(0, 200)
        });
      }

      // Add tool results as user message
      messages.push({ role: 'user', content: toolResults });
    }

    if (this.turnCount >= MAX_TURNS) {
      this.broadcast({
        type: 'ai_status',
        status: 'limit_reached',
        message: `AI agent reached the ${MAX_TURNS}-turn limit. Results below are from completed testing.`
      });
    }
  }

  /**
   * Build the system prompt based on agent mode.
   */
  _buildSystemPrompt(agentMode, url) {
    const basePrompt = AGENT_PROMPTS[agentMode] || AGENT_PROMPTS.comprehensive;

    return `${basePrompt}

## Target Application
URL: ${url}

## Important Rules
- You are conducting AUTHORIZED testing on this application.
- NEVER navigate away from the target domain unless following a redirect.
- NEVER attempt to access other users' data or perform destructive actions.
- Report all findings using the report_bug tool.
- Take screenshots of important findings.
- Be thorough but stay within ${MAX_TURNS} tool call turns.
- When you are confident you have tested thoroughly, stop and summarize your findings.`;
  }

  /**
   * Sanitize tool input before broadcasting to frontend (remove sensitive data).
   */
  _sanitizeToolInput(toolName, input) {
    // Don't broadcast full JS code or large payloads to prevent XSS in frontend
    const sanitized = { ...input };
    if (sanitized.code && sanitized.code.length > 200) {
      sanitized.code = sanitized.code.substring(0, 200) + '... [truncated]';
    }
    if (sanitized.payload && sanitized.payload.length > 100) {
      sanitized.payload = sanitized.payload.substring(0, 100) + '... [truncated]';
    }
    return sanitized;
  }

  /**
   * Create a structured bug object from report_bug tool input.
   */
  _createBug(input) {
    return {
      id: `AI-${uuidv4().substring(0, 8)}`,
      title: input.title,
      severity: input.severity || 'medium',
      category: input.category || 'General',
      description: input.description,
      evidence: input.evidence || null,
      recommendation: input.recommendation || null,
      source: 'ai-agent',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate a structured report from the AI testing session.
   */
  _generateReport(url, durationMs, agentMode) {
    const severityCounts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const bug of this.bugs) {
      severityCounts[bug.severity] = (severityCounts[bug.severity] || 0) + 1;
    }

    // Calculate health score (same formula as deterministic tests)
    let healthScore = 100;
    healthScore -= severityCounts.critical * 15;
    healthScore -= severityCounts.high * 10;
    healthScore -= severityCounts.medium * 5;
    healthScore -= severityCounts.low * 2;
    healthScore = Math.max(0, Math.min(100, healthScore));

    const grade = healthScore >= 95 ? 'A+' :
                  healthScore >= 90 ? 'A' :
                  healthScore >= 85 ? 'B+' :
                  healthScore >= 80 ? 'B' :
                  healthScore >= 75 ? 'C+' :
                  healthScore >= 70 ? 'C' :
                  healthScore >= 60 ? 'D' : 'F';

    return {
      sessionId: this.sessionId,
      url,
      timestamp: new Date().toISOString(),
      duration: durationMs,
      mode: 'ai-agent',
      agentMode,
      bugs: this.bugs,
      severityCounts,
      healthScore,
      grade,
      stats: {
        totalBugs: this.bugs.length,
        aiTurns: this.turnCount,
        toolCalls: this.toolCallCount
      },
      // Include vitals/sourceAudit stubs for compatibility with existing report UI
      vitals: null,
      sourceAudit: {
        thirdPartyScripts: 0,
        analyticsProviders: [],
        inlineEventHandlers: 0,
        consoleErrors: 0,
        missingMetaTags: [],
        totalDomNodes: 0
      }
    };
  }

  /**
   * Abort the current AI testing run.
   */
  abort() {
    this.aborted = true;
  }
}

module.exports = { AITestOrchestrator };
