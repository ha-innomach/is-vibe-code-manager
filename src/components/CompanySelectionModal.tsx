import React, { useState, useEffect } from 'react';

interface Company {
  id: string;
  displayName: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedIds: string[]) => void;
  companies: Company[];
  title: string;
  confirmLabel: string;
}

const CompanySelectionModal: React.FC<Props> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  companies, 
  title, 
  confirmLabel 
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (isOpen) {
      // Default to select all
      setSelectedIds(companies.map(c => c.id));
    }
  }, [isOpen, companies]);

  if (!isOpen) return null;

  const filteredCompanies = companies.filter(c => 
    c.displayName.toLowerCase().includes(search.toLowerCase()) || 
    c.id.toLowerCase().includes(search.toLowerCase())
  );

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedIds.length === companies.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(companies.map(c => c.id));
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-24 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-full border border-slate-200 animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">{title}</h2>
          <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest mt-1 opacity-60">Selecteer bedrijven om door te gaan</p>
        </div>

        <div className="p-4 bg-white space-y-4 flex-1 overflow-hidden flex flex-col">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
            <input 
              type="text" 
              placeholder="Zoeken op naam of ID..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-100 border border-transparent rounded-xl pl-10 pr-4 py-2 text-[13px] outline-none focus:bg-white focus:border-blue-500/30 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium"
            />
          </div>

          <div className="flex items-center justify-between px-2">
             <button 
              onClick={toggleAll}
              className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-700 transition-colors"
            >
              {selectedIds.length === companies.length ? 'Deselecteer Alles' : 'Selecteer Alles'}
            </button>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {selectedIds.length} geselecteerd
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar min-h-[200px]">
            {filteredCompanies.map(company => (
              <label 
                key={company.id} 
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer group ${
                  selectedIds.includes(company.id) 
                    ? 'bg-blue-50 border-blue-200' 
                    : 'bg-white border-transparent hover:bg-slate-50'
                }`}
              >
                <div className={`w-5 h-5 rounded flex items-center justify-center transition-all ${
                  selectedIds.includes(company.id) 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-slate-100 border border-slate-200 text-transparent'
                }`}>
                  <span className="material-symbols-outlined text-[14px]">check</span>
                </div>
                <input 
                  type="checkbox" 
                  className="hidden" 
                  checked={selectedIds.includes(company.id)}
                  onChange={() => toggleSelect(company.id)}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold text-slate-900 truncate">{company.displayName}</div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest opacity-60 truncate">{company.id}</div>
                </div>
              </label>
            ))}

            {filteredCompanies.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <span className="material-symbols-outlined text-4xl mb-2 opacity-20">domain_disabled</span>
                <p className="text-[12px] font-bold">Geen bedrijven gevonden</p>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 bg-white text-slate-700 text-[12px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95"
          >
            Annuleren
          </button>
          <button 
            disabled={selectedIds.length === 0}
            onClick={() => onConfirm(selectedIds)}
            className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 text-white text-[12px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CompanySelectionModal;
