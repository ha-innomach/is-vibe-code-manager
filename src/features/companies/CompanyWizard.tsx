import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import TerminalHelper from '../../components/TerminalHelper';

export default function CompanyWizard({ onCancel, initialData }: { onCancel?: () => void, initialData?: any }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const isEditing = !!initialData;
  
  const [formData, setFormData] = useState(initialData || {
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
    <div className="animate-fade-in flex flex-col h-full max-w-4xl mx-auto w-full space-y-6">
      <div className="flex items-center gap-4">
        <button 
          onClick={onCancel} 
          className="w-10 h-10 rounded-full flex items-center justify-center bg-surface-container-low hover:bg-surface-bright/50 text-on-surface-variant hover:text-on-surface transition-all border border-outline-variant/10"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h2 className="text-3xl font-extrabold font-headline tracking-tight text-on-surface">
          {isEditing ? `Bewerk Context: ${initialData.displayName}` : 'Nieuwe Bedrijfscontext Toevoegen'}
        </h2>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between px-10 py-10 relative bg-white rounded-3xl border border-outline-variant shadow-sm">
        <div className="absolute top-[3.75rem] left-20 right-20 h-0.5 bg-slate-100 -z-0" />
        <StepIndicator active={step >= 1} current={step === 1} icon="business" title="Basis Info" />
        <StepIndicator active={step >= 2} current={step === 2} icon="merge" title="Git Config" />
        <StepIndicator active={step >= 3} current={step === 3} icon="dns" title="SSH & Bron" />
        <StepIndicator active={step >= 4} current={step === 4} icon="rocket_launch" title="Deployment" />
        <StepIndicator active={step >= 5} current={step === 5} icon="task_alt" title="Overzicht" />
      </div>

      {/* Forms Area */}
      <div className="flex-1 bg-white rounded-3xl border border-outline-variant shadow-xl flex flex-col min-h-[600px] overflow-hidden">
        <div className="flex-1 overflow-y-auto p-12">
        {step === 1 && (
          <div className="animate-fade-in space-y-8 relative z-10">
            <h3 className="text-2xl font-bold font-headline text-on-surface flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-3xl">business_center</span>
              Bedrijfsgegevens
            </h3>
            <div className="space-y-6 max-w-xl">
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
                <label className="block text-xs font-label uppercase tracking-widest text-on-surface-variant mb-2 pl-1">Bedrijfs-ID (Gebruikt voor bestandsnamen)</label>
                <input 
                  type="text" 
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value.toLowerCase().replace(/\s/g, '-') })}
                  className="w-full bg-slate-50 border border-outline-variant rounded-xl px-5 py-3 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 text-on-surface transition-all font-body placeholder:text-outline/50" 
                  placeholder="bijv. acme" 
                />
              </div>
              <div>
                <label className="block text-xs font-label uppercase tracking-widest text-on-surface-variant mb-2 pl-1">Workspace Root Map</label>
                <div className="flex gap-3">
                  <input 
                    type="text" 
                    value={formData.workspaceRoots[0]}
                    onChange={(e) => setFormData({ ...formData, workspaceRoots: [e.target.value] })}
                    className="flex-1 bg-slate-50 border border-outline-variant rounded-xl px-5 py-3 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 text-on-surface transition-all font-body placeholder:text-outline/50" 
                    placeholder="~/Projects/acme" 
                  />
                  <button 
                    onClick={handleBrowseWorkspaceRoot}
                    className="px-6 py-3 bg-white hover:bg-slate-50 text-on-surface rounded-xl font-headline font-black transition-all border border-outline-variant shadow-sm active:scale-95"
                  >
                    Bladeren...
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="animate-fade-in space-y-8 relative z-10">
            <h3 className="text-2xl font-bold font-headline text-on-surface flex items-center gap-3">
              <span className="material-symbols-outlined text-secondary text-3xl">badge</span>
              Git Identiteit
            </h3>
            <p className="text-on-surface-variant">Deze auteur-identiteit wordt strikt afgedwongen voor alle repositories binnen de workspace root.</p>
            <div className="space-y-6 max-w-xl">
              <div>
                <label className="block text-xs font-label uppercase tracking-widest text-on-surface-variant mb-2 pl-1">Naam Auteur</label>
                <input 
                  type="text" 
                  value={formData.git.userName}
                  onChange={(e) => updateNested('git.userName', e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-5 py-3 outline-none focus:border-secondary focus:ring-1 focus:ring-secondary text-on-surface transition-all font-body placeholder:text-outline" 
                  placeholder="Hans Anton" 
                />
              </div>
              <div>
                <label className="block text-xs font-label uppercase tracking-widest text-on-surface-variant mb-2 pl-1">E-mail Auteur</label>
                <input 
                  type="email" 
                  value={formData.git.userEmail}
                  onChange={(e) => updateNested('git.userEmail', e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-5 py-3 outline-none focus:border-secondary focus:ring-1 focus:ring-secondary text-on-surface transition-all font-body placeholder:text-outline" 
                  placeholder="hans@acme.com" 
                />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="animate-fade-in space-y-8 relative z-10">
            <h3 className="text-2xl font-bold font-headline text-on-surface flex items-center gap-3">
              <span className="material-symbols-outlined text-tertiary text-3xl">key</span>
              SSH Configuratie
            </h3>
            <div className="space-y-6 max-w-xl">
              <div>
                <label className="block text-xs font-label uppercase tracking-widest text-on-surface-variant mb-1 pl-1">GitHub Host Alias</label>
                <p className="text-xs text-outline mb-3 pl-1">Gebruikt in remote URL's (bijv. git@github-acme:acme/repo.git)</p>
                <input 
                  type="text" 
                  value={formData.github.hostAlias}
                  onChange={(e) => updateNested('github.hostAlias', e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-5 py-3 outline-none focus:border-tertiary focus:ring-1 focus:ring-tertiary text-on-surface transition-all font-mono text-sm placeholder:text-outline" 
                  placeholder="github-acme" 
                />
              </div>
              <div>
                <label className="block text-xs font-label uppercase tracking-widest text-on-surface-variant mb-2 pl-1">Pad naar SSH Sleutel</label>
                <div className="flex gap-3">
                  <input 
                    type="text" 
                    value={formData.github.sshKeyPath}
                    onChange={(e) => updateNested('github.sshKeyPath', e.target.value)}
                    className="flex-1 bg-surface-container-low border border-outline-variant/20 rounded-xl px-5 py-3 outline-none focus:border-tertiary focus:ring-1 focus:ring-tertiary text-on-surface transition-all font-mono text-sm placeholder:text-outline" 
                    placeholder="~/.ssh/id_ed25519_acme" 
                  />
                  <button 
                    onClick={handleBrowseSshKey}
                    className="px-6 py-3 bg-surface-bright hover:bg-surface-bright/80 text-on-surface rounded-xl font-headline font-bold transition-all border border-outline-variant/20"
                  >
                    Bladeren...
                  </button>
                </div>
              </div>
              
              <div className="pt-6 border-t border-outline-variant/10">
                <label className="block text-xs font-label uppercase tracking-widest text-on-surface-variant mb-2 pl-1">Git Repositories (URLs)</label>
                <p className="text-xs text-outline mb-4 font-medium pl-1">Voeg Git URLs toe om ze direct te kunnen clonen in de juiste context.</p>
                <div className="space-y-3">
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
                        className="flex-1 bg-slate-50 border border-outline-variant rounded-xl px-4 py-2 outline-none focus:border-primary text-on-surface font-mono text-xs" 
                        placeholder="git@github.com:org/repo.git" 
                      />
                      <button 
                        onClick={() => {
                          const newRepos = formData.repositories.filter((_: any, i: number) => i !== idx);
                          setFormData({ ...formData, repositories: newRepos });
                        }}
                        className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <span className="material-symbols-outlined">delete</span>
                      </button>
                    </div>
                  ))}
                  <button 
                    onClick={() => setFormData({ ...formData, repositories: [...(formData.repositories || []), ''] })}
                    className="flex items-center gap-2 px-4 py-2 text-[11px] font-bold text-primary hover:bg-primary/5 rounded-xl transition-all"
                  >
                    <span className="material-symbols-outlined text-sm">add</span>
                    URL Toevoegen
                  </button>
                </div>
              </div>

              <div className="pt-8 border-t border-outline-variant/10">
                <h4 className="text-sm font-bold font-headline text-on-surface flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-secondary text-lg">info</span>
                  Nog geen SSH-sleutel voor dit bedrijf?
                </h4>
                <TerminalHelper 
                  label="Genereer nieuwe ED25519 sleutel"
                  command={`ssh-keygen -t ed25519 -C "${formData.git.userEmail || 'email@example.com'}" -f ~/.ssh/id_ed25519_${formData.id || 'company'}`}
                />
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="animate-fade-in space-y-8 relative z-10">
            <h3 className="text-2xl font-bold font-headline text-on-surface flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-3xl">rocket_launch</span>
              Deployment Doel (Optioneel)
            </h3>
            <p className="text-on-surface-variant">Configureer waar je code naartoe gaat. We genereren extra SSH aliases voor snelle toegang.</p>
            
            <div className="space-y-6 max-w-xl">
              <div className="flex gap-4">
                <button 
                  onClick={() => setFormData({ ...formData, deployments: [{ kind: 'vps', host: '', username: 'root', port: 22, sshKeyPath: formData.github.sshKeyPath, isProvisioned: false }] })}
                  className={`flex-1 p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${formData.deployments[0]?.kind === 'vps' ? 'border-primary bg-primary/5' : 'border-outline-variant bg-white opacity-60'}`}
                >
                  <span className="material-symbols-outlined text-2xl">dns</span>
                  <span className="text-xs font-black uppercase tracking-widest">Eigen VPS</span>
                </button>
                <button 
                  onClick={() => setFormData({ ...formData, deployments: [{ kind: 'vercel', host: 'vercel.app', username: 'owner', port: 443, sshKeyPath: '', isProvisioned: true, projectId: '' }] })}
                  className={`flex-1 p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${formData.deployments[0]?.kind === 'vercel' ? 'border-primary bg-primary/5' : 'border-outline-variant bg-white opacity-60'}`}
                >
                  <span className="material-symbols-outlined text-2xl">cloud</span>
                  <span className="text-xs font-black uppercase tracking-widest">Vercel</span>
                </button>
              </div>

              {formData.deployments[0]?.kind === 'vps' && (
                <div className="space-y-6 animate-fade-in pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-label uppercase tracking-widest text-on-surface-variant mb-2 pl-1">Server IP / DNS</label>
                      <input 
                        type="text" 
                        value={formData.deployments[0].host}
                        onChange={(e) => updateNested('deployments.0.host', e.target.value)}
                        className="w-full bg-slate-50 border border-outline-variant rounded-xl px-5 py-3 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 text-on-surface transition-all font-mono text-sm" 
                        placeholder="1.2.3.4" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-label uppercase tracking-widest text-on-surface-variant mb-2 pl-1">Gebruikersnaam</label>
                      <input 
                        type="text" 
                        value={formData.deployments[0].username}
                        onChange={(e) => updateNested('deployments.0.username', e.target.value)}
                        className="w-full bg-slate-50 border border-outline-variant rounded-xl px-5 py-3 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 text-on-surface transition-all font-mono text-sm" 
                        placeholder="root" 
                      />
                    </div>
                  </div>

                  <div className="pt-6 border-t border-outline-variant/10">
                    <h4 className="text-sm font-black font-headline text-on-surface flex items-center gap-2 mb-2">
                      <span className="material-symbols-outlined text-secondary text-xl">security</span>
                      Inloggen met Root & Wachtwoord?
                    </h4>
                    <p className="text-xs text-on-surface-variant mb-4 font-medium">Zet de login om naar een veilige SSH-sleutel verbinding door je publieke sleutel eenmalig over te zetten.</p>
                    
                    <TerminalHelper 
                      label="SSH-sleutel overzetten naar server"
                      command={`ssh-copy-id -i ${formData.github.sshKeyPath}.pub ${formData.deployments[0].username}@${formData.deployments[0].host || '[IP]'}`}
                    />
                    
                    <label className="flex items-center gap-3 mt-6 cursor-pointer group">
                      <input 
                        type="checkbox" 
                        checked={formData.deployments[0].isProvisioned}
                        onChange={(e) => updateNested('deployments.0.isProvisioned', e.target.checked)}
                        className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary"
                      />
                      <span className="text-sm font-bold text-on-surface group-hover:text-primary transition-colors">Sleutel succesvol overgezet naar server</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="animate-fade-in space-y-8 relative z-10">
            <h3 className="text-2xl font-bold font-headline text-on-surface flex items-center gap-3">
              <span className="material-symbols-outlined text-primary-fixed text-3xl">done_all</span>
              Overzicht
            </h3>
            <div className="bg-slate-50 border border-outline-variant rounded-2xl p-8 font-mono text-sm text-on-surface-variant space-y-5 max-w-2xl relative overflow-hidden shadow-inner">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl"></div>
              
              <div className="flex items-start gap-4">
                <span className="text-primary mt-0.5">▪</span>
                <div><span className="text-outline uppercase tracking-widest text-xs block mb-1">Bedrijf</span><span className="text-on-surface">{formData.displayName || 'Naamloos'} ({formData.id || 'geen-id'})</span></div>
              </div>
              <div className="flex items-start gap-4">
                <span className="text-primary mt-0.5">▪</span>
                <div><span className="text-outline uppercase tracking-widest text-xs block mb-1">Workspace</span><span className="text-on-surface">{formData.workspaceRoots[0] || 'Niet opgegeven'}</span></div>
              </div>
              <div className="flex items-start gap-4">
                <span className="text-secondary mt-0.5">▪</span>
                <div><span className="text-outline uppercase tracking-widest text-xs block mb-1">Git ID</span><span className="text-on-surface">{formData.git.userName || 'Anoniem'} &lt;{formData.git.userEmail || 'geen-email'}&gt;</span></div>
              </div>
              <div className="flex items-start gap-4">
                <span className="text-tertiary mt-0.5">▪</span>
                <div><span className="text-outline uppercase tracking-widest text-xs block mb-1">Host Alias</span><span className="text-on-surface">{formData.github.hostAlias || 'Niet opgegeven'}</span></div>
              </div>
              {formData.deployments.length > 0 && (
                <div className="flex items-start gap-4">
                  <span className="text-primary mt-0.5">▪</span>
                  <div>
                    <span className="text-outline uppercase tracking-widest text-xs block mb-1">Deployment</span>
                    <span className="text-on-surface">
                      {formData.deployments[0].kind.toUpperCase()} @ {formData.deployments[0].host}
                      {!formData.deployments[0].isProvisioned && ' (Wacht op SSH Setup)'}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <p className="text-sm text-on-surface-variant max-w-2xl leading-relaxed">Klik op <strong className="text-on-surface">Afronden</strong> om deze context op te slaan. Wij berekenen de configuratiewijzigingen die je kunt bekijken en toepassen in het 'Toepassen' scherm.</p>
          </div>
        )}

        </div>
        
        {/* Navigation */}
        <div className="px-10 py-8 bg-slate-50 border-t border-outline-variant flex justify-between z-20">
          <button 
            onClick={() => setStep(s => Math.max(1, s - 1))}
            disabled={loading}
            className={`px-10 py-3 bg-white hover:bg-slate-100 text-on-surface rounded-xl font-headline font-black transition-all border border-outline-variant shadow-sm active:scale-95 ${step === 1 ? 'opacity-0 pointer-events-none' : ''}`}
          >
            Terug
          </button>
          
          <button 
            onClick={nextStep}
            disabled={loading}
            className={`flex items-center gap-3 px-10 py-3 bg-primary text-white font-black font-headline rounded-xl shadow-lg shadow-primary/20 hover:bg-primary-dim transition-all hover:scale-[1.02] active:scale-95 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {loading ? 'Verwerken...' : step === 5 ? 'Afronden' : 'Doorgaan'}
            {!loading && step !== 5 && <span className="material-symbols-outlined text-xl">arrow_forward</span>}
          </button>
        </div>
      </div>
    </div>
  );
}

function StepIndicator({ active, current, icon, title }: { active: boolean, current: boolean, icon: string, title: string }) {
  return (
    <div className="flex flex-col items-center gap-4 z-10 w-28">
      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-500 z-10
        ${current ? 'bg-primary text-white shadow-xl shadow-primary/30 scale-110' : 
          active ? 'bg-[#f0f7ff] border border-primary/20 text-primary' : 
          'bg-white border border-outline-variant text-outline/50'}`
      }>
        <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: current || active ? "'FILL' 1" : "'FILL' 0" }}>{icon}</span>
      </div>
      <span className={`text-[10px] font-black uppercase tracking-[0.2em] text-center ${current ? 'text-primary' : active ? 'text-on-surface' : 'text-outline/40'}`}>
        {title}
      </span>
    </div>
  );
}
