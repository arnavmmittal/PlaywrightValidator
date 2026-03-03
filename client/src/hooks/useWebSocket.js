import { useState, useEffect, useRef, useCallback } from 'react';

export function useWebSocket(sessionId) {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [progress, setProgress] = useState(0);
  const [currentTest, setCurrentTest] = useState('');
  const [logs, setLogs] = useState([]);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
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
            setLogs(prev => [...prev, { text: `▸ Running: ${data.label}`, color: '#E8FF47' }]);
            break;
          case 'test_complete':
            setLogs(prev => [...prev, {
              text: `✓ ${data.testId} complete (${data.bugsFound} issues)`,
              color: data.bugsFound > 0 ? '#FF6B35' : '#4ECDC4'
            }]);
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
  }, []);

  return {
    isConnected,
    messages,
    progress,
    currentTest,
    logs,
    report,
    error,
    reset,
  };
}
