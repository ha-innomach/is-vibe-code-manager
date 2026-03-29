import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';

interface InspectionResult {
  path: string;
  exists: boolean;
  isGit: boolean;
  userEmail: string | null;
  originUrl: string | null;
  matchedCompanyId: string | null;
}

export default function RepoInspector() {
  const [result, setResult] = useState<InspectionResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleChooseDir = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });

      if (selected && typeof selected === 'string') {
        inspectPath(selected);
      }
    } catch (err) {
      console.error('Failed to open dialog:', err);
    }
  };

  const inspectPath = async (path: string) => {
    setLoading(true);
    try {
      const res: InspectionResult = await invoke('inspect_repository', { path });
      setResult(res);
    } catch (err) {
      console.error('Inspection failed:', err);
      alert('Failed to inspect repository.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6 scroll-smooth">
      <div className="animate-fade-in flex flex-col space-y-6">
        <div className="flex flex-col">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">Repository Inspector</h2>
          <p className="text-[11px] text-slate-500 font-medium opacity-70">Valideer git-repositories tegen je bedrijfscontexten.</p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="relative z-10 flex flex-col sm:flex-row gap-3">
            <button 
              onClick={handleChooseDir}
              disabled={loading}
              className="flex items-center justify-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-[12px] transition-all shadow-md shadow-blue-500/10 flex-shrink-0 disabled:opacity-50 active:scale-95"
            >
              <span className="material-symbols-outlined text-base">{loading ? 'sync' : 'folder_open'}</span>
              {loading ? 'Scannen...' : 'Selecteer Map'}
            </button>
            <input 
              type="text" 
              className="flex-1 bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-[13px] font-mono text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all select-text" 
              placeholder="Pad naar repository..."
              readOnly
              value={result?.path || ""}
            />
          </div>
        </div>

        {result ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 animate-fade-in">
            {/* Status Column */}
            <div className="space-y-4">
              {!result.isGit ? (
                <div className="bg-white p-6 rounded-xl border-l-4 border-red-500 shadow-sm border border-slate-200">
                  <div className="flex items-center gap-3 mb-4 text-red-600">
                    <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
                    <h3 className="text-sm font-bold">Geen Git Repo</h3>
                  </div>
                  <p className="text-[12px] text-slate-500 font-medium leading-relaxed opacity-80">De locatie bevat geen .git repository.</p>
                </div>
              ) : (
                <div className={`bg-white p-6 rounded-xl border border-slate-200 border-l-4 ${result.matchedCompanyId ? 'border-emerald-500' : 'border-slate-300'} shadow-sm relative overflow-hidden group`}>
                  <div className={`absolute -right-5 -top-5 opacity-5 group-hover:opacity-10 transition-opacity ${result.matchedCompanyId ? 'text-blue-500' : 'text-slate-500'}`}>
                    <span className="material-symbols-outlined text-[100px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      {result.matchedCompanyId ? 'verified' : 'help'}
                    </span>
                  </div>
                  
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-6">
                      <span className={`material-symbols-outlined text-3xl ${result.matchedCompanyId ? 'text-emerald-500' : 'text-slate-400'}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                        {result.matchedCompanyId ? 'verified' : 'help'}
                      </span>
                      <div className="flex flex-col">
                        <h3 className="text-base font-bold text-slate-900 tracking-tight">
                          {result.matchedCompanyId ? result.matchedCompanyId : 'Onbekende Context'}
                        </h3>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest opacity-60 mt-0.5">Status: {result.matchedCompanyId ? 'Gekoppeld' : 'Geen Match'}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-3 font-mono text-[12px]">
                      <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <span className="text-slate-400 text-[9px] font-bold uppercase tracking-widest opacity-60">Email</span>
                        <span className="text-blue-600 font-bold select-text">{result.userEmail || 'NONE'}</span>
                      </div>
                      <div className="flex flex-col gap-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <span className="text-slate-400 text-[9px] font-bold uppercase tracking-widest opacity-60">Remote URL</span>
                        <span className="text-slate-600 break-all select-text opacity-80 leading-tight">
                          {result.originUrl || 'NONE'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Diagnostic Column */}
            <div className="space-y-3">
              <h3 className="text-[12px] font-bold text-slate-900 flex items-center gap-1.5 px-1">
                <span className="material-symbols-outlined text-slate-400 text-lg">troubleshoot</span>
                Diagnose
              </h3>
              
              {result.isGit && (
                <>
                  <DiagnosticCard 
                    status={result.matchedCompanyId ? "ok" : "warning"} 
                    title="Context" 
                    description={result.matchedCompanyId ? "Pad is beheerd." : "Pad is onbekend."}
                  />
                  
                  {result.matchedCompanyId && (
                    <DiagnosticCard 
                      status="ok" 
                      title="Git Identiteit" 
                      description="Correct ingesteld."
                    />
                  )}
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-2xl border border-dashed border-slate-200 p-12 shadow-inner">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-6 border border-slate-100">
              <span className="material-symbols-outlined text-3xl text-slate-300">explore_off</span>
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-2">Geen Inspectie Actief</h3>
            <p className="text-[13px] text-slate-500 text-center max-w-sm leading-relaxed opacity-80">
              Selecteer een repository om de instellingen te valideren.
            </p>
            <button 
              onClick={handleChooseDir}
              className="mt-6 px-6 py-1.5 bg-blue-600 text-white text-[11px] font-bold rounded shadow-md shadow-blue-500/10 active:scale-95 transition-all"
            >
              Start Scan
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function DiagnosticCard({ status, title, description, current, expected }: { status: 'ok' | 'warning' | 'error', title: string, description: string, current?: string, expected?: string }) {
  const isWarning = status === 'warning';
  const isError = status === 'error';
  const iconName = isError ? 'error' : isWarning ? 'warning' : 'verified';
  const colorClass = isError ? 'text-error' : isWarning ? 'text-tertiary' : 'text-secondary';
  const borderClass = isError ? 'border-error/20' : isWarning ? 'border-tertiary/20' : 'border-secondary/20';
  const bgClass = isError ? 'bg-error/5' : isWarning ? 'bg-tertiary/5' : 'bg-white';

  return (
    <div className={`p-6 rounded-2xl border ${borderClass} ${bgClass} shadow-sm transition-all hover:shadow-md`}>
      <div className="flex items-start gap-4">
        <span className={`material-symbols-outlined text-2xl ${colorClass}`} style={{ fontVariationSettings: "'FILL' 1" }}>{iconName}</span>
        <div className="flex-1">
          <h4 className={`font-black font-headline text-base ${colorClass} mb-1.5 tracking-tight`}>{title}</h4>
          <p className="text-[13px] text-on-surface-variant mb-5 font-medium leading-relaxed">{description}</p>
          
          {(current || expected) && (
            <div className="bg-slate-50 rounded-xl border border-outline-variant shadow-inner p-5 text-xs font-mono space-y-3">
              {current && (
                <div className="flex gap-4 text-on-surface-variant whitespace-pre-wrap break-all items-center">
                  <span className="w-4 h-4 rounded bg-error/10 text-error flex items-center justify-center font-black">-</span>
                  <span className="opacity-70 line-through decoration-error/30">{current}</span>
                </div>
              )}
              {expected && (
                <div className="flex gap-4 text-primary whitespace-pre-wrap break-all items-center">
                  <span className="w-4 h-4 rounded bg-secondary/10 text-secondary flex items-center justify-center font-black">+</span>
                  <span className="font-black">{expected}</span>
                </div>
              )}
            </div>
          )}
          
          {status !== 'ok' && (
            <div className="mt-4 flex justify-end">
              <button className={`text-[10px] px-6 py-2.5 rounded-xl font-black font-headline tracking-widest uppercase transition-all shadow-sm active:scale-95 border ${
                isError 
                  ? 'bg-error text-white border-error hover:bg-error-dim shadow-error/20' 
                  : 'bg-tertiary text-white border-tertiary hover:bg-tertiary-dim shadow-tertiary/20'
              }`}>
                Fix Automatisch
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
