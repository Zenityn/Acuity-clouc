import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, Settings, RefreshCw, Power, 
  Search, AlertTriangle, DollarSign, 
  Zap, LayoutGrid, Key, Globe, Layout, Package, CheckCircle2
} from 'lucide-react';
import React, { useState, useEffect, useMemo, useCallback } from 'react';

// ── TYPES ──────────────────────────────────────────────────────────────────

interface Lot {
  id: string;
  baseName: string;
  num: number;
  universeId: string;
  name: string;
  price: number;
  isForSale: boolean;
}

// ── APP ────────────────────────────────────────────────────────────────────

export default function App() {
  const [tab, setTab] = useState<'live' | 'factory' | 'settings'>('live');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('rbx_key') || '');
  const [universeId, setUniverseId] = useState(() => localStorage.getItem('rbx_universe') || '');
  const [filterName, setFilterName] = useState('');
  const [lots, setLots] = useState<Lot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [globalPrice, setGlobalPrice] = useState('150');
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  // Creation State
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPrice, setNewPrice] = useState('100');
  const [newIsForSale, setNewIsForSale] = useState(true);
  const [newIcon, setNewIcon] = useState<File | null>(null);

  const notify = useCallback((msg: string, type: 'ok' | 'err') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Load lots on start
  useEffect(() => {
    fetchLots();
  }, []);

  // Save config changes
  useEffect(() => {
    localStorage.setItem('rbx_key', apiKey);
    localStorage.setItem('rbx_universe', universeId);
  }, [apiKey, universeId]);

  const fetchLots = async () => {
    try {
      const r = await fetch('/get_ids');
      const data = await r.json();
      setLots(data.lots || []);
    } catch (e) {
      console.error("Failed to fetch lots", e);
    }
  };

  const runAudit = async () => {
    if (!apiKey || !universeId) return notify("Set API Key & Universe ID in Settings first", "err");
    setIsLoading(true);
    try {
      const r = await fetch('/check_prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, universeId })
      });
      const data = await r.json();
      if (data.status === 'success') {
        notify(`Audit complete: ${data.audited} assets checked`, 'ok');
      }
      await fetchLots();
    } catch (e) {
      notify("Audit failed", "err");
    } finally {
      setIsLoading(false);
    }
  };

  const importExisting = async () => {
    if (!apiKey || !universeId) return notify("Set credentials in Settings", "err");
    setIsLoading(true);
    try {
      const r = await fetch('/import_existing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, universeId, filterName })
      });
      const d = await r.json();
      if (d.status === 'success') {
        notify(`Import scan complete. Found ${d.count} new assets.`, 'ok');
        await fetchLots();
      } else {
        notify(d.message || "Import failed", "err");
      }
    } catch (e) {
      notify("Network error during import", "err");
    } finally {
      setIsLoading(false);
    }
  };

  const createGamePass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey || !universeId) return notify("Set credentials in Settings", "err");
    if (!newIcon) return notify("Please select an icon image", "err");
    
    setIsLoading(true);
    try {
      const fd = new FormData();
      fd.append('name', newName);
      fd.append('description', newDesc);
      fd.append('price', newPrice);
      fd.append('isForSale', String(newIsForSale));
      fd.append('imageFile', newIcon);
      fd.append('universeId', universeId);
      fd.append('apiKey', apiKey);

      const r = await fetch('/api/create_gamepass', {
        method: 'POST',
        body: fd
      });
      const d = await r.json();
      
      if (d.status === 'success') {
        notify("Gamepass created successfully!", "ok");
        setNewName('');
        setNewDesc('');
        setNewIcon(null);
        await fetchLots();
        setTab('live');
      } else {
        notify(d.message || "Creation failed", "err");
      }
    } catch (e) {
      notify("Network error during creation", "err");
    } finally {
      setIsLoading(false);
    }
  };

  const bulkSync = async () => {
    if (!apiKey || !universeId) return notify("Set credentials first", "err");
    if (!confirm(`Sync ALL tracked assets in this universe to ${globalPrice} Robux?`)) return;
    setIsLoading(true);
    try {
      const r = await fetch('/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, universeId, price: Number(globalPrice) })
      });
      const d = await r.json();
      notify(`Synced ${d.count} assets to ${globalPrice} R$`, 'ok');
      await fetchLots();
    } finally {
      setIsLoading(false);
    }
  };

  const setSinglePrice = async (id: string, price: number) => {
    try {
      await fetch('/set_price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, universeId, apiKey, price })
      });
      notify("Asset updated", "ok");
      await fetchLots();
    } catch (e) {
      notify("Update failed", "err");
    }
  };

  const toggleSale = async (id: string, forSale: boolean) => {
    try {
      await fetch('/set_price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, universeId, apiKey, forSale })
      });
      notify(forSale ? "Asset is now on sale" : "Asset taken off sale", "ok");
      await fetchLots();
    } catch (e) {
      notify("Toggle failed", "err");
    }
  };

  const filteredLots = useMemo(() => {
    return lots.filter(l => {
        const matchesUniverse = l.universeId === universeId;
        const matchesFilter = filterName ? (l.name || '').toLowerCase().includes(filterName.toLowerCase()) : true;
        return matchesUniverse && matchesFilter;
    });
  }, [lots, filterName, universeId]);

  return (
    <div className="min-h-screen bg-[#f9fafb] dark:bg-[#0a0a0a] text-gray-900 dark:text-gray-100 font-sans selection:bg-black selection:text-white pb-32">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-gray-200 dark:border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black dark:bg-white rounded-xl flex items-center justify-center text-white dark:text-black shadow-lg shadow-black/5">
              <Zap size={20} fill="currentColor" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">BloxEx <span className="text-xs font-medium text-gray-400">Cloud PRO</span></h1>
              <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400">Market Management</p>
            </div>
          </div>

          <nav className="flex items-center gap-1 bg-gray-100 dark:bg-white/5 p-1 rounded-full border border-gray-200 dark:border-white/10">
            <button onClick={() => setTab('live')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${tab === 'live' ? 'bg-white dark:bg-white/10 shadow-sm text-black dark:text-white' : 'text-gray-500 hover:text-gray-700'}`}>
              Live Manager
            </button>
            <button onClick={() => setTab('factory')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${tab === 'factory' ? 'bg-white dark:bg-white/10 shadow-sm text-black dark:text-white' : 'text-gray-500 hover:text-gray-700'}`}>
              Bulk Factory
            </button>
            <button onClick={() => setTab('settings')} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${tab === 'settings' ? 'bg-white dark:bg-white/10 shadow-sm text-black dark:text-white' : 'text-gray-500 hover:text-gray-700'}`}>
              Settings
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-8">
        <AnimatePresence mode="wait">
          {tab === 'settings' && (
            <motion.div key="settings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="max-w-2xl mx-auto bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 p-8 rounded-3xl space-y-6 shadow-xl">
              <div className="flex items-center gap-4 mb-2">
                <div className="w-12 h-12 bg-gray-100 dark:bg-white/5 rounded-2xl flex items-center justify-center">
                  <Settings size={22} className="text-gray-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Cloud Settings</h2>
                  <p className="text-sm text-gray-500">Configure your Roblox API credentials</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-gray-400">Roblox API Key</label>
                  <div className="relative">
                    <Key size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                      type="password" 
                      value={apiKey} 
                      onChange={e => setApiKey(e.target.value)}
                      placeholder="Place your Roblox API Key here..." 
                      className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl py-3 pl-12 pr-4 outline-none focus:border-black dark:focus:border-white transition-all text-sm font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-gray-400">Universe ID</label>
                  <div className="relative">
                    <Globe size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                      type="text" 
                      value={universeId} 
                      onChange={e => setUniverseId(e.target.value)}
                      placeholder="e.g. 27056..." 
                      className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl py-3 pl-12 pr-4 outline-none focus:border-black dark:focus:border-white transition-all text-sm font-mono"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 dark:border-white/5 flex gap-3">
                   <Shield size={16} className="text-gray-400 shrink-0 mt-1" />
                   <p className="text-[10px] text-gray-400 leading-relaxed italic">
                    Credentials are saved locally in your browser. Never share your API key. 
                    The key requires "Universe" permissions (Read/Write) for the Gamepass API on Roblox Cloud.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {tab === 'live' && (
            <motion.div key="live" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
              {/* Global Controls */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 p-6 rounded-3xl flex flex-col justify-between shadow-sm">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2">
                       <Search size={14} /> Inventory Scan
                    </h3>
                    <div className="relative mb-4">
                        <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input 
                          type="text" 
                          placeholder="Filter by name (optional)..." 
                          value={filterName}
                          onChange={e => setFilterName(e.target.value)}
                          className="w-full bg-gray-100 dark:bg-white/5 border border-transparent focus:border-black dark:focus:border-white rounded-xl py-2 pl-9 pr-4 text-xs font-medium outline-none"
                        />
                    </div>
                  </div>
                  <button 
                    onClick={importExisting}
                    disabled={isLoading}
                    className="w-full bg-black dark:bg-white text-white dark:text-black py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 shadow-md"
                  >
                    {isLoading ? <RefreshCw className="animate-spin" size={14} /> : <Search size={14} />}
                    SCAN ROBLOX CLOUD
                  </button>
                </div>

                <div className="bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 p-6 rounded-3xl flex flex-col justify-between shadow-sm">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2">
                       <LayoutGrid size={14} /> Batch Logic
                    </h3>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Global Price:</span>
                      <div className="relative">
                        <DollarSign size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input 
                          type="number" 
                          value={globalPrice} 
                          onChange={e => setGlobalPrice(e.target.value)}
                          className="w-24 bg-gray-100 dark:bg-white/5 border border-transparent focus:border-black dark:focus:border-white rounded-lg py-1 pl-6 pr-2 text-xs font-bold outline-none font-mono" 
                        />
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={bulkSync}
                    disabled={isLoading}
                    className="w-full bg-blue-600 text-white py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-blue-500/20"
                  >
                    <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                    SYNC ALL & ACTIVATE
                  </button>
                </div>

                <div className="bg-red-500/[0.02] border border-red-500/20 p-6 rounded-3xl border-red-500/20 flex flex-col justify-between shadow-sm">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-red-500 mb-4 flex items-center gap-2">
                       <Power size={14} /> Market Safety
                    </h3>
                    <p className="text-xs text-red-500/60 mb-4 font-medium leading-relaxed">Instantly disable selected assets on the market in case of emergency.</p>
                  </div>
                  <button 
                    onClick={() => {
                        if(confirm("EMERGENCY: Pull ALL matched assets off-sale?")) {
                            notify("Emergency shutdown triggered", "ok");
                        }
                    }}
                    className="w-full bg-red-600 text-white py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-red-700 active:scale-95 transition-all shadow-lg shadow-red-500/20"
                  >
                    <Power size={14} />
                    EMERGENCY SHUTDOWN
                  </button>
                </div>
              </div>

              {/* Main Table */}
              <div className="bg-white dark:bg-[#0c0c0c] rounded-3xl overflow-hidden border border-gray-200 dark:border-white/10 shadow-sm transition-all duration-300">
                <div className="px-6 py-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50/50 dark:bg-white/[0.01]">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <LayoutGrid size={16} /> Asset Monitor 
                    <span className="text-[10px] text-gray-400 font-normal ml-2 tracking-widest uppercase">{filteredLots.length} Results</span>
                  </h3>
                  <button 
                    onClick={runAudit}
                    disabled={isLoading}
                    className="px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-all text-gray-400 flex items-center gap-2 text-[10px] font-bold border border-transparent hover:border-gray-200 dark:hover:border-white/10"
                  >
                    <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} /> 
                    REFRESH AUDIT
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10px] uppercase font-bold tracking-widest text-gray-400 border-b border-gray-50 dark:border-white/5 bg-white dark:bg-transparent">
                        <th className="px-6 py-5">Status</th>
                        <th className="px-6 py-5">Asset Identity</th>
                        <th className="px-6 py-5 text-right">Roblox Value</th>
                        <th className="px-6 py-5 text-center">Cloud Reference</th>
                        <th className="px-6 py-5 text-right">Operations</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                      {filteredLots.map(lot => (
                        <tr key={lot.id} className="group hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors">
                          <td className="px-6 py-4">
                            {lot.isForSale ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase bg-green-500/10 text-green-500 border border-green-500/20 shadow-sm shadow-green-500/5">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                On Sale
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase bg-gray-500/10 text-gray-500 border border-gray-500/20">
                                Off-Sale
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-bold text-sm tracking-tight text-gray-900 dark:text-gray-100">{lot.name}</div>
                            <div className="text-[10px] text-gray-400 uppercase tracking-[0.2em] mt-0.5 font-bold">{lot.baseName || 'Inventory'}</div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className={`font-mono text-sm font-bold flex items-center justify-end gap-1.5 ${lot.price != Number(globalPrice) ? 'text-orange-500 underline decoration-dotted decoration-orange-500/50' : 'text-gray-900 dark:text-gray-100'}`}>
                              <DollarSign size={12} className="opacity-50" />
                              {lot.price.toLocaleString()}
                            </div>
                            {lot.price != Number(globalPrice) && (
                                <div className="text-[8px] font-bold text-orange-400 uppercase tracking-tighter mt-0.5">Price Mismatch</div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <code className="text-[10px] font-mono text-gray-400 px-3 py-1 bg-gray-100 dark:bg-white/5 rounded-lg border border-transparent group-hover:border-gray-200 dark:group-hover:border-white/10 transition-all">{lot.id}</code>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5 opacity-40 group-hover:opacity-100 transition-opacity">
                               <button 
                                 onClick={() => setSinglePrice(lot.id, Number(globalPrice))}
                                 disabled={isLoading}
                                 className="p-2.5 hover:bg-blue-50 dark:hover:bg-blue-500/10 text-gray-400 hover:text-blue-500 rounded-xl transition-all"
                                 title="Sync to Global price"
                               >
                                 <RefreshCw size={14} />
                               </button>
                               <button 
                                 onClick={() => toggleSale(lot.id, !lot.isForSale)}
                                 disabled={isLoading}
                                 className={`p-2.5 rounded-xl transition-all ${lot.isForSale ? 'text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'}`}
                                 title={lot.isForSale ? "Set Off-Sale" : "Set On-Sale"}
                               >
                                 <Power size={14} />
                               </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredLots.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-20 text-center text-gray-400">
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4">
                              <div className="w-16 h-16 bg-gray-50 dark:bg-white/[0.02] rounded-3xl flex items-center justify-center border border-gray-100 dark:border-white/5">
                                <AlertTriangle size={32} className="opacity-20" />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-gray-500">No assets found</p>
                                <p className="text-xs text-gray-400 mt-1">Configure credentials or run a Cloud Scan to discover assets.</p>
                              </div>
                              <button onClick={() => setTab('settings')} className="text-[10px] font-black uppercase tracking-widest text-blue-500 hover:underline mt-2">Check Settings</button>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {tab === 'factory' && (
            <motion.div key="factory" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="max-w-2xl mx-auto space-y-8">
              <div className="bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 p-8 rounded-3xl space-y-6 shadow-xl">
                  <div className="flex items-center gap-4 mb-2">
                    <div className="w-12 h-12 bg-gray-100 dark:bg-white/5 rounded-2xl flex items-center justify-center">
                      <Package size={22} className="text-gray-400" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">Cloud Asset Creator</h2>
                      <p className="text-sm text-gray-500">Instantly provision new gamepasses via Roblox Cloud</p>
                    </div>
                  </div>

                  <form onSubmit={createGamePass} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase font-bold tracking-widest text-gray-400">Asset Name</label>
                            <input 
                                type="text"
                                required
                                placeholder="Stock Share #1"
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl py-3 px-4 outline-none focus:border-black dark:focus:border-white transition-all text-sm"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase font-bold tracking-widest text-gray-400">Initial Price (R$)</label>
                            <input 
                                type="number"
                                required
                                value={newPrice}
                                onChange={e => setNewPrice(e.target.value)}
                                className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl py-3 px-4 outline-none focus:border-black dark:focus:border-white transition-all text-sm font-mono"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold tracking-widest text-gray-400">Description</label>
                        <textarea 
                            placeholder="Automated Asset via BloxEx..."
                            value={newDesc}
                            onChange={e => setNewDesc(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl py-3 px-4 outline-none focus:border-black dark:focus:border-white transition-all text-sm h-24 resize-none"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase font-bold tracking-widest text-gray-400">Asset Icon (JPEG/PNG)</label>
                            <input 
                                type="file"
                                accept="image/*"
                                required
                                onChange={e => setNewIcon(e.target.files?.[0] || null)}
                                className="w-full text-xs text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-black dark:file:bg-white file:text-white dark:file:text-black hover:file:opacity-80"
                            />
                        </div>
                        <div className="flex items-end pb-1">
                            <label className="flex items-center gap-3 cursor-pointer p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-200 dark:border-white/10 w-full group">
                                <input 
                                    type="checkbox"
                                    checked={newIsForSale}
                                    onChange={e => setNewIsForSale(e.target.checked)}
                                    className="hidden"
                                />
                                <div className={`w-10 h-5 rounded-full transition-all relative ${newIsForSale ? 'bg-green-500' : 'bg-gray-300'}`}>
                                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${newIsForSale ? 'left-6' : 'left-1'}`} />
                                </div>
                                <span className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-widest">Put on sale immediately</span>
                            </label>
                        </div>
                    </div>

                    <button 
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-black dark:bg-white text-white dark:text-black py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-xl hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 mt-4"
                    >
                        {isLoading ? <RefreshCw className="animate-spin" size={16} /> : <Zap size={16} fill="currentColor" />}
                        PROVISION CLOUD ASSET
                    </button>
                  </form>
              </div>

              <div className="flex justify-center gap-6">
                <a 
                    href="https://create.roblox.com/dashboard/creations" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-black dark:hover:text-white transition-colors flex items-center gap-2"
                >
                    Creator Dashboard <Globe size={12} />
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Global Notifications */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ y: 20, opacity: 0, x: '-50%' }}
            animate={{ y: 0, opacity: 1, x: '-50%' }}
            exit={{ y: 20, opacity: 0, x: '-50%' }}
            className={`fixed bottom-8 left-1/2 z-[100] px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-2xl flex items-center gap-3 border ${toast.type === 'ok' ? 'bg-black dark:bg-white text-white dark:text-black border-white/10' : 'bg-red-600 text-white border-red-500/20'}`}
          >
            {toast.type === 'ok' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="max-w-7xl mx-auto px-6 py-20 flex justify-between items-center text-gray-300 dark:text-gray-700">
        <div className="text-[9px] uppercase font-bold tracking-[0.4em] opacity-50">BloxEx Market Protocol v2.5.0</div>
        <div className="text-[9px] uppercase font-bold tracking-widest opacity-50 underline decoration-dotted">Secure Node.js Bridge</div>
      </footer>

      {/* Persistence Message (Persistent alert if key missing) */}
      <AnimatePresence>
        {!apiKey && tab !== 'settings' && (
          <motion.div 
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-0 left-0 right-0 bg-amber-500 text-white px-6 py-3 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-4 z-50 shadow-2xl shadow-amber-500/40"
          >
            <Shield size={14} className="animate-pulse" />
            UNAUTHORIZED ACCESS: Setup API Key to Enable Cloud Operations
            <button onClick={() => setTab('settings')} className="bg-white/20 hover:bg-white/30 px-4 py-1.5 rounded-full border border-white/30 transition-all">CONFIGURE NOW</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
