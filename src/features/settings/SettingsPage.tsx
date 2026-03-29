import { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';

export default function SettingsPage() {
  const [backupDir, setBackupDir] = useState('~/.dev-context-manager/backups');

  const handleBrowseBackupDir = async () => {
    try {
      const homeDir = await invoke('get_home_dir');
      const selected = await open({
        directory: true,
        multiple: false,
        defaultPath: homeDir as string
      });
      if (selected && typeof selected === 'string') {
        setBackupDir(selected);
      }
    } catch (err) {
      console.error('Failed to open backup directory dialog:', err);
    }
  };


  return (
    <div className="h-full overflow-y-auto p-6 scroll-smooth">
      <div className="animate-fade-in flex flex-col space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h2 className="text-lg font-bold tracking-tight text-slate-900">Globale Instellingen</h2>
            <p className="text-[11px] text-slate-500 font-medium opacity-70">Beheer systeemlocaties en voorkeuren.</p>
          </div>
          
          <button className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white text-[12px] font-bold rounded shadow-md shadow-blue-500/10 hover:bg-blue-700 active:scale-95 transition-all">
            <span className="material-symbols-outlined text-base">save</span>
            Opslaan
          </button>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-[13px] font-bold mb-6 flex items-center gap-2 text-slate-900 tracking-tight border-b border-slate-50 pb-4">
              <span className="material-symbols-outlined text-blue-500 text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>tune</span>
              Applicatie Voorkeuren
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2 pl-1">Standaard Back-up Locatie</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    className="flex-1 bg-slate-50 border border-slate-200 rounded px-3 py-1.5 outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 transition-all font-mono text-[12px] shadow-inner" 
                    value={backupDir}
                    readOnly 
                  />
                  <button 
                    onClick={handleBrowseBackupDir}
                    className="px-4 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded text-[11px] font-bold transition-all border border-slate-200 shadow-sm active:scale-95"
                  >
                    Bladeren
                  </button>
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-slate-50">
                <ToggleRow 
                  title="SSH Configureren" 
                  description="Beheer ~/.ssh/config markers"
                  checked={true} 
                />
                <ToggleRow 
                  title="Git Configureren" 
                  description="Beheer ~/.gitconfig markers"
                  checked={true} 
                />
                <ToggleRow 
                  title="Automatisering" 
                  description="Gezondheidscheck na updates"
                  checked={true} 
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({ title, description, checked }: { title: string, description: string, checked: boolean }) {
  return (
    <div className="flex items-center justify-between p-3 bg-slate-50/50 rounded-lg border border-slate-100 transition-all hover:bg-slate-50">
      <div className="flex items-center gap-4">
        <div className={`w-8 h-8 rounded bg-white flex items-center justify-center border border-slate-100 shadow-sm ${checked ? 'text-blue-500' : 'text-slate-400 opacity-40'}`}>
          <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
            {title.includes('SSH') ? 'key' : title.includes('Git') ? 'account_tree' : 'auto_mode'}
          </span>
        </div>
        <div>
          <h4 className="font-bold text-slate-900 text-[12px] leading-tight">{title}</h4>
          <p className="text-[10px] text-slate-500 font-medium opacity-70">{description}</p>
        </div>
      </div>
      <Toggle checked={checked} />
    </div>
  );
}

function Toggle({ checked }: { checked: boolean }) {
  return (
    <div className={`w-10 h-5 rounded-full flex items-center p-0.5 cursor-pointer transition-all duration-300 ${checked ? 'bg-blue-600 border-blue-700' : 'bg-slate-200 border-slate-300'} border`}>
      <div className={`bg-white w-3.5 h-3.5 rounded-full shadow-sm transform transition-all duration-300 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </div>
  );
}
