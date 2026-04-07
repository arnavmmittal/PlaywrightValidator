import { useState, useEffect, useRef, useCallback } from 'react';

export function useWebSocket(sessionId) {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [progress, setProgress] = useState(0);
  const [currentTest, setCurrentTest] = useState('');
  const [logs, setLogs] = useState([]);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [bugsFound, setBugsFound] = useState(0);
  const [testResults, setTestResults] = useState(new Map());
  const [aiState, setAiState] = useState(null); // AI agent state
  const wsRef = useRef(null);

  const connect = useCallback(() => {
    if (!sessionId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/${sessionId}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setMessages(prev => [...prev, data]);

        switch (data.type) {
          case 'connected':
            setLogs(prev => [...prev, { text: `Connected to session ${data.sessionId}`, color: '#4ECDC4' }]);
            break;
          case 'browser_launched':
            setLogs(prev => [...prev, { text: `✓ Browser launched (${data.browser})`, color: '#4ECDC4' }]);
            break;
          case 'navigated':
            setLogs(prev => [...prev, { text: `✓ Navigated to ${data.url}`, color: '#4ECDC4' }]);
            break;
          case 'test_start':
            setCurrentTest(data.label);
            setTestResults(prev => {
              const next = new Map(prev);
              next.set(data.testId, {
                status: 'running',
                bugsFound: 0,
                label: data.label,
                category: data.category || '',
              });
              return next;
            });
            setLogs(prev => [...prev, { text: `▸ Running: ${data.label}`, color: '#E8FF47' }]);
            break;
          case 'test_complete':
            setTestResults(prev => {
              const next = new Map(prev);
              const existing = next.get(data.testId) || {};
              next.set(data.testId, {
                ...existing,
                status: data.status || 'complete',
                bugsFound: data.bugsFound ?? 0,
                label: existing.label || data.testId,
                category: existing.category || '',
              });
              return next;
            });
            setBugsFound(prev => prev + (data.bugsFound ?? 0));
            setLogs(prev => [...prev, {
              text: `✓ ${data.testId} complete (${data.bugsFound} issues)`,
              color: data.bugsFound > 0 ? '#FF6B35' : '#4ECDC4'
            }]);
            break;
          case 'bug_found':
            setBugsFound(prev => prev + 1);
            setTestResults(prev => {
              if (data.testId) {
                const next = new Map(prev);
                const existing = next.get(data.testId);
                if (existing) {
                  next.set(data.testId, {
                    ...existing,
                    bugsFound: (existing.bugsFound || 0) + 1,
                  });
                }
                return next;
              }
              return prev;
            });
            break;
          case 'log':
            setLogs(prev => [...prev, { text: data.text, color: data.color || '#7B8794' }]);
            break;
          case 'progress':
            setProgress(data.percent);
            break;
          case 'complete':
            setReport(data.report);
            setProgress(100);
            setCurrentTest('');
            setLogs(prev => [...prev, { text: '✓ All tests complete — analyzing results…', color: '#E8FF47' }]);
            break;
          case 'error':
            setError(data.message);
            setLogs(prev => [...prev, { text: `✗ Error: ${data.message}`, color: '#FF2D2D' }]);
            break;
          // AI agent messages
          case 'ai_status':
            setAiState(prev => ({ ...prev, status: data.status, message: data.message }));
            setLogs(prev => [...prev, { text: `🤖 ${data.message}`, color: '#A78BFA' }]);
            break;
          case 'ai_thinking':
            setAiState(prev => ({ ...prev, turn: data.turn, maxTurns: data.maxTurns }));
            setLogs(prev => [...prev, { text: `💭 ${data.message}`, color: '#7B8794' }]);
            break;
          case 'ai_reasoning':
            setAiState(prev => ({ ...prev, lastReasoning: data.text }));
            setLogs(prev => [...prev, { text: `  ↳ ${data.text.substring(0, 120)}${data.text.length > 120 ? '...' : ''}`, color: '#7B8794', italic: true }]);
            break;
          case 'ai_commentary':
            setLogs(prev => [...prev, { text: `🤖 ${data.text.substring(0, 200)}`, color: '#A78BFA' }]);
            break;
          case 'ai_tool_call':
            setAiState(prev => ({ ...prev, lastTool: data.tool, toolCalls: (prev?.toolCalls || 0) + 1 }));
            setLogs(prev => [...prev, { text: `⚡ Tool [${data.callNumber}]: ${data.tool}(${JSON.stringify(data.input).substring(0, 80)}...)`, color: '#E8FF47' }]);
            break;
          case 'ai_tool_result':
            setLogs(prev => [...prev, { text: `  ${data.success ? '✓' : '✗'} ${data.summary}`, color: data.success ? '#4ECDC4' : '#FF6B35' }]);
            break;
          case 'ai_cost_update':
            setAiState(prev => ({
              ...prev,
              totalCost: data.totalCost,
              totalInputTokens: data.totalInputTokens,
              totalOutputTokens: data.totalOutputTokens,
              model: data.model
            }));
            break;
          case 'ai_error':
            setError(data.message);
            setLogs(prev => [...prev, { text: `✗ AI Error: ${data.message}`, color: '#FF2D2D' }]);
            break;
          default:
            break;
        }
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };

    ws.onerror = (event) => {
      console.error('WebSocket error:', event);
      setError('Connection error');
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [sessionId]);

  useEffect(() => {
    const cleanup = connect();
    return cleanup;
  }, [connect]);

  const reset = useCallback(() => {
    setMessages([]);
    setProgress(0);
    setCurrentTest('');
    setLogs([]);
    setReport(null);
    setError(null);
    setBugsFound(0);
    setTestResults(new Map());
    setAiState(null);
  }, []);

  return {
    isConnected,
    messages,
    progress,
    currentTest,
    logs,
    report,
    error,
    bugsFound,
    testResults,
    aiState,
    reset,
  };
}
