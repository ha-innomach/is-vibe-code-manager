import { useState } from 'react';
import { useTerminal } from './TerminalProvider';

interface TerminalHelperProps {
  command: string;
  label?: string;
}

export default function TerminalHelper({ command, label }: TerminalHelperProps) {
  const [copied, setCopied] = useState(false);
  const { runCommand } = useTerminal();

  const handleCopy = () => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRun = () => {
    const parts = command.split(' ');
    const cmd = parts[0];
    const args = parts.slice(1);
    runCommand(cmd, args);
  };

  return (
    <div className="flex flex-col w-full animate-fade-in group">
      {label && <label className="text-[10px] uppercase font-black tracking-[0.2em] text-on-surface-variant/70 mb-2 ml-1">{label}</label>}
      
      <div className="flex flex-col bg-slate-950 rounded-2xl border border-white/5 overflow-hidden shadow-2xl transition-all group-hover:border-primary/30">
        {/* Terminal Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5 mr-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></div>
            </div>
            <span className="material-symbols-outlined text-white/40 text-sm select-none">terminal</span>
            <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Bash</span>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleCopy}
              className={`flex items-center gap-1.5 transition-all text-[10px] font-black uppercase tracking-widest ${
                copied ? 'text-emerald-400' : 'text-white/40 hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{copied ? 'check' : 'content_copy'}</span>
              {copied ? 'Gekopieerd' : 'Kopieer'}
            </button>
          </div>
        </div>

        {/* Command Body */}
        <div className="p-8 group/card">
          <code className="block font-mono text-base text-emerald-400/90 leading-loose break-all whitespace-pre-wrap selection:bg-primary/30">
            <span className="text-white/40 mr-4 select-none">$</span>
            {command}
          </code>
        </div>

        {/* Action Footer */}
        <div className="px-6 py-4 bg-white/5 border-t border-white/5 flex justify-end">
           <button 
            onClick={handleRun}
            className="flex items-center gap-2.5 px-6 py-3 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-all hover:bg-primary-dim hover:scale-[1.02] active:scale-95 shadow-xl shadow-primary/20"
          >
            <span className="material-symbols-outlined text-[18px]">play_arrow</span>
            Voer commando uit
          </button>
        </div>
      </div>
      
      <p className="mt-3 text-[10px] text-on-surface-variant/50 px-1 font-medium italic">
        * Dit commando wordt direct uitgevoerd in de ingebouwde systeem-terminal.
      </p>
    </div>
  );
}
