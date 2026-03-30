import { useState, useEffect, useCallback } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTerminal } from '../../components/TerminalProvider';

interface InspectionResult {
  path: string;
  exists: boolean;
  isGit: boolean;
  userEmail: string | null;
  originUrl: string | null;
  matchedCompanyId: string | null;
}

export default function RepoInspector() {
  const navigate = useNavigate();
  const { runCommand, setIsOpen } = useTerminal();
  const [result, setResult] = useState<InspectionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<any[]>([]);
  const [showIdentitySwitch, setShowIdentitySwitch] = useState(false);

  const location = useLocation();

  const fetchCompanies = useCallback(async () => {
    try {
      const config: any = await invoke('get_config');
      const comps = config.companies || [];
      setCompanies(comps);
      
      // Auto-inspect if coming from companies view
      if (location.state?.companyId && comps.length > 0) {
        const comp = comps.find((c: any) => c.id === location.state.companyId);
        if (comp && comp.workspaceRoots[0] && comp.repositories[0]) {
          const repoUrl = comp.repositories[0];
          const parts = repoUrl.split('/');
          const folderName = (parts[parts.length - 1] || 'repo').replace('.git', '');
          const fullPath = `${comp.workspaceRoots[0]}/${folderName}`;
          inspectPath(fullPath);
          
          // Clear state after handling it
          navigate(location.pathname, { replace: true, state: {} });
        }
      }
    } catch (err) {
      console.warn('Failed to fetch companies:', err);
    }
  }, [location, navigate]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const handleAddCompany = () => {
    if (!result || !result.path) return;
    
    // Suggest an ID and display name from the folder name
    const parts = result.path.replace(/\\/g, '/').split('/');
    const folderName = parts[parts.length - 1] || 'naamloos';
    const suggestedId = folderName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const suggestedName = folderName.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    
    // Get parent directory for workspace root
    const workspaceRoot = result.path.substring(0, Math.max(result.path.lastIndexOf('/'), result.path.lastIndexOf('\\')));

    const prefill = {
      id: suggestedId,
      displayName: suggestedName,
      workspaceRoots: [workspaceRoot],
      git: {
        userName: result.userEmail?.split('@')[0] || '',
        userEmail: result.userEmail || '',
      },
      github: {
        username: '',
        hostAlias: `github-${suggestedId}`,
        sshKeyPath: `~/.ssh/id_ed25519_${suggestedId}`,
        cloneProtocol: 'ssh'
      },
      repositories: result.originUrl ? [result.originUrl] : []
    };

    navigate('/companies', { state: { prefill } });
  };

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

  const handleFix = async () => {
    if (!result || !result.path) return;
    setLoading(true);
    try {
      // 1. Get the matching company to find correct credentials
      const config: any = await invoke('get_config');
      const company = config.companies.find((c: any) => c.id === result.matchedCompanyId);
      
      if (!company) {
        alert('Kan geen bijbehorend bedrijf vinden om de identiteit van te kopiëren.');
        return;
      }
      // 2. Apply fix
      await invoke('fix_repository_identity', { 
        repoPath: result.path, 
        userName: company.git.userName, 
        userEmail: company.git.userEmail,
        hostAlias: company.github.hostAlias
      });
      
      // 3. Re-inspect
      await inspectPath(result.path);
    } catch (err) {
      console.error('Fix failed:', err);
      alert(`Herstel mislukt: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchIdentity = async (company: any) => {
    if (!result || !result.path) return;
    setLoading(true);
    try {
      await invoke('fix_repository_identity', { 
        repoPath: result.path, 
        userName: company.git.userName, 
        userEmail: company.git.userEmail,
        hostAlias: company.github.hostAlias
      });
      
      setShowIdentitySwitch(false);
      await inspectPath(result.path);
    } catch (err) {
      console.error('Switch failed:', err);
      alert(`Wisselen mislukt: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncRepo = async (repoUrl: string, company: any) => {
    if (!company || !company.workspaceRoots[0]) return;
    
    // Derive folder name and target path
    const parts = repoUrl.split('/');
    const folderName = (parts[parts.length - 1] || 'repo').replace('.git', '');
    const fullPath = `${company.workspaceRoots[0]}/${folderName}`;
    
    setIsOpen(true);
    setLoading(true);
    
    try {
      // 1. Check if it exists
      const inspection: any = await invoke('inspect_repository', { path: fullPath });
      
      // 2. Determine final URL (with host alias)
      const hostAlias = company.github.hostAlias;
      const finalUrl = repoUrl.includes('github.com') 
        ? repoUrl.replace('github.com', hostAlias) 
        : repoUrl;

      if (inspection.exists && inspection.isGit) {
        await runCommand('git', ['-C', fullPath, 'pull']);
      } else {
        await runCommand('git', ['clone', finalUrl, fullPath]);
      }
      
      // 3. Re-inspect current path if it was the target
      if (result && result.path === fullPath) {
        await inspectPath(fullPath);
      }
    } catch (err) {
      console.error('Sync failed:', err);
      alert(`Synchronisatie mislukt: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const [sshKeyExists, setSshKeyExists] = useState<boolean | null>(null);

  const checkSshKey = useCallback(async (path: string) => {
    try {
      const exists: boolean = await invoke('check_file_exists', { path });
      setSshKeyExists(exists);
    } catch (err) {
      console.warn('Failed to check SSH key:', err);
    }
  }, []);

  const matchedCompany = result?.matchedCompanyId 
    ? companies.find(c => c.id === result.matchedCompanyId)
    : null;

  useEffect(() => {
    if (matchedCompany?.github?.sshKeyPath) {
      checkSshKey(matchedCompany.github.sshKeyPath);
    } else {
      setSshKeyExists(null);
    }
  }, [matchedCompany, checkSshKey]);

  const handleFetchGhRepos = async () => {
    if (!matchedCompany || !matchedCompany.id) return;
    
    // Attempt to extract org from existing repositories or ID
    let suggestedOrg = matchedCompany.id.split('-')[0]; // fallback
    if (matchedCompany.repositories[0]) {
      const match = matchedCompany.repositories[0].match(/[:/]([^/]+)\/[^/]+$/);
      if (match) suggestedOrg = match[1];
    }

    const org = prompt("Voer de GitHub Organisatie of Gebruikersnaam in:", suggestedOrg);
    if (!org) return;

    setLoading(true);
    try {
      const repos: any[] = await invoke('fetch_gh_repos', { org });
      const newUrls = repos.map(r => r.url.replace('https://github.com/', 'git@github.com:') + '.git');
      
      const currentUrls = new Set(matchedCompany.repositories);
      const combined = [...matchedCompany.repositories];
      
      let addedCount = 0;
      newUrls.forEach(url => {
        if (!currentUrls.has(url)) {
          combined.push(url);
          addedCount++;
        }
      });

      if (addedCount > 0) {
        const newCompanies = companies.map(c => 
          c.id === matchedCompany.id ? { ...c, repositories: combined } : c
        );
        await invoke('save_config', { config: { companies: newCompanies } });
        await fetchCompanies();
        alert(`${addedCount} nieuwe repositories gevonden op GitHub.`);
      } else {
        alert("Geen nieuwe repositories gevonden voor deze organisatie.");
      }
    } catch (err) {
      console.error('Fetch failed:', err);
      alert(`GitHub scan mislukt: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleScanLocal = async () => {
    if (!matchedCompany || !matchedCompany.workspaceRoots[0]) return;

    setLoading(true);
    try {
      const root = matchedCompany.workspaceRoots[0];
      const localRepos: string[] = await invoke('scan_local_workspace', { root });
      
      // Filter for repos that likely belong to this company
      // (simple check: does the URL contain a hint of the company name or is it from the same org)
      const companyHint = matchedCompany.id.split('-')[0].toLowerCase();
      const filtered = localRepos.filter(url => {
        const lowerUrl = url.toLowerCase();
        return lowerUrl.includes(companyHint) || lowerUrl.includes(matchedCompany.displayName.toLowerCase().replace(/\s/g, ''));
      });

      const currentUrls = new Set(matchedCompany.repositories);
      const combined = [...matchedCompany.repositories];
      
      let addedCount = 0;
      filtered.forEach(url => {
        // Normalize URL to git@github.com format for consistency if it's GitHub
        const normUrl = url.replace('https://github.com/', 'git@github.com:');
        if (!currentUrls.has(normUrl)) {
          combined.push(normUrl);
          addedCount++;
        }
      });

      if (addedCount > 0) {
        const newCompanies = companies.map(c => 
          c.id === matchedCompany.id ? { ...c, repositories: combined } : c
        );
        await invoke('save_config', { config: { companies: newCompanies } });
        await fetchCompanies();
        alert(`${addedCount} nieuwe lokale repositories toegevoegd.`);
      } else {
        alert("Geen nieuwe relevante lokale repositories gevonden in de workspace root.");
      }
    } catch (err) {
      console.error('Local scan failed:', err);
      alert(`Lokale scan mislukt: ${err}`);
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
                        <span className="text-slate-400 text-[9px] font-bold uppercase tracking-widest opacity-60">Account / Identity</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-900 font-bold select-text">{matchedCompany?.displayName || 'Onbekend'}</span>
                          <button 
                            onClick={() => setShowIdentitySwitch(!showIdentitySwitch)}
                            className="bg-white border border-slate-200 text-blue-600 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter hover:bg-blue-50 transition-colors"
                          >
                            Wissel
                          </button>
                        </div>
                      </div>

                      {showIdentitySwitch && (
                        <div className="p-3 bg-slate-900 rounded-lg border border-slate-950 shadow-inner animate-slide-down space-y-2">
                          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1 italic">Kies Nieuwe Identiteit:</p>
                          <div className="grid grid-cols-1 gap-1">
                            {companies.filter(c => c.id !== result.matchedCompanyId).map(c => (
                              <button
                                key={c.id}
                                onClick={() => handleSwitchIdentity(c)}
                                className="flex items-center justify-between px-3 py-2 bg-white/5 hover:bg-white/10 rounded border border-white/5 text-left transition-all group"
                              >
                                <span className="text-white text-[11px] font-bold">{c.displayName}</span>
                                <span className="text-slate-500 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">Selecteer</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <span className="text-slate-400 text-[9px] font-bold uppercase tracking-widest opacity-60">Git Email</span>
                        <span className="text-blue-600 font-bold select-text">{result.userEmail || 'NONE'}</span>
                      </div>
                      <div className="flex flex-col gap-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <span className="text-slate-400 text-[9px] font-bold uppercase tracking-widest opacity-60">Remote SSH URL</span>
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
            <div className="space-y-4">
              <h3 className="text-[12px] font-bold text-slate-900 flex items-center gap-1.5 px-1 uppercase tracking-widest opacity-60">
                <span className="material-symbols-outlined text-slate-400 text-lg">troubleshoot</span>
                Diagnose
              </h3>
              
              {result.isGit && (
                <>
                  <DiagnosticCard 
                    status={result.matchedCompanyId ? "ok" : "warning"} 
                    title="Context" 
                    description={result.matchedCompanyId ? "Pad is beheerd door een bedrijfsprofiel." : "Dit pad is nog niet gekoppeld aan een bedrijf."}
                    onFix={!result.matchedCompanyId ? handleAddCompany : undefined}
                    fixLabel="Nieuw Bedrijf Toevoegen"
                  />
                  
                  {result.matchedCompanyId && (
                    <DiagnosticCard 
                      status={result.userEmail ? "ok" : "error"} 
                      title="Git Identiteit" 
                      description={result.userEmail ? "Identiteit gevonden." : "Geen lokale identiteit ingesteld."}
                      onFix={handleFix}
                    />
                  )}

                  {matchedCompany && sshKeyExists === false && (
                    <DiagnosticCard 
                      status="error" 
                      title="SSH Sleutel Ontbreekt" 
                      description={`De geconfigureerde SSH-sleutel voor ${matchedCompany.displayName} is niet gevonden: ${matchedCompany.github.sshKeyPath}`}
                      onFix={async () => {
                        const home: string = await invoke('get_home_dir');
                        const fullPath = matchedCompany.github.sshKeyPath.replace('~', home);
                        setIsOpen(true);
                        runCommand('ssh-keygen', [
                          '-t', 'ed25519', 
                          '-C', matchedCompany.git.userEmail || 'dev@example.com', 
                          '-f', fullPath
                        ]);
                      }}
                      fixLabel="Sleutel Genereren"
                    />
                  )}
                  
                  {result.matchedCompanyId && (
                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-between group hover:bg-blue-100/50 transition-all">
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-blue-500">sync</span>
                        <div>
                          <h4 className="text-xs font-bold text-blue-700">Repository Sync</h4>
                          <p className="text-[10px] text-blue-600/70 font-medium">Haal de nieuwste wijzigingen op.</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => result.originUrl && matchedCompany && handleSyncRepo(result.originUrl, matchedCompany)}
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold rounded-lg shadow-sm active:scale-95 transition-all"
                      >
                        Pull Latest
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Workspace Context Panel */}
              {matchedCompany && (
                <div className="animate-slide-up space-y-4 pt-4 border-t border-slate-100 mt-4">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-[12px] font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-widest opacity-60">
                      <span className="material-symbols-outlined text-slate-400 text-lg">workspaces</span>
                      Workspace Context: {matchedCompany.displayName}
                    </h3>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={handleScanLocal}
                        disabled={loading}
                        title="Scan lokale mappen voor repositories"
                        className="text-[10px] text-slate-500 font-bold hover:text-blue-600 flex items-center gap-1 transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">folder_shared</span>
                        Scan Lokaal
                      </button>
                      <button 
                        onClick={handleFetchGhRepos}
                        disabled={loading}
                        title="Scan GitHub voor meer repositories"
                        className="text-[10px] text-blue-600 font-bold hover:underline flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-sm">cloud_sync</span>
                        Scan GitHub
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {matchedCompany.repositories.map((repoUrl: string, idx: number) => {
                      const parts = repoUrl.split('/');
                      const name = (parts[parts.length - 1] || 'repo').replace('.git', '');
                      const isCurrent = result.originUrl === repoUrl;
                      
                      return (
                        <div key={idx} className={`p-3 rounded-xl border flex items-center justify-between transition-all ${isCurrent ? 'bg-slate-900 border-slate-950 shadow-md' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                          <div className="flex items-center gap-3 min-w-0">
                            <span className={`material-symbols-outlined text-lg ${isCurrent ? 'text-blue-400' : 'text-slate-400'}`}>
                              {isCurrent ? 'radio_button_checked' : 'account_tree'}
                            </span>
                            <div className="truncate">
                              <h4 className={`text-[11px] font-bold truncate ${isCurrent ? 'text-white' : 'text-slate-700'}`}>{name}</h4>
                              <p className={`text-[9px] truncate font-mono opacity-50 ${isCurrent ? 'text-slate-300' : 'text-slate-400'}`}>{repoUrl}</p>
                            </div>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <button 
                              onClick={() => handleSyncRepo(repoUrl, matchedCompany)}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all active:scale-90 ${isCurrent ? 'bg-blue-500 hover:bg-blue-400 text-white' : 'bg-slate-50 hover:bg-slate-100 text-slate-500'}`}
                              title={isCurrent ? "Sync Current" : "Clone/Pull Repository"}
                            >
                              <span className="material-symbols-outlined text-base">
                                {isCurrent ? 'sync' : 'cloud_download'}
                              </span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  <button 
                    onClick={() => {
                      setIsOpen(true);
                      // Custom loop for all repos could go here, but reuse the core sync logic
                      matchedCompany.repositories.forEach((url: string) => handleSyncRepo(url, matchedCompany));
                    }}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-slate-200 active:scale-[0.98]"
                  >
                    Sync Volledige Workspace
                  </button>
                </div>
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

function DiagnosticCard({ 
  status, 
  title, 
  description, 
  current, 
  expected, 
  onFix,
  fixLabel = "Fix Automatisch"
}: { 
  status: 'ok' | 'warning' | 'error', 
  title: string, 
  description: string, 
  current?: string, 
  expected?: string, 
  onFix?: () => void,
  fixLabel?: string
}) {
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
          
          {status !== 'ok' && onFix && (
            <div className="mt-4 flex justify-end">
              <button 
                onClick={onFix}
                className={`text-[10px] px-6 py-2.5 rounded-xl font-black font-headline tracking-widest uppercase transition-all shadow-sm active:scale-95 border ${
                isError 
                  ? 'bg-red-600 text-white border-red-600 hover:bg-red-700 shadow-red-600/20' 
                  : 'bg-amber-600 text-white border-amber-600 hover:bg-amber-700 shadow-amber-600/20'
              }`}>
                {fixLabel}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
