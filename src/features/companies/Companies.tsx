import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import CompanyWizard from './CompanyWizard';
import { useTerminal } from '../../components/TerminalProvider';

const Companies = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [editingCompany, setEditingCompany] = useState<any>(null);
  const [sshKeyStatus, setSshKeyStatus] = useState<Record<string, boolean>>({});
  const [activeSshModal, setActiveSshModal] = useState<any>(null);
  const [publicKey, setPublicKey] = useState<string>('');
  const { runCommand, setIsOpen } = useTerminal();

  // Handle pre-fill from Repo Inspector
  useEffect(() => {
    if (location.state?.prefill) {
      setEditingCompany(location.state.prefill);
      setShowWizard(true);
      // Clear the state so it doesn't pop up again on refresh
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  const checkSshKeys = useCallback(async (comps: any[]) => {
    const status: Record<string, boolean> = {};
    for (const company of comps) {
      if (company.github?.sshKeyPath) {
        try {
          const exists: boolean = await invoke('check_file_exists', { path: company.github.sshKeyPath });
          status[company.id] = exists;
        } catch {
          status[company.id] = false;
        }
      }
    }
    setSshKeyStatus(status);
  }, []);

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const config: any = await invoke('get_config');
      setCompanies(config.companies || []);
      await checkSshKeys(config.companies || []);
    } catch (err) {
      console.warn('Tauri get_config failed:', err);
    } finally {
      setLoading(false);
    }
  }, [checkSshKeys]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const handleSyncCompany = async (company: any) => {
    // 1. Guard for missing SSH key
    if (sshKeyStatus[company.id] === false) {
      const generate = window.confirm(`De SSH-sleutel voor ${company.displayName} ontbreekt (${company.github.sshKeyPath}).\n\nWil je deze nu genereren?`);
      if (generate) {
        setIsOpen(true);
        const home: string = await invoke('get_home_dir');
        const fullPath = company.github.sshKeyPath.replace('~', home);
        const email = company.git.userEmail || "dev@example.com";
        
        await runCommand('ssh-keygen', [
          '-t', 'ed25519', 
          '-C', email, 
          '-f', fullPath
        ]);
        
        // Give it a moment, then re-check
        setTimeout(() => fetchCompanies(), 2000);
        return;
      }
    }

    if (!company.repositories || company.repositories.length === 0) {
      alert('Geen repositories geconfigureerd voor dit bedrijf.');
      return;
    }

    const root = company.workspaceRoots[0];
    if (!root) {
      alert('Geen workspace root geconfigureerd.');
      return;
    }

    setIsOpen(true);
    
    try {
      for (const repoUrl of company.repositories) {
        // Simple logic: derive folder name and check if it exists
        const parts = repoUrl.split('/');
        const folderName = (parts[parts.length - 1] || 'repo').replace('.git', '');
        const fullPath = `${root}/${folderName}`;
        
        console.log(`Syncing ${repoUrl} to ${fullPath}...`);
        
        const inspection = await invoke('inspect_repository', { path: fullPath }) as any;
        
        const hostAlias = company.github.hostAlias;
        const finalUrl = repoUrl.includes('github.com') 
          ? repoUrl.replace('github.com', hostAlias) 
          : repoUrl;

        if (inspection.exists && inspection.isGit) {
          // git pull
          await runCommand('git', ['-C', fullPath, 'pull']);
        } else {
          // git clone
          await runCommand('git', ['clone', finalUrl, fullPath]);
        }
        
        // Wait a bit between commands for the terminal to breathe
        await new Promise(r => setTimeout(r, 500));
      }
      fetchCompanies();
    } catch (err) {
      console.error('Sync failed:', err);
      alert(`Synchronisatie mislukt: ${err}`);
    }
  };

  const handleManageSsh = async (company: any) => {
    try {
      const pubKeyPath = `${company.github.sshKeyPath}.pub`;
      const content: string = await invoke('read_text_file', { path: pubKeyPath });
      setPublicKey(content);
      setActiveSshModal(company);
    } catch (err) {
      console.error('Failed to read public key:', err);
      alert('Kon de publieke sleutel niet lezen. Controleer of het .pub bestand bestaat.');
    }
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(publicKey);
    alert('Publieke sleutel gekopieerd naar klembord!');
  };

  const handleWizardCancel = () => {
    setShowWizard(false);
    setEditingCompany(null);
    fetchCompanies();
  };

  if (showWizard) {
    return <CompanyWizard onCancel={handleWizardCancel} initialData={editingCompany} />;
  }

  return (
    <div className="h-full overflow-y-auto p-6 scroll-smooth">
      <div className="animate-fade-in flex flex-col space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">Bedrijven</h2>
          <button 
            className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white text-[12px] font-bold rounded shadow-md shadow-blue-500/10 active:scale-95 transition-all" 
            onClick={() => setShowWizard(true)}
          >
            <span className="material-symbols-outlined text-base">add_circle</span>
            Nieuw Bedrijf
          </button>
        </div>

        {loading ? (
          <div className="text-slate-400 text-[13px]">Configuratie laden...</div>
        ) : companies.length === 0 ? (
          <div className="flex-1 bg-slate-50 rounded-xl p-10 flex flex-col items-center justify-center border border-slate-200 border-dashed">
            <span className="material-symbols-outlined text-5xl text-slate-300 mb-4">domain_disabled</span>
            <h3 className="text-base font-bold text-slate-900 mb-2">Geen Bedrijven</h3>
            <p className="text-[13px] text-slate-500 mb-6 text-center max-w-sm">
              Maak een profiel aan om Git-identiteiten en SSH-aliases automatisch te beheren.
            </p>
            <button 
              className="px-5 py-2 bg-blue-600 text-white text-[12px] font-bold rounded shadow-lg shadow-blue-500/20 active:scale-95"
              onClick={() => setShowWizard(true)}
            >
              Aan de Slag
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {companies.map((company, i) => (
              <div 
                key={i} 
                className="bg-white rounded-2xl border border-slate-200 hover:border-blue-400 transition-all cursor-default group shadow-sm flex flex-col overflow-hidden"
              >
                <div className="p-5 flex-1">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-all border border-slate-100 shadow-sm">
                      <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>business</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[14px] font-extrabold text-slate-900 group-hover:text-blue-600 transition-colors truncate tracking-tight uppercase leading-none">{company.displayName}</h3>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5 opacity-60">ID: {company.id}</p>
                    </div>
                    
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingCompany(company);
                        setShowWizard(true);
                      }}
                      className="w-8 h-8 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm active:scale-90"
                      title="Bewerken"
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                  </div>
                  
                  <div className="space-y-3 pt-4 border-t border-slate-50">
                    <div className="flex justify-between items-center bg-slate-50/50 p-2 rounded-lg border border-slate-100/50">
                      <span className="text-slate-400 flex items-center gap-2 text-[9px] font-black uppercase tracking-widest"><span className="material-symbols-outlined text-[14px]">mail</span> Email</span>
                      <span className="text-[11px] text-slate-900 font-bold px-2 py-0.5 bg-white rounded border border-slate-200/50 shadow-sm">{company.git?.userEmail}</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-50/50 p-2 rounded-lg border border-slate-100/50">
                      <span className="text-slate-400 flex items-center gap-2 text-[9px] font-black uppercase tracking-widest"><span className="material-symbols-outlined text-[14px]">dns</span> SSH Host</span>
                      <div className="flex items-center gap-2">
                        {sshKeyStatus[company.id] === false ? (
                          <span className="flex items-center gap-1 text-[8px] font-black uppercase tracking-tighter text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100/50 animate-pulse">
                            <span className="material-symbols-outlined text-[12px]">warning</span>
                            Mist
                          </span>
                        ) : (
                          <button 
                            onClick={() => handleManageSsh(company)}
                            className="flex items-center gap-1 text-[8px] font-black uppercase tracking-tighter text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100/50 hover:bg-blue-100 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[12px]">key</span>
                            GitHub Setup
                          </button>
                        )}
                        <span className="text-[11px] text-slate-900 font-bold px-2 py-0.5 bg-white rounded border border-slate-200/50 shadow-sm">{company.github?.hostAlias}</span>
                      </div>
                    </div>
                  </div>

                  {company.repositories && company.repositories.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-50">
                      <h4 className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 mb-3 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[14px]">terminal</span>
                        Repositories ({company.repositories.length})
                      </h4>
                      <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1 custom-scrollbar">
                        {company.repositories.map((repo: string, idx: number) => {
                          const parts = repo.split('/');
                          const name = (parts[parts.length - 1] || 'repo').replace('.git', '');
                          return (
                            <div key={idx} className="flex items-center justify-between text-[11px] font-bold text-slate-600 bg-slate-50/30 px-2 py-1.5 rounded border border-transparent hover:border-slate-200 transition-all">
                              <span className="truncate flex-1 mr-2">{name}</span>
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-300" title="Status onbekend"></span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-slate-50/80 p-3 border-t border-slate-100 flex flex-col gap-2">
                  <button 
                    onClick={() => navigate('/repos', { state: { companyId: company.id } })}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-200 text-[11px] font-black uppercase tracking-widest rounded-lg shadow-sm active:scale-[0.98] transition-all"
                  >
                    <span className="material-symbols-outlined text-sm">visibility</span>
                    Bekijk Repos
                  </button>
                  <button 
                    onClick={() => handleSyncCompany(company)}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-widest rounded-lg shadow-sm shadow-blue-500/10 active:scale-[0.98] transition-all"
                  >
                    <span className="material-symbols-outlined text-sm">sync</span>
                    Sync Repos
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {activeSshModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden border border-slate-200 animate-slide-up">
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">GitHub SSH Setup</h3>
                  <p className="text-[12px] text-slate-500 font-bold uppercase tracking-widest mt-1 opacity-60">Stap 2: Registratie</p>
                </div>
                <button 
                  onClick={() => setActiveSshModal(null)}
                  className="w-10 h-10 rounded-full hover:bg-slate-50 flex items-center justify-center text-slate-400 transition-colors"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="space-y-6">
                <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                  <p className="text-[13px] text-blue-900 font-bold leading-relaxed">
                    Je hebt een nieuwe sleutel aangemaakt. De laatste stap is om deze aan je GitHub account toe te voegen zodat je gemachtigd bent om te syncen.
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 ml-1">Jouw Publieke Sleutel</label>
                  <div className="group relative">
                    <pre className="w-full bg-slate-900 text-slate-300 p-5 rounded-2xl text-[11px] font-mono whitespace-pre-wrap break-all border border-slate-800 shadow-inner">
                      {publicKey}
                    </pre>
                    <button 
                      onClick={handleCopyKey}
                      className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-2 backdrop-blur-md"
                    >
                      <span className="material-symbols-outlined text-sm">content_copy</span>
                      Kopieer
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <a 
                    href="https://github.com/settings/ssh/new" 
                    target="_blank" 
                    rel="noreferrer"
                    className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[12px] flex items-center justify-center gap-3 hover:bg-black transition-all shadow-xl shadow-slate-900/20"
                  >
                    <span className="material-symbols-outlined">open_in_new</span>
                    Sleutel Toevoegen op GitHub
                  </a>
                  <button 
                    onClick={() => setActiveSshModal(null)}
                    className="w-full py-4 rounded-2xl font-black uppercase tracking-widest text-[12px] text-slate-400 hover:text-slate-900 transition-all"
                  >
                    Ik heb dit gedaan, ga verder
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Companies;
