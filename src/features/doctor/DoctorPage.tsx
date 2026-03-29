import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import TerminalHelper from '../../components/TerminalHelper';

interface ProposedOperation {
  id: string;
  opType: 'write-file' | 'patch-block' | 'no-op';
  path: string;
  description: string;
  before: string | null;
  after: string | null;
  risk: 'low' | 'medium' | 'high';
}

interface DependencyStatus {
  name: string;
  found: boolean;
  version: Option<string>;
  install_command: string;
}

type Option<T> = T | null;

export default function DoctorPage() {
  const [scanning, setScanning] = useState(false);
  const [findings, setFindings] = useState<ProposedOperation[]>([]);
  const [deps, setDeps] = useState<DependencyStatus[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const runCheck = async () => {
    setScanning(true);
    setStatus(null);
    try {
      const results: ProposedOperation[] = await invoke('get_proposed_changes');
      setFindings(results);
      
      const gitStatus: DependencyStatus = await invoke('check_system_dependency', { name: 'git' });
      const sshStatus: DependencyStatus = await invoke('check_system_dependency', { name: 'ssh-keygen' });
      setDeps([gitStatus, sshStatus]);

      const issuesCount = results.length + (gitStatus.found ? 0 : 1) + (sshStatus.found ? 0 : 1);
      
      // Select first issue if available
      if (gitStatus.found === false) setSelectedId('dep-git');
      else if (sshStatus.found === false) setSelectedId('dep-ssh');
      else if (results.length > 0) setSelectedId(results[0].id);

      if (issuesCount === 0) {
        setStatus("Systeem is optimaal.");
      } else {
        setStatus(`${issuesCount} problemen gevonden.`);
      }
    } catch (err) {
      console.error('Health check failed:', err);
      setStatus(`Fout: ${err}`);
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    runCheck();
  }, []);

  const handleFix = async () => {
    setScanning(true);
    try {
      await invoke('apply_changes');
      runCheck();
    } catch (err) {
      console.error('Fix failed:', err);
    } finally {
      setScanning(false);
    }
  };

  const selectedOp = findings.find(f => f.id === selectedId);
  const selectedDep = deps.find(d => `dep-${d.name}` === selectedId);

  return (
    <div className="flex h-full animate-fade-in overflow-hidden">
      {/* Master List (Left) */}
      <div className="w-80 border-r border-slate-200 bg-[#f9f9f9]/50 flex flex-col h-full select-none">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex flex-col">
            <h2 className="text-[13px] font-bold text-slate-900">Health Check</h2>
            <p className="text-[10px] text-slate-500 font-medium opacity-60 uppercase tracking-widest mt-0.5">Diagnose & Herstel</p>
          </div>
          <button 
            onClick={runCheck}
            disabled={scanning}
            className="p-1.5 hover:bg-slate-200 rounded-md transition-all active:scale-95 disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-lg ${scanning ? 'animate-spin' : ''}`}>sync</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pt-2">
          {/* Dependencies */}
          {deps.map(dep => !dep.found && (
            <div 
              key={`dep-${dep.name}`}
              onClick={() => setSelectedId(`dep-${dep.name}`)}
              className={`px-4 py-2 text-[12px] cursor-pointer transition-all border-l-4 flex flex-col gap-0.5 ${
                selectedId === `dep-${dep.name}` 
                  ? 'bg-red-600/10 border-red-600' 
                  : 'hover:bg-slate-100 border-transparent'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[14px] text-red-600" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
                <span className={`font-bold truncate ${selectedId === `dep-${dep.name}` ? 'text-red-700' : 'text-slate-900'}`}>{dep.name} ontbreekt</span>
              </div>
            </div>
          ))}

          {/* Configuration Findings */}
          {findings.map((op) => (
            <div 
              key={op.id}
              onClick={() => setSelectedId(op.id)}
              className={`px-4 py-2 text-[12px] cursor-pointer transition-all border-l-4 flex flex-col gap-0.5 ${
                selectedId === op.id 
                  ? 'bg-amber-600/10 border-amber-600' 
                  : 'hover:bg-slate-100 border-transparent'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`material-symbols-outlined text-[14px] ${op.risk === 'high' ? 'text-red-600' : 'text-amber-600'}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                  {op.risk === 'high' ? 'error' : 'warning'}
                </span>
                <span className={`font-bold truncate max-w-[180px] ${selectedId === op.id ? 'text-amber-700' : 'text-slate-900'}`}>{op.description}</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono truncate pl-5">{op.path}</span>
            </div>
          ))}

          {findings.length === 0 && deps.every(d => d.found) && !scanning && (
            <div className="p-8 text-center flex flex-col items-center gap-3 opacity-40">
              <span className="material-symbols-outlined text-4xl text-emerald-500" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
              <p className="text-[12px] font-bold text-slate-900">Systeem Optimaal</p>
            </div>
          )}
        </div>

        {status && (
          <div className="p-3 bg-white border-t border-slate-100">
            <div className={`p-2 rounded text-[10px] font-bold text-center ${status.includes('Fout') ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
              {status}
            </div>
          </div>
        )}
      </div>

      {/* Detail View (Right) */}
      <div className="flex-1 flex flex-col bg-white overflow-hidden">
        {selectedDep ? (
          <div className="p-8 max-w-2xl animate-fade-in">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center border border-red-100 text-red-600">
                <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>hardware</span>
              </div>
              <div>
                <h3 className="text-[15px] font-black text-slate-900">Ontbrekende afhankelijkheid: {selectedDep.name}</h3>
                <p className="text-[12px] text-slate-500 font-medium opacity-70">Het commando '{selectedDep.name}' is niet gevonden in je PATH.</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
              <p className="text-[12px] font-bold text-slate-700 mb-4">Aanbevolen installatie:</p>
              <TerminalHelper 
                label={`Installeer ${selectedDep.name}`}
                command={selectedDep.install_command}
              />
            </div>
          </div>
        ) : selectedOp ? (
          <div className="p-8 max-w-2xl animate-fade-in flex flex-col h-full">
            <div className="flex items-center gap-4 mb-8">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${
                selectedOp.risk === 'high' ? 'bg-red-50 border-red-100 text-red-600' : 'bg-amber-50 border-amber-100 text-amber-600'
              }`}>
                <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>{selectedOp.risk === 'high' ? 'report' : 'warning_amber'}</span>
              </div>
              <div className="flex-1">
                <h3 className="text-[15px] font-black text-slate-900">{selectedOp.description}</h3>
                <p className="text-[12px] text-slate-500 font-mono font-bold mt-1 opacity-70">{selectedOp.path}</p>
              </div>
              <button 
                onClick={handleFix}
                className="px-6 py-2 bg-blue-600 text-white text-[12px] font-bold rounded-lg shadow-sm hover:bg-blue-700 active:scale-95 transition-all"
              >
                Herstel Probleem
              </button>
            </div>

            <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50 border border-slate-200 rounded-xl overflow-hidden p-6">
              <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4">Voorgestelde Correctie</h4>
              <div className="flex-1 grid grid-cols-1 gap-4 overflow-hidden">
                <div className="flex flex-col min-h-0">
                  <pre className="flex-1 text-[11px] font-mono text-slate-900 overflow-auto p-4 bg-white border border-slate-200 rounded-lg shadow-inner leading-relaxed select-text">
                    {selectedOp.after || "// Bestand wordt verwijderd"}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
            <span className="material-symbols-outlined text-6xl mb-4">health_and_safety</span>
            <p className="text-[13px] font-medium opacity-60">Systeemscan voltooid. Selecteer een item voor details.</p>
          </div>
        )}
      </div>
    </div>
  );
}

