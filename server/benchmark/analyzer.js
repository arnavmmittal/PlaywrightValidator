/**
 * Benchmark Analyzer
 *
 * Thin wrapper that feeds a CollectionResult to the constrained AI agent.
 * The AI receives pre-collected data and reasons about it — it does NOT browse.
 *
 * Tool restrictions:
 * - Available: screenshot (follow-up), evaluate_js (follow-up), report_findings (required)
 * - Max 5 turns, max 3 follow-up tool calls
 */

const Anthropic = require('@anthropic-ai/sdk').default;
const { TOOL_DEFINITIONS, executeTool } = require('../agent/tools');
const { AGENT_PROMPTS } = require('../agent/prompts');

const MAX_TURNS = 5;
const MAX_FOLLOW_UP_CALLS = 3;
const MAX_TOKENS = 4096;

// Global daily AI spend tracker
const DAILY_BUDGET_USD = parseFloat(process.env.AI_DAILY_BUDGET || '5.00');
let _dailySpend = 0;
let _dailyResetAt = Date.now() + 24 * 60 * 60 * 1000;

function _trackSpend(cost) {
  if (Date.now() > _dailyResetAt) {
    _dailySpend = 0;
    _dailyResetAt = Date.now() + 24 * 60 * 60 * 1000;
  }
  _dailySpend += cost;
}

function _budgetExceeded() {
  if (Date.now() > _dailyResetAt) {
    _dailySpend = 0;
    _dailyResetAt = Date.now() + 24 * 60 * 60 * 1000;
  }
  return _dailySpend >= DAILY_BUDGET_USD;
}

// Only these tools are available during the analysis phase
const ALLOWED_TOOLS = ['report_findings', 'screenshot', 'evaluate_js'];

// Model config — use Haiku for speed and cost
const MODELS = {
  'haiku': {
    id: 'claude-haiku-4-5-20251001',
    label: 'Haiku 4.5',
    inputCostPer1M: 1.00,
    outputCostPer1M: 5.00,
  },
  'sonnet': {
    id: 'claude-sonnet-4-5-20250929',
    label: 'Sonnet 4.5',
    inputCostPer1M: 3.00,
    outputCostPer1M: 15.00,
  },
};

/**
 * Run the AI analyst on pre-collected performance data.
 *
 * @param {object} collectionResult - Output from collector.js
 * @param {object} [options] - { model, pageState, broadcast }
 * @returns {Promise<{ findings: object, aiStats: object }>}
 */
async function analyzePerformance(collectionResult, options = {}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set.');
  }
  if (_budgetExceeded()) {
    return {
      findings: null,
      aiStats: { turns: 0, toolCalls: 0, model: 'budget_exceeded', cost: 0 },
    };
  }

  const client = new Anthropic();
  const modelKey = options.model || 'haiku';
  const modelConfig = MODELS[modelKey] || MODELS.haiku;
  const broadcast = options.broadcast || (() => {});
  const pageState = options.pageState || null;

  // Filter tools to only allowed ones
  const tools = TOOL_DEFINITIONS.filter(t => ALLOWED_TOOLS.includes(t.name));

  // Build the system prompt
  const systemPrompt = AGENT_PROMPTS.benchmark_analyst;

  // Prepare the collection data for the AI — strip the screenshot base64 to save tokens
  const dataForAI = { ...collectionResult };
  if (dataForAI.screenshot) {
    dataForAI.screenshot = '[screenshot available — use screenshot tool to view specific elements if needed]';
  }

  const messages = [
    {
      role: 'user',
      content: `Here is the complete, pre-collected performance data for ${collectionResult.url}:\n\n\`\`\`json\n${JSON.stringify(dataForAI, null, 2)}\n\`\`\`\n\nAnalyze this data and submit your findings using the report_findings tool.`
    }
  ];

  let turnCount = 0;
  let followUpCalls = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCost = 0;
  let findings = null;

  while (turnCount < MAX_TURNS) {
    turnCount++;

    broadcast({
      type: 'ai_thinking',
      turn: turnCount,
      maxTurns: MAX_TURNS,
      message: `AI is analyzing (turn ${turnCount}/${MAX_TURNS})...`
    });

    let response;
    try {
      const requestParams = {
        model: modelConfig.id,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        tools,
        messages,
      };

      // Force report_findings on first turn — data is already provided,
      // the AI should analyze and report immediately
      if (turnCount === 1) {
        requestParams.tool_choice = { type: 'tool', name: 'report_findings' };
      }

      response = await client.messages.create(requestParams);

      // Track cost
      const usage = response.usage || {};
      const inputTokens = usage.input_tokens || 0;
      const outputTokens = usage.output_tokens || 0;
      totalInputTokens += inputTokens;
      totalOutputTokens += outputTokens;
      const turnCost = (inputTokens / 1_000_000) * modelConfig.inputCostPer1M
                     + (outputTokens / 1_000_000) * modelConfig.outputCostPer1M;
      totalCost += turnCost;

      broadcast({
        type: 'ai_cost_update',
        turn: turnCount,
        totalCost: +totalCost.toFixed(6),
        model: modelConfig.label,
      });

    } catch (err) {
      broadcast({ type: 'ai_error', message: `Claude API error: ${err.message}` });
      break;
    }

    const assistantContent = response.content;
    messages.push({ role: 'assistant', content: assistantContent });

    // Broadcast any text reasoning
    for (const block of assistantContent) {
      if (block.type === 'text') {
        broadcast({ type: 'ai_commentary', text: block.text });
      }
    }

    // Check if done
    if (response.stop_reason === 'end_turn') break;
    if (response.stop_reason !== 'tool_use') break;

    // Process tool calls
    const toolUseBlocks = assistantContent.filter(b => b.type === 'tool_use');
    const toolResults = [];

    for (const toolUse of toolUseBlocks) {
      // Handle report_findings — capture and return
      if (toolUse.name === 'report_findings') {
        findings = toolUse.input;
        broadcast({
          type: 'ai_tool_call',
          tool: 'report_findings',
          input: { grade: findings.grade, score: findings.overallScore },
        });
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: 'Analysis submitted successfully.',
        });
        continue;
      }

      // Follow-up tool calls (screenshot, evaluate_js)
      if (followUpCalls >= MAX_FOLLOW_UP_CALLS) {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: 'Follow-up tool call limit reached (max 3). Please submit your report_findings now.',
        });
        continue;
      }

      if (!pageState) {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: 'Page is not available for follow-up queries. Please use the pre-collected data.',
        });
        continue;
      }

      followUpCalls++;
      broadcast({
        type: 'ai_tool_call',
        tool: toolUse.name,
        input: toolUse.input,
        callNumber: followUpCalls,
      });

      const result = await executeTool(toolUse.name, toolUse.input, pageState);

      if (result.image) {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: [
            { type: 'image', source: result.image },
            { type: 'text', text: result.result },
          ],
        });
      } else {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: result.error || result.result,
        });
      }
    }

    messages.push({ role: 'user', content: toolResults });

    // If we got findings, we can stop
    if (findings) break;
  }

  _trackSpend(totalCost);

  const aiStats = {
    turns: turnCount,
    toolCalls: followUpCalls + (findings ? 1 : 0),
    model: modelConfig.label,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    cost: +totalCost.toFixed(6),
  };

  return { findings, aiStats };
}

module.exports = { analyzePerformance };
