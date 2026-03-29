import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface ProposedOperation {
  id: string;
  opType: 'write-file' | 'patch-block' | 'no-op';
  path: string;
  description: string;
  before: string | null;
  after: string | null;
  risk: 'low' | 'medium' | 'high';
}

const PreviewPage = () => {
  const [operations, setOperations] = useState<ProposedOperation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const fetchChanges = async () => {
    setLoading(true);
    try {
      const ops: ProposedOperation[] = await invoke('get_proposed_changes');
      setOperations(ops);
      if (ops.length > 0 && !selectedId) {
        setSelectedId(ops[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch changes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChanges();
  }, []);

  const handleApply = async () => {
    setApplying(true);
    setStatus(null);
    try {
      const msg: string = await invoke('apply_changes');
      setStatus(msg);
      fetchChanges();
    } catch (err) {
      console.error('Failed to apply changes:', err);
      setStatus(`Error: ${err}`);
    } finally {
      setApplying(false);
    }
  };

  const selectedOp = operations.find(o => o.id === selectedId);

  if (loading) return <div className="p-10 text-slate-400 text-[13px] italic animate-pulse">Analyseren...</div>;

  if (operations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-slate-50/30 p-10 animate-fade-in">
        <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-6 border border-emerald-100 shadow-sm">
          <span className="material-symbols-outlined text-3xl text-emerald-500" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
        </div>
        <h3 className="text-base font-bold text-slate-900 mb-2">Geen Wijzigingen</h3>
        <p className="text-[13px] text-slate-500 opacity-70">Systeem is volledig gesynchroniseerd.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full animate-fade-in overflow-hidden">
      {/* Master List (Left) */}
      <div className="w-80 border-r border-slate-200 bg-[#f9f9f9]/50 flex flex-col h-full select-none">
        <div className="p-4 border-b border-slate-200">
          <h2 className="text-[13px] font-bold text-slate-900">Configuratie Preview</h2>
          <p className="text-[10px] text-slate-500 font-medium opacity-60 uppercase tracking-widest mt-0.5">{operations.length} wijzigingen gevonden</p>
        </div>

        <div className="flex-1 overflow-y-auto pt-2">
          {operations.map((op) => (
            <div 
              key={op.id}
              onClick={() => setSelectedId(op.id)}
              className={`px-4 py-2 text-[12px] cursor-pointer transition-all border-l-4 flex flex-col gap-0.5 ${
                selectedId === op.id 
                  ? 'bg-blue-600/10 border-blue-600' 
                  : 'hover:bg-slate-100 border-transparent'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`font-bold truncate max-w-[180px] ${selectedId === op.id ? 'text-blue-600' : 'text-slate-900'}`}>{op.description}</span>
                <span className={`text-[8px] font-bold px-1 rounded uppercase tracking-tighter ${
                  op.risk === 'high' ? 'bg-red-100 text-red-600' : 
                  op.risk === 'medium' ? 'bg-amber-100 text-amber-600' : 
                  'bg-emerald-100 text-emerald-600'
                }`}>
                  {op.risk.charAt(0)}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono truncate">{op.path}</span>
            </div>
          ))}
        </div>

        <div className="p-3 border-t border-slate-200 bg-white">
          <button 
            onClick={handleApply}
            disabled={applying}
            className="w-full h-8 bg-blue-600 text-white font-bold rounded shadow-sm hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all text-[11px] flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-sm font-bold">{applying ? 'sync' : 'publish'}</span>
            Toepassen
          </button>
        </div>
      </div>

      {/* Detail View (Right) */}
      <div className="flex-1 flex flex-col bg-white overflow-hidden">
        {selectedOp ? (
          <>
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className={`material-symbols-outlined text-lg ${selectedOp.opType === 'write-file' ? 'text-blue-600' : 'text-emerald-600'}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                    {selectedOp.opType === 'write-file' ? 'note_add' : 'edit_square'}
                  </span>
                  <h3 className="text-[13px] font-bold text-slate-900">{selectedOp.description}</h3>
                </div>
                <code className="text-[10px] text-slate-400 font-bold ml-6 mt-0.5 select-text opacity-70">{selectedOp.path}</code>
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border ${
                  selectedOp.risk === 'high' ? 'bg-red-50 text-red-600 border-red-100' : 
                  selectedOp.risk === 'medium' ? 'bg-amber-50 text-amber-600 border-amber-100' : 
                  'bg-emerald-50 text-emerald-600 border-emerald-100'
                }`}>
                  {selectedOp.risk === 'high' ? 'Hoog Risico' : selectedOp.risk === 'medium' ? 'Gemiddeld' : 'Laag'}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col p-4 space-y-4 bg-slate-50/10">
              {status && (
                <div className={`p-2 rounded-md border font-bold text-[11px] flex items-center gap-2 ${status.startsWith('Error') || status.startsWith('Fout') ? 'bg-red-50 border-red-100 text-red-700' : 'bg-emerald-50 border-emerald-100 text-emerald-700'}`}>
                  <span className="material-symbols-outlined text-base">{status.startsWith('Error') || status.startsWith('Fout') ? 'report' : 'verified'}</span>
                  {status}
                </div>
              )}

              <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-hidden">
                <div className="flex flex-col min-h-0">
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5 opacity-60">
                    <span className="material-symbols-outlined text-sm">history</span> Huidige Staat (Before)
                  </div>
                  <pre className="flex-1 text-[11px] font-mono text-slate-400 overflow-auto p-3 bg-white border border-slate-200 rounded shadow-inner leading-tight select-text">
                    {selectedOp.before || "// Bestand bestaat nog niet"}
                  </pre>
                </div>

                <div className="flex flex-col min-h-0">
                  <div className="text-[9px] font-bold text-blue-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5 opacity-80">
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span> Gewenste Staat (After)
                  </div>
                  <pre className="flex-1 text-[11px] font-mono text-slate-900 overflow-auto p-3 bg-blue-50/30 border border-blue-200 rounded shadow-inner leading-tight font-medium select-text">
                    {selectedOp.after || "// Bestand wordt verwijderd"}
                  </pre>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
            <span className="material-symbols-outlined text-6xl mb-4">account_tree</span>
            <p className="text-[13px] font-medium opacity-60">Selecteer een wijziging uit de lijst.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PreviewPage;
