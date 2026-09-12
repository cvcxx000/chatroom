import { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import { useSocket } from '../context/SocketContext';

interface TerminalPanelProps {
  containerId: string;
  onClose: () => void;
  onError?: (msg: string) => void;
}

export function TerminalPanel({ containerId, onClose, onError }: TerminalPanelProps) {
  const socket = useSocket();
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const closedRef = useRef(false);
  const resizeTimerRef = useRef<number | null>(null);

  const [status, setStatus] = useState<'attaching' | 'running' | 'closed' | 'error'>('attaching');
  const [errMsg, setErrMsg] = useState('');

  const shortId = containerId.slice(0, 12);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#0d0d0d',
        foreground: '#e0e0e0',
        cursor: '#4ade80',
        selectionBackground: '#2a4a3a',
      },
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());
    term.open(el);
    fitAddon.fit();

    termRef.current = term;
    fitRef.current = fitAddon;

    // Attach to the container via socket
    socket.terminalAttach(containerId);

    term.writeln('正在连接容器…\r\n');

    // Wire up input -> socket
    const dataSub = term.onData((data) => {
      if (closedRef.current) return;
      socket.terminalInput(containerId, data);
    });

    // Socket event listeners
    const offAttached = socket.on('terminal_attached', (p) => {
      if (p.type !== 'terminal_attached' || p.containerId !== containerId) return;
      setStatus('running');
    });

    const offOutput = socket.on('terminal_output', (p) => {
      if (p.type !== 'terminal_output' || p.containerId !== containerId) return;
      term.write(p.data);
    });

    const offClosed = socket.on('terminal_closed', (p) => {
      if (p.type !== 'terminal_closed' || p.containerId !== containerId) return;
      closedRef.current = true;
      setStatus('closed');
      term.writeln('\r\n\r\n\x1b[33m[容器已断开]\x1b[0m\r\n');
    });

    const offError = socket.on('terminal_error', (p) => {
      if (p.type !== 'terminal_error' || p.containerId !== containerId) return;
      closedRef.current = true;
      setStatus('error');
      setErrMsg(p.error);
      term.writeln(`\r\n\r\n\x1b[31m[终端错误] ${p.error}\x1b[0m\r\n`);
      onError?.(p.error);
    });

    // Window resize -> refit and notify server
    const handleResize = () => {
      if (resizeTimerRef.current) window.clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = window.setTimeout(() => {
        try {
          fitAddon.fit();
          const cols = term.cols;
          const rows = term.rows;
          if (cols && rows) socket.terminalResize(containerId, cols, rows);
        } catch {
          /* ignore */
        }
      }, 120);
    };
    window.addEventListener('resize', handleResize);
    // initial resize notification
    try {
      fitAddon.fit();
      if (term.cols && term.rows) socket.terminalResize(containerId, term.cols, term.rows);
    } catch {
      /* ignore */
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimerRef.current) window.clearTimeout(resizeTimerRef.current);
      offAttached();
      offOutput();
      offClosed();
      offError();
      dataSub.dispose();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerId]);

  const running = status === 'running';
  const dotClass = running
    ? 'terminal-status-running'
    : status === 'attaching'
      ? 'terminal-status-running'
      : 'terminal-status-stopped';

  return (
    <div className="terminal-panel">
      <div className="terminal-header">
        <div className="terminal-header-left">
          <span className={`terminal-status-dot ${dotClass}`} />
          <span className="terminal-header-title">终端</span>
          <span className="muted"> {shortId}</span>
          <span className="terminal-resource-hint">0.5核 / 512MB</span>
        </div>
        <div className="terminal-header-right">
          <span className="terminal-header-status">
            {status === 'running' ? '运行中' : status === 'attaching' ? '连接中…' : '已断开'}
          </span>
          <button className="icon-btn" onClick={onClose} title="关闭终端">
            ×
          </button>
        </div>
      </div>
      {status === 'closed' && (
        <div className="terminal-banner">容器已停止，关闭此面板以释放资源。</div>
      )}
      {status === 'error' && (
        <div className="terminal-banner terminal-banner-err">错误：{errMsg}</div>
      )}
      <div className="terminal-body" ref={containerRef} />
    </div>
  );
}
