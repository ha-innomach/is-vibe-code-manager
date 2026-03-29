import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { listen } from '@tauri-apps/api/event';
import { useTerminal } from './TerminalProvider';
import '@xterm/xterm/css/xterm.css';

export default function TerminalDrawer() {
  const { isOpen, setIsOpen, lastCommand } = useTerminal();
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isExited, setIsExited] = useState(false);

  useEffect(() => {
    if (!isOpen || !terminalRef.current || xtermRef.current) return;

    // Initialize xterm.js
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 12,
      fontFamily: '"SF Mono", Monaco, "Courier New", monospace',
      theme: {
        background: '#09090b', // Zinc-950
        foreground: '#e2e8f0', // Slate-200
        cursor: '#2563eb', // Primary Blue
        black: '#09090b',
        red: '#ef4444',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#8b5cf6',
        cyan: '#06b6d4',
        white: '#f8fafc',
      },
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    
    // Slight delay to ensure parent dimensions are settled
    setTimeout(() => fitAddon.fit(), 50);

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    term.writeln('\x1b[1;32mWelkom bij de Improvers Studio Vibe Terminal\x1b[0m');
    term.writeln('\x1b[90m--------------------------------\x1b[0m');

    if (lastCommand) {
      term.writeln(`\x1b[1;36m$ ${lastCommand}\x1b[0m`);
    }

    // Handle window resize
    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    // Listen for backend events
    const unlistenOutput = listen('terminal-output', (event: any) => {
      term.write(event.payload.text);
    });

    const unlistenExit = listen('terminal-exit', (event: any) => {
      term.writeln(`\n\x1b[1;34mProces voltooid met exit code: ${event.payload.code}\x1b[0m`);
      setIsExited(true);
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      unlistenOutput.then(u => u());
      unlistenExit.then(u => u());
      term.dispose();
      xtermRef.current = null;
    };
  }, [isOpen]);

  // Sync open state with fit
  useEffect(() => {
    if (isOpen && fitAddonRef.current) {
      setTimeout(() => fitAddonRef.current?.fit(), 100);
      setIsExited(false);
    }
  }, [isOpen, lastCommand]);

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-0 left-64 right-0 z-[100] animate-slide-up">
      <div className="bg-[#09090b] border-t border-outline-variant shadow-[0_-20px_50px_rgba(0,0,0,0.1)] flex flex-col h-[350px]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-outline-variant">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>terminal</span>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-black tracking-[0.2em] text-on-surface flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                Systeem Terminal
              </span>
              <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider opacity-60">
                {lastCommand?.split(' ')[0] || 'Console'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {isExited && (
              <span className="text-[10px] font-black text-secondary px-3 py-1 bg-secondary/10 rounded-full border border-secondary/20 tracking-widest uppercase">Voltooid</span>
            )}
            <button 
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-full transition-all text-on-surface-variant active:scale-90"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
        </div>
        
        {/* Terminal Container */}
        <div 
          ref={terminalRef} 
          className="flex-1 overflow-hidden p-4"
        />
      </div>
    </div>

  );
}
