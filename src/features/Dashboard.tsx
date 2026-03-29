import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';

const Dashboard = () => {
  const navigate = useNavigate();
  const [config, setConfig] = useState<any>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const data: any = await invoke('get_config');
        setConfig(data);
      } catch (err) {
        console.warn('Failed to fetch config for dashboard:', err);
      }
    };
    fetchConfig();
  }, []);

  const companies = config?.companies || [];
  const workspaceCount = companies.length;
  // Simple heuristic for "managed blocks": number of companies * 2 (SSH + Git)
  const managedBlocks = companies.length * 2;

  return (
    <div className="h-full overflow-y-auto p-6 scroll-smooth">
      <div className="space-y-6 animate-fade-in">
        {/* Page Header */}
        <div className="flex flex-col">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">Dashboard</h2>
          <p className="text-[11px] text-slate-500 font-medium opacity-70">Systeemstatus en actieve contexten.</p>
        </div>

        {/* Summary Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>verified_user</span>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Systeemstatus</p>
              <p className="text-sm font-bold text-slate-900">Optimaal</p>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600">
              <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>corporate_fare</span>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Contexten</p>
              <p className="text-sm font-bold text-slate-900">{workspaceCount} Actief</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600">
              <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>security</span>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Config Blokken</p>
              <p className="text-sm font-bold text-slate-900">{managedBlocks}</p>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Contexts List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[12px] font-bold text-slate-900 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-slate-400 text-lg">apartment</span>
                Recent Gebruikt
              </h3>
              <button 
                className="text-[10px] font-bold text-blue-600 hover:text-blue-700"
                onClick={() => navigate('/companies')}
              >
                Beheer Alles
              </button>
            </div>
            
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              {companies.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-[12px] text-slate-400 font-medium mb-3">Geen actieve contexten.</p>
                  <button 
                    onClick={() => navigate('/companies')}
                    className="px-4 py-1.5 bg-blue-600 text-white text-[11px] font-bold rounded shadow-sm hover:bg-blue-700 transition-all"
                  >
                    Configureer Nu
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {companies.slice(0, 4).map((comp: any) => (
                    <div 
                      key={comp.id}
                      className="p-3 hover:bg-slate-50 transition-colors cursor-pointer group flex items-center justify-between"
                      onClick={() => navigate('/companies')}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-all">
                          <span className="material-symbols-outlined text-lg">business</span>
                        </div>
                        <div>
                          <p className="text-[12px] font-bold text-slate-900 leading-tight">{comp.displayName}</p>
                          <p className="text-[10px] text-slate-500 opacity-60 leading-tight">{comp.git?.userEmail || 'Geen Git config'}</p>
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        {comp.deployments?.map((d: any, i: number) => (
                          <span key={i} className={`w-1.5 h-1.5 rounded-full ${d.isProvisioned ? 'bg-emerald-500' : 'bg-amber-400'} shadow-[0_0_5px_rgba(0,0,0,0.05)]`} title={d.kind}></span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* System Activity */}
          <div className="space-y-3">
            <h3 className="text-[12px] font-bold text-slate-900 flex items-center gap-1.5 px-1">
              <span className="material-symbols-outlined text-slate-400 text-lg">history</span>
              Activiteit
            </h3>
            <div className="bg-slate-50/50 border border-slate-200 rounded-xl p-4 h-full shadow-sm">
              <div className="space-y-4">
                <div className="relative pl-5 border-l-2 border-blue-500/20">
                  <div className="absolute -left-[5px] top-0 w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.3)]"></div>
                  <p className="text-[11px] font-bold text-slate-900 mb-0.5">Configuratie Geladen</p>
                  <p className="text-[10px] text-slate-500 leading-normal opacity-80">
                    {companies.length} contexten geactiveerd.
                  </p>
                  <span className="text-[9px] font-bold text-blue-500 uppercase tracking-widest mt-1 block">Systeem OK</span>
                </div>

                <div className="relative pl-5 border-l-2 border-slate-200">
                  <div className="absolute -left-[5px] top-0 w-2 h-2 rounded-full bg-slate-200"></div>
                  <p className="text-[11px] font-bold text-slate-400 mb-0.5">Stand-by</p>
                  <p className="text-[10px] text-slate-400 leading-normal">
                    Geen actieve sessie.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Tools Tray */}
        <div className="pt-2">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-3 px-1">Gereedschap</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <ToolLink icon="manage_search" label="Repo Inspectie" to="/repos" />
            <ToolLink icon="rocket_launch" label="Toepassen" to="/preview" />
            <ToolLink icon="health_and_safety" label="Dokter" to="/doctor" />
            <ToolLink icon="settings" label="Instellingen" to="/settings" />
          </div>
        </div>
      </div>
    </div>
  );
};

function ToolLink({ icon, label, to }: { icon: string, label: string, to: string }) {
  const navigate = useNavigate();
  return (
    <button 
      onClick={() => navigate(to)}
      className="flex items-center gap-3 p-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all active:scale-95 group text-left"
    >
      <div className={`p-2 rounded-lg bg-slate-100 group-hover:bg-blue-50 text-slate-400 group-hover:text-blue-500 transition-colors`}>
        <span className="material-symbols-outlined text-xl">{icon}</span>
      </div>
      <span className="text-xs font-bold text-slate-600 group-hover:text-slate-900 transition-colors">{label}</span>
    </button>
  );
}

export default Dashboard;
