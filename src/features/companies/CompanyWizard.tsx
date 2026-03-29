import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import TerminalHelper from '../../components/TerminalHelper';

export default function CompanyWizard({ onCancel, initialData }: { onCancel?: () => void, initialData?: any }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const isEditing = !!initialData;
  
  const [formData, setFormData] = useState(() => {
    const defaults = {
      id: '',
      displayName: '',
      workspaceRoots: [''],
      git: {
        userName: '',
        userEmail: '',
      },
      github: {
        username: '',
        hostAlias: '',
        sshKeyPath: '',
        cloneProtocol: 'ssh'
      },
      env: {
        provider: 'direnv',
        defaults: {}
      },
      deployments: [] as any[],
      repositories: [] as string[]
    };

    if (!initialData) return defaults;

    return {
      ...defaults,
      ...initialData,
      git: { ...defaults.git, ...(initialData.git || {}) },
      github: { ...defaults.github, ...(initialData.github || {}) },
      // Ensure arrays exist even if not in initialData
      workspaceRoots: initialData.workspaceRoots || defaults.workspaceRoots,
      deployments: initialData.deployments || defaults.deployments,
      repositories: initialData.repositories || defaults.repositories
    };
  });

  const updateNested = (path: string, value: any) => {
    const keys = path.split('.');
    setFormData((prev: any) => {
      const next = { ...prev };
      let current: any = next;
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      return next;
    });
  };

  const handleBrowseWorkspaceRoot = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });
      if (selected && typeof selected === 'string') {
        setFormData({ ...formData, workspaceRoots: [selected] });
      }
    } catch (err) {
      console.error('Failed to open directory dialog:', err);
    }
  };

  const handleBrowseSshKey = async () => {
    try {
      const homeDir: string = await invoke('get_home_dir');
      const selected = await open({
        directory: false,
        multiple: false,
        defaultPath: homeDir ? `${homeDir}/.ssh/` : undefined
      });
      if (selected && typeof selected === 'string') {
        updateNested('github.sshKeyPath', selected);
      }
    } catch (err) {
      console.error('Failed to open file dialog:', err);
      // Fallback if invoke fails
      try {
        const selected = await open({
          directory: false,
          multiple: false,
        });
        if (selected && typeof selected === 'string') {
          updateNested('github.sshKeyPath', selected);
        }
      } catch (innerErr) {
        console.error('Final fallback failed:', innerErr);
      }
    }
  };



  const handleFinish = async () => {
    setLoading(true);
    try {
      const currentConfig: any = await invoke('get_config');
      let updatedCompanies = [...currentConfig.companies];
      
      if (isEditing) {
        // Find by original ID or some other identifier? Assuming ID for now.
        const index = updatedCompanies.findIndex(c => c.id === initialData.id);
        if (index !== -1) {
          updatedCompanies[index] = formData;
        } else {
          updatedCompanies.push(formData);
        }
      } else {
        updatedCompanies.push(formData);
      }

      const updatedConfig = {
        ...currentConfig,
        companies: updatedCompanies
      };
      await invoke('save_config', { newConfig: updatedConfig });
      if (onCancel) onCancel();
    } catch (err) {
      console.error('Failed to save company:', err);
      alert('Error saving configuration.');
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (step === 5) {
      handleFinish();
    } else {
      setStep(s => s + 1);
    }
  };

  return (
    <div className="animate-fade-in flex flex-col h-full max-w-4xl mx-auto w-full space-y-3">
      <div className="flex items-center gap-3">
        <button 
          onClick={onCancel} 
          className="w-8 h-8 rounded-full flex items-center justify-center bg-surface-container-low hover:bg-surface-bright/50 text-on-surface-variant hover:text-on-surface transition-all border border-outline-variant/10"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
        </button>
        <h2 className="text-xl font-extrabold font-headline tracking-tight text-on-surface">
          {isEditing ? `Bewerk Context: ${initialData.displayName}` : 'Nieuwe Bedrijfscontext'}
        </h2>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between px-12 py-3 relative bg-white rounded-2xl border border-outline-variant shadow-sm">
        <div className="absolute top-[2.25rem] left-20 right-20 h-0.5 bg-slate-100 -z-0" />
        <StepIndicator active={step >= 1} current={step === 1} icon="business" title="Basis" />
        <StepIndicator active={step >= 2} current={step === 2} icon="merge" title="Git" />
        <StepIndicator active={step >= 3} current={step === 3} icon="dns" title="SSH" />
        <StepIndicator active={step >= 4} current={step === 4} icon="rocket_launch" title="Deploy" />
        <StepIndicator active={step >= 5} current={step === 5} icon="task_alt" title="Klaar" />
      </div>

      {/* Forms Area */}
      <div className="flex-1 bg-white rounded-2xl border border-outline-variant shadow-lg flex flex-col overflow-hidden min-h-0">
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        {step === 1 && (
          <div className="animate-fade-in space-y-5 relative z-10">
            <h3 className="text-lg font-bold font-headline text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">business_center</span>
              Bedrijfsgegevens
            </h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 max-w-3xl">
              <div>
                <label className="block text-xs font-label uppercase tracking-widest text-on-surface-variant mb-2 pl-1">Weergavenaam</label>
                <input 
                  type="text" 
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  className="w-full bg-slate-50 border border-outline-variant rounded-xl px-5 py-3 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 text-on-surface transition-all font-body placeholder:text-outline/50" 
                  placeholder="bijv. Acme Corp" 
                />
              </div>
              <div>
                <label className="block text-[10px] font-label uppercase tracking-widest text-on-surface-variant mb-1 pl-1">Bedrijfs-ID</label>
                <input 
                  type="text" 
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value.toLowerCase().replace(/\s/g, '-') })}
                  className="w-full bg-slate-50 border border-outline-variant rounded-lg px-3 py-2 outline-none focus:border-primary text-sm transition-all" 
                  placeholder="bijv. acme" 
                />
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] font-label uppercase tracking-widest text-on-surface-variant mb-1 pl-1">Workspace Root Map</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={formData.workspaceRoots[0]}
                    onChange={(e) => setFormData({ ...formData, workspaceRoots: [e.target.value] })}
                    className="flex-1 bg-slate-50 border border-outline-variant rounded-lg px-3 py-2 outline-none focus:border-primary text-sm transition-all font-mono" 
                    placeholder="~/Projects/acme" 
                  />
                  <button 
                    onClick={handleBrowseWorkspaceRoot}
                    className="px-4 py-2 bg-white hover:bg-slate-50 text-on-surface rounded-lg font-bold text-xs transition-all border border-outline-variant shadow-sm active:scale-95"
                  >
                    Bladeren...
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="animate-fade-in space-y-5 relative z-10">
            <h3 className="text-lg font-bold font-headline text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-xl">badge</span>
              Git Identiteit
            </h3>
            <p className="text-[12px] text-on-surface-variant leading-relaxed">Deze auteur-identiteit wordt strikt afgedwongen voor alle repositories binnen de workspace root.</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 max-w-3xl">
              <div>
                <label className="block text-[10px] font-label uppercase tracking-widest text-on-surface-variant mb-1 pl-1">Naam Auteur</label>
                <input 
                  type="text" 
                  value={formData.git.userName}
                  onChange={(e) => updateNested('git.userName', e.target.value)}
                  className="w-full bg-slate-50 border border-outline-variant/30 rounded-lg px-3 py-2 outline-none focus:border-secondary text-sm transition-all" 
                  placeholder="Hans Anton" 
                />
              </div>
              <div>
                <label className="block text-[10px] font-label uppercase tracking-widest text-on-surface-variant mb-1 pl-1">E-mail Auteur</label>
                <input 
                  type="email" 
                  value={formData.git.userEmail}
                  onChange={(e) => updateNested('git.userEmail', e.target.value)}
                  className="w-full bg-slate-50 border border-outline-variant/30 rounded-lg px-3 py-2 outline-none focus:border-secondary text-sm transition-all" 
                  placeholder="hans@acme.com" 
                />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="animate-fade-in space-y-5 relative z-10">
            <h3 className="text-lg font-bold font-headline text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-tertiary text-xl">key</span>
              SSH Configuratie
            </h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 max-w-3xl">
              <div>
                <label className="block text-[10px] font-label uppercase tracking-widest text-on-surface-variant mb-1 pl-1">GitHub Host Alias</label>
                <input 
                  type="text" 
                  value={formData.github.hostAlias}
                  onChange={(e) => updateNested('github.hostAlias', e.target.value)}
                  className="w-full bg-slate-50 border border-outline-variant/30 rounded-lg px-3 py-2 outline-none focus:border-tertiary text-xs transition-all font-mono" 
                  placeholder="github-acme" 
                />
              </div>
              <div>
                <label className="block text-[10px] font-label uppercase tracking-widest text-on-surface-variant mb-1 pl-1">Pad naar SSH Sleutel</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={formData.github.sshKeyPath}
                    onChange={(e) => updateNested('github.sshKeyPath', e.target.value)}
                    className="flex-1 bg-slate-50 border border-outline-variant/30 rounded-lg px-3 py-2 outline-none focus:border-tertiary text-xs transition-all font-mono" 
                    placeholder="~/.ssh/id_ed25519_acme" 
                  />
                  <button 
                    onClick={handleBrowseSshKey}
                    className="px-3 py-2 bg-white hover:bg-slate-50 text-on-surface rounded-lg font-bold text-xs transition-all border border-outline-variant/30 shadow-sm"
                  >
                    ...
                  </button>
                </div>
              </div>
              
              <div className="col-span-2 pt-4 border-t border-outline-variant/10">
                <label className="block text-[10px] font-label uppercase tracking-widest text-on-surface-variant mb-1 pl-1">Git Repositories (URLs)</label>
                <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar pr-2">
                  {(formData.repositories || []).map((repo: string, idx: number) => (
                    <div key={idx} className="flex gap-2">
                      <input 
                        type="text" 
                        value={repo}
                        onChange={(e) => {
                          const newRepos = [...formData.repositories];
                          newRepos[idx] = e.target.value;
                          setFormData({ ...formData, repositories: newRepos });
                        }}
                        className="flex-1 bg-slate-50/50 border border-outline-variant/30 rounded-lg px-3 py-1.5 outline-none focus:border-primary text-xs font-mono" 
                        placeholder="git@github.com:org/repo.git" 
                      />
                      <button 
                        onClick={() => {
                          const newRepos = formData.repositories.filter((_: any, i: number) => i !== idx);
                          setFormData({ ...formData, repositories: newRepos });
                        }}
                        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                      </button>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={() => setFormData({ ...formData, repositories: [...(formData.repositories || []), ''] })}
                  className="flex items-center gap-1.5 mt-2 px-3 py-1.5 text-[10px] font-bold text-primary hover:bg-primary/5 rounded-lg transition-all"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                  URL Toevoegen
                </button>
              </div>

              <div className="col-span-2 pt-4 border-t border-outline-variant/10">
                <h4 className="text-xs font-bold font-headline text-on-surface flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-secondary text-base">info</span>
                  Nieuwe SSH-sleutel nodig?
                </h4>
                <TerminalHelper 
                  label="Genereer sleutel"
                  command={`ssh-keygen -t ed25519 -C "${formData.git.userEmail || 'email@example.com'}" -f ~/.ssh/id_ed25519_${formData.id || 'company'}`}
                />
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="animate-fade-in space-y-5 relative z-10">
            <h3 className="text-lg font-bold font-headline text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">rocket_launch</span>
              Deployment (Optioneel)
            </h3>
            
            <div className="grid grid-cols-2 gap-4 max-w-xl">
              <button 
                onClick={() => setFormData({ ...formData, deployments: [{ kind: 'vps', host: '', username: 'root', port: 22, sshKeyPath: formData.github.sshKeyPath, isProvisioned: false }] })}
                className={`p-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${formData.deployments[0]?.kind === 'vps' ? 'border-primary bg-primary/5' : 'border-outline-variant bg-white opacity-60'}`}
              >
                <span className="material-symbols-outlined text-lg">dns</span>
                <span className="text-[10px] font-black uppercase tracking-widest">Eigen VPS</span>
              </button>
              <button 
                onClick={() => setFormData({ ...formData, deployments: [{ kind: 'vercel', host: 'vercel.app', username: 'owner', port: 443, sshKeyPath: '', isProvisioned: true, projectId: '' }] })}
                className={`p-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${formData.deployments[0]?.kind === 'vercel' ? 'border-primary bg-primary/5' : 'border-outline-variant bg-white opacity-60'}`}
              >
                <span className="material-symbols-outlined text-lg">cloud</span>
                <span className="text-[10px] font-black uppercase tracking-widest">Vercel</span>
              </button>
            </div>

            {formData.deployments[0]?.kind === 'vps' && (
              <div className="space-y-4 animate-fade-in pt-4 border-t border-outline-variant/10 max-w-2xl">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-label uppercase tracking-widest text-on-surface-variant mb-1 pl-1">Server IP / DNS</label>
                    <input 
                      type="text" 
                      value={formData.deployments[0]?.host || ''}
                      onChange={(e) => updateNested('deployments.0.host', e.target.value)}
                      className="w-full bg-slate-50 border border-outline-variant/30 rounded-lg px-3 py-2 outline-none focus:border-primary text-xs font-mono" 
                      placeholder="1.2.3.4" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-label uppercase tracking-widest text-on-surface-variant mb-1 pl-1">Gebruiker</label>
                    <input 
                      type="text" 
                      value={formData.deployments[0]?.username || ''}
                      onChange={(e) => updateNested('deployments.0.username', e.target.value)}
                      className="w-full bg-slate-50 border border-outline-variant/30 rounded-lg px-3 py-2 outline-none focus:border-primary text-xs font-mono" 
                      placeholder="root" 
                    />
                  </div>
                </div>

                <div className="pt-3">
                  <h4 className="text-[11px] font-bold text-on-surface flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-secondary text-base">security</span>
                    Sleutel overzetten
                  </h4>
                  <TerminalHelper 
                    label="ssh-copy-id"
                    command={`ssh-copy-id -i ${formData.github.sshKeyPath}.pub ${formData.deployments[0].username}@${formData.deployments[0].host || '[IP]'}`}
                  />
                  
                  <label className="flex items-center gap-2 mt-3 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      checked={formData.deployments[0]?.isProvisioned || false}
                      onChange={(e) => updateNested('deployments.0.isProvisioned', e.target.checked)}
                      className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary"
                    />
                    <span className="text-[11px] font-bold text-on-surface-variant group-hover:text-primary transition-colors">Sleutel succesvol overgezet</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 5 && (
          <div className="animate-fade-in space-y-5 relative z-10">
            <h3 className="text-lg font-bold font-headline text-on-surface flex items-center gap-3">
              <span className="material-symbols-outlined text-primary-fixed text-xl">done_all</span>
              Klaar voor gebruik
            </h3>
            <div className="bg-slate-50 border border-outline-variant rounded-xl p-6 font-mono text-xs text-on-surface-variant space-y-3 max-w-2xl relative overflow-hidden shadow-inner">
              <div className="flex items-start gap-4">
                <span className="text-primary mt-0.5">▪</span>
                <div><span className="text-outline uppercase tracking-widest text-[9px] block mb-0.5">Bedrijf</span><span className="text-on-surface font-bold">{formData.displayName || 'Naamloos'} ({formData.id})</span></div>
              </div>
              <div className="flex items-start gap-4">
                <span className="text-primary mt-0.5">▪</span>
                <div><span className="text-outline uppercase tracking-widest text-[9px] block mb-0.5">Workspace</span><span className="text-on-surface font-bold">{formData.workspaceRoots[0]}</span></div>
              </div>
              <div className="flex items-start gap-4">
                <span className="text-secondary mt-0.5">▪</span>
                <div><span className="text-outline uppercase tracking-widest text-[9px] block mb-0.5">Git ID</span><span className="text-on-surface font-bold">{formData.git.userName} &lt;{formData.git.userEmail}&gt;</span></div>
              </div>
              <div className="flex items-start gap-4">
                <span className="text-tertiary mt-0.5">▪</span>
                <div><span className="text-outline uppercase tracking-widest text-[9px] block mb-0.5">Host Alias</span><span className="text-on-surface font-bold">{formData.github.hostAlias}</span></div>
              </div>
            </div>
            <p className="text-[12px] text-on-surface-variant max-w-2xl leading-relaxed">Klik op <strong className="text-on-surface font-bold">Afronden</strong> om deze context op te slaan. Wij berekenen de configuratiewijzigingen die je kunt bekijken en toepassen in het 'Toepassen' scherm.</p>
          </div>
        )}

        </div>
      </div>
        
      {/* Navigation */}
      <div className="px-8 py-4 bg-slate-50 border-t border-outline-variant flex justify-between z-20">
        <button 
          onClick={() => setStep(s => Math.max(1, s - 1))}
          disabled={loading}
          className={`px-6 py-2 bg-white hover:bg-slate-100 text-on-surface rounded-lg font-bold text-xs transition-all border border-outline-variant shadow-sm active:scale-95 ${step === 1 ? 'opacity-0 pointer-events-none' : ''}`}
        >
          Terug
        </button>
        
        <button 
          onClick={nextStep}
          disabled={loading}
          className={`flex items-center gap-2 px-8 py-2 bg-blue-600 text-white font-bold text-xs rounded-lg shadow-md transition-all hover:bg-blue-700 active:scale-95 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {loading ? 'Verwerken...' : step === 5 ? 'Afronden' : 'Doorgaan'}
          {!loading && step !== 5 && <span className="material-symbols-outlined text-sm">arrow_forward</span>}
        </button>
      </div>
    </div>
  );
}

function StepIndicator({ active, current, icon, title }: { active: boolean, current: boolean, icon: string, title: string }) {
  return (
    <div className="flex flex-col items-center gap-2 z-10 w-20">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 z-10
        ${current ? 'bg-blue-600 text-white shadow-lg scale-105' : 
          active ? 'bg-blue-50 border border-blue-200 text-blue-600' : 
          'bg-white border border-outline-variant text-outline/30'}`
      }>
        <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: current || active ? "'FILL' 1" : "'FILL' 0" }}>{icon}</span>
      </div>
      <span className={`text-[8px] font-black uppercase tracking-[0.2em] text-center ${current ? 'text-blue-600' : active ? 'text-on-surface' : 'text-outline/30'}`}>
        {title}
      </span>
    </div>
  );
}
