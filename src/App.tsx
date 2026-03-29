import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import Dashboard from './features/Dashboard.tsx';
import Companies from './features/companies/Companies.tsx';

import RepoInspector from './features/repo-inspector/RepoInspector.tsx';
import PreviewPage from './features/preview/PreviewPage.tsx';
import DoctorPage from './features/doctor/DoctorPage.tsx';
import SettingsPage from './features/settings/SettingsPage.tsx';
import TerminalDrawer from './components/TerminalDrawer.tsx';

import { save, open } from '@tauri-apps/plugin-dialog';
import CompanySelectionModal from './components/CompanySelectionModal.tsx';

const AppShell = ({ children }: { children: React.ReactNode }) => {
  const [selectionModal, setSelectionModal] = useState<{
    isOpen: boolean;
    mode: 'export' | 'import';
    companies: any[];
    path?: string;
  }>({
    isOpen: false,
    mode: 'export',
    companies: []
  });

  const handleExport = async () => {
    try {
      const config: any = await invoke('get_config');
      if (!config.companies || config.companies.length === 0) {
        alert('Geen bedrijven om te exporteren.');
        return;
      }
      
      setSelectionModal({
        isOpen: true,
        mode: 'export',
        companies: config.companies
      });
    } catch (err) {
      console.error('Export pre-check failed:', err);
    }
  };

  const handleImport = async () => {
    try {
      const selectedPath = await open({
        multiple: false,
        filters: [{
          name: 'JSON',
          extensions: ['json']
        }]
      });

      if (selectedPath && typeof selectedPath === 'string') {
        const fileConfig: any = await invoke('get_config_from_file', { path: selectedPath });
        
        if (!fileConfig.companies || fileConfig.companies.length === 0) {
          alert('Geen bedrijven gevonden in dit bestand.');
          return;
        }

        setSelectionModal({
          isOpen: true,
          mode: 'import',
          companies: fileConfig.companies,
          path: selectedPath
        });
      }
    } catch (err) {
      console.error('Import pre-check failed:', err);
      alert('Kon bestand niet lezen.');
    }
  };

  const handleSelectionConfirm = async (selectedIds: string[]) => {
    const isExport = selectionModal.mode === 'export';
    setSelectionModal((prev: any) => ({ ...prev, isOpen: false }));

    try {
      if (isExport) {
        const filePath = await save({
          filters: [{ name: 'JSON', extensions: ['json'] }],
          defaultPath: 'vibe_config_export.json'
        });

        if (filePath) {
          await invoke('export_selected_config', { 
            path: filePath, 
            companyIds: selectedIds 
          });
          console.log('Export success to:', filePath);
        }
      } else {
        // Selection Modal already has the path in state
        if (selectionModal.path) {
          await invoke('import_selected_companies', { 
            path: selectionModal.path, 
            companyIds: selectedIds 
          });
          console.log('Import success');
          window.location.reload();
        }
      }
    } catch (err) {
      console.error(`${isExport ? 'Export' : 'Import'} operation failed:`, err);
      alert(`${isExport ? 'Export' : 'Import'} mislukt.`);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-white text-slate-900 selection:bg-blue-500/10 transition-colors">
      <TerminalDrawer />
      
      {/* Sidebar - macOS Style */}
      <aside className="w-56 flex flex-col pt-8 pb-4 bg-[#f6f6f6]/80 backdrop-blur-3xl border-r border-[#d1d1d6]/50 z-20 transition-all select-none">
        <div className="px-4 mb-4 flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <span className="material-symbols-outlined text-white text-base" style={{ fontVariationSettings: "'FILL' 1" }}>hub</span>
          </div>
          <div className="flex flex-col">
            <h1 className="text-[12px] font-bold text-slate-900 tracking-tight leading-none">Vibe Code Manager</h1>
            <p className="text-[8px] text-slate-400 font-medium tracking-tight mt-0.5 uppercase opacity-60">v0.1.0</p>
          </div>
        </div>
        
        <nav className="flex-1 px-2 space-y-0.5 mt-1">
          <NavItem to="/dashboard" icon="dashboard" label="Overzicht" />
          <NavItem to="/companies" icon="business" label="Bedrijven" />
          <NavItem to="/repos" icon="code" label="Repositories" />
          <div className="h-px bg-slate-200/40 my-2 mx-3"></div>
          <NavItem to="/preview" icon="rocket_launch" label="Toepassen" />
          <NavItem to="/doctor" icon="health_and_safety" label="Dokter" />
          <NavItem to="/settings" icon="settings" label="Instellingen" />
        </nav>

        <div className="mx-2 mb-2 p-2 rounded-lg bg-white/40 border border-[#d1d1d6]/30 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center border border-slate-300/50 overflow-hidden">
              <span className="material-symbols-outlined text-slate-500 text-xs">person</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-slate-900 truncate tracking-tight">Vibe Manager</p>
              <p className="text-[7px] text-slate-400 font-medium uppercase tracking-widest opacity-60">ADMINISTRATOR</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Toolbar - macOS Style */}
          <header className="h-10 flex items-center justify-between px-5 bg-white/80 backdrop-blur-md border-b border-[#d1d1d6]/30 z-10 transition-all">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 group cursor-help relative px-2 py-0.5 rounded bg-emerald-50 border border-emerald-100">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-600">Sync Actief</span>
                
                <div className="absolute top-full left-0 mt-2 w-72 p-4 bg-white border border-slate-200 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 text-[12px] font-medium leading-relaxed text-slate-600">
                  <p className="mb-2 font-bold text-slate-900">Magische Sync</p>
                  <p className="opacity-90">VCM beheert SSH-sleutels en Git-identiteiten op systeemniveau. Veranderingen worden direct gesynchroniseerd met je lokale werkomgeving.</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 text-slate-400">
              <button className="p-1.5 hover:bg-slate-100 rounded-md transition-all active:scale-95">
                <span className="material-symbols-outlined text-xl">search</span>
              </button>
              <div className="w-px h-4 bg-slate-200"></div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleImport}
                  className="px-3 py-1 bg-white border border-slate-200 text-slate-600 text-[11px] font-bold rounded-md shadow-sm hover:bg-slate-50 active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">download</span>
                  Import
                </button>
                <button 
                  onClick={handleExport}
                  className="px-3 py-1 bg-primary text-white text-[11px] font-bold rounded-md shadow-sm active:bg-primary-dim transition-all flex items-center gap-1.5 hover:bg-blue-700"
                >
                  <span className="material-symbols-outlined text-sm">upload</span>
                  Export
                </button>
              </div>
            </div>
          </header>

        {/* Content Container */}
        <main className="flex-1 overflow-y-auto bg-white custom-scrollbar">
          {children}
        </main>
      </div>

      <CompanySelectionModal 
        isOpen={selectionModal.isOpen}
        onClose={() => setSelectionModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={handleSelectionConfirm}
        companies={selectionModal.companies}
        title={selectionModal.mode === 'export' ? 'Exporteer Bedrijven' : 'Importeer Bedrijven'}
        confirmLabel={selectionModal.mode === 'export' ? 'Exporteer Selectie' : 'Importeer Selectie'}
      />
    </div>
  );
};

const NavItem = ({ to, icon, label }: { to: string; icon: string; label: string }) => {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center px-4 py-1.5 mx-2 rounded-md transition-all duration-200 group text-[13px] ${
          isActive 
            ? 'text-white bg-blue-600 font-bold shadow-sm shadow-blue-500/20' 
            : 'text-slate-600 hover:text-slate-900 hover:bg-black/5'
        }`
      }
    >
      <span className="material-symbols-outlined mr-2.5 text-[20px] group-hover:scale-105 transition-transform">{icon}</span>
      {label}
    </NavLink>
  );
};

function App() {
  return (
    <Router>
      <AppShell>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/companies" element={<Companies />} />
          <Route path="/repos" element={<RepoInspector />} />
          <Route path="/preview" element={<PreviewPage />} />
          <Route path="/doctor" element={<DoctorPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </AppShell>
    </Router>
  );
}

export default App;
