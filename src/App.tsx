import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, Settings, RefreshCw, Power, 
  Search, AlertTriangle, Hexagon, Copy, HelpCircle,
  Zap, LayoutGrid, Key, Globe, Layout, Package, CheckCircle2,
  Moon, Sun, Monitor, ChevronDown, ChevronRight,
  SortAsc, SortDesc, List, Grid3X3, Maximize2
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

  // Editing State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<'name' | 'price' | 'group' | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  // Creation State
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPrice, setNewPrice] = useState('100');
  const [newIsForSale, setNewIsForSale] = useState(true);
  const [newIcon, setNewIcon] = useState<File | null>(null);
  const [showApiKeyGuide, setShowApiKeyGuide] = useState(false);
  const [showUniverseIdGuide, setShowUniverseIdGuide] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'almond' | 'system'>(() => (localStorage.getItem('theme') as 'light' | 'dark' | 'almond' | 'system') || 'system');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Theme Logic
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark', 'almond');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== 'system') return;
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark', 'almond');
      root.classList.add(mediaQuery.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  // Filter State
  const [filterGroup, setFilterGroup] = useState<string>('All');
  const [filterSaleStatus, setFilterSaleStatus] = useState<'All' | 'OnSale' | 'OffSale'>('All');
  
  // Sort State
  const [sortBy, setSortBy] = useState<'name' | 'price'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // View State
  const [viewLayout, setViewLayout] = useState<'detailed' | 'compact' | 'grid'>('detailed');
  const [expandedGridId, setExpandedGridId] = useState<string | null>(null);

  const notify = useCallback((msg: string, type: 'ok' | 'err') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    notify("ID Copied", "ok");
  };

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
        notify(`Audit complete for Univ ${universeId}: ${data.audited} assets checked`, 'ok');
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
        notify(`Import scan complete for Univ ${universeId}. Found ${d.count} new assets.`, 'ok');
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
    const cleanKey = apiKey.trim();
    const cleanUniv = universeId.trim();

    if (!cleanKey || !cleanUniv) return notify("Set credentials in Settings", "err");
    if (!newIcon) return notify("Please select an icon image", "err");
    
    setIsLoading(true);
    try {
      const fd = new FormData();
      fd.append('name', newName.trim() || "Stock Share #1");
      fd.append('description', newDesc.trim() || "Created via BloxEx Cloud Manager");
      fd.append('price', newPrice);
      fd.append('isForSale', String(newIsForSale));
      fd.append('imageFile', newIcon);
      fd.append('universeId', cleanUniv);
      fd.append('apiKey', cleanKey);
      fd.append('baseName', 'Inventory');

      const r = await fetch('/api/create_gamepass', {
        method: 'POST',
        body: fd
      });
      
      const responseText = await r.text();
      let d: any;
      try {
        d = JSON.parse(responseText);
      } catch (err) {
        d = { message: responseText };
      }
      
      if (r.ok && d.status === 'success') {
        notify(`Gamepass created in Univ ${universeId}!`, "ok");
        setNewName('');
        setNewDesc('');
        setNewIcon(null);
        await fetchLots();
        setTab('live');
      } else {
        const errorMsg = d.message || d.error || "Creation failed";
        notify(`ROBLOX Error: ${errorMsg}`, "err");
        console.error("Gamepass creation error:", d);
      }
    } catch (e) {
      notify("Network error during creation", "err");
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const bulkSync = async () => {
    if (!apiKey || !universeId) return notify("Set credentials first", "err");
    if (!confirm(`Sync ALL tracked assets for Universe ${universeId} to ${globalPrice} Robux?`)) return;
    setIsLoading(true);
    try {
      const r = await fetch('/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, universeId, price: Number(globalPrice) })
      });
      const d = await r.json();
      notify(`Synced ${d.count} assets in Univ ${universeId} to ${globalPrice} R$`, 'ok');
      await fetchLots();
    } finally {
      setIsLoading(false);
    }
  };

  const updateAsset = async (id: string, updates: Partial<Lot>) => {
    const asset = lots.find(l => l.id === id);
    const targetUniverseId = asset?.universeId || universeId;

    try {
      const r = await fetch('/update_asset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            id, 
            universeId: targetUniverseId, 
            apiKey, 
            name: updates.name,
            baseName: updates.baseName,
            price: updates.price,
            forSale: updates.isForSale 
        })
      });
      const d = await r.json();
      if (d.status === 'success') {
        notify("Update successful", "ok");
        await fetchLots();
      } else {
        notify(d.message || "Update failed", "err");
      }
    } catch (e) {
      notify("Network error during update", "err");
    }
  };

  const startEditing = (id: string, field: 'name' | 'price' | 'group', value: string | number) => {
    setEditingId(id);
    setEditingField(field);
    setEditValue(String(value));
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingField(null);
    setEditValue('');
  };

  const saveEdit = async () => {
    if (!editingId || !editingField) return;
    
    const updates: Partial<Lot> = {};
    if (editingField === 'name') {
        updates.name = editValue;
    } else if (editingField === 'price') {
        updates.price = Number(editValue);
    } else if (editingField === 'group') {
        updates.baseName = editValue;
    }

    await updateAsset(editingId, updates);
    cancelEditing();
  };

  const emergencyShutdown = async () => {
    const matchedIds = (Object.values(groupedLots) as Lot[][]).flat().map(l => l.id);
    if (matchedIds.length === 0) return notify("No assets match current filters", "err");
    
    if (!confirm(`EMERGENCY: Pull ${matchedIds.length} matched assets off-sale?`)) return;
    
    setIsLoading(true);
    try {
      const r = await fetch('/bulk_shutdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          apiKey, 
          universeId, 
          ids: matchedIds 
        })
      });
      const d = await r.json();
      if (d.status === 'success') {
        notify(`Shutdown complete: ${d.count} assets set off-sale`, 'ok');
      } else {
        notify(d.message || "Shutdown failed", "err");
      }
      await fetchLots();
    } catch (e) {
      notify("Network error during shutdown", "err");
    } finally {
      setIsLoading(false);
    }
  };

  const groupedLots = useMemo(() => {
    let filtered = lots.filter(l => {
        const matchesFilter = filterName ? (l.name || '').toLowerCase().includes(filterName.toLowerCase()) : true;
        const group = l.baseName || 'Inventory';
        const matchesGroup = filterGroup === 'All' || group === filterGroup;
        
        const matchesSaleStatus = filterSaleStatus === 'All' 
            ? true 
            : filterSaleStatus === 'OnSale' 
                ? l.isForSale 
                : !l.isForSale;

        return matchesFilter && matchesGroup && matchesSaleStatus;
    });

    // Apply Sorting
    filtered = [...filtered].sort((a, b) => {
        let valA: any = sortBy === 'name' ? (a.name || '').toLowerCase() : a.price;
        let valB: any = sortBy === 'name' ? (b.name || '').toLowerCase() : b.price;

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
    });

    const groups: { [key: string]: Lot[] } = {};
    filtered.forEach(lot => {
        const group = lot.baseName || 'Inventory';
        if (!groups[group]) groups[group] = [];
        groups[group].push(lot);
    });
    return groups;
  }, [lots, filterName, filterGroup, filterSaleStatus, sortBy, sortOrder]);

  const availableGroups = useMemo(() => {
    const sets = new Set<string>();
    lots.forEach(l => {
        sets.add(l.baseName || 'Inventory');
    });
    return ['All', ...Array.from(sets)];
  }, [lots]);

  const toggleGroup = (group: string) => {
    setCollapsedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  return (
    <div className="min-h-screen bg-[#f9fafb] dark:bg-[#0a0a0a] text-gray-900 dark:text-gray-100 font-sans selection:bg-black selection:text-white pb-32">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-gray-200 dark:border-white/10 px-4 md:px-6 py-3 md:py-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div 
            onClick={() => {
                const themes: ('light' | 'dark' | 'almond' | 'system')[] = ['light', 'dark', 'almond', 'system'];
                const nextIndex = (themes.indexOf(theme) + 1) % themes.length;
                setTheme(themes[nextIndex]);
            }}
            className="flex items-center gap-3 self-start md:self-auto cursor-pointer group/logo"
            title={`Theme: ${theme.charAt(0).toUpperCase() + theme.slice(1)} (Click to cycle)`}
          >
            <div className="w-8 h-8 md:w-10 md:h-10 bg-black dark:bg-white rounded-lg md:rounded-xl flex items-center justify-center text-white dark:text-black shadow-lg transition-all active:scale-90 group-hover/logo:rotate-6">
              {theme === 'almond' ? <Zap size={16} className="md:w-[20px] text-orange-400" fill="currentColor" /> : <Zap size={16} className="md:w-[20px]" fill="currentColor" />}
            </div>
            <div>
              <h1 className="text-base md:text-lg font-bold tracking-tight">BloxEx <span className="hidden sm:inline text-xs font-medium text-gray-400">Cloud PRO</span></h1>
              <div className="flex items-center gap-2">
                <p className="text-[9px] md:text-[10px] uppercase tracking-widest font-bold text-gray-400">Market Management</p>
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10">
                  {theme === 'light' && <Sun size={8} className="text-orange-500" />}
                  {theme === 'dark' && <Moon size={8} className="text-blue-400" />}
                  {theme === 'almond' && <Zap size={8} className="text-orange-400 fill-orange-400/20" />}
                  {theme === 'system' && <Monitor size={8} className="text-gray-400" />}
                  <span className="text-[7px] font-black uppercase text-gray-400">{theme}</span>
                </div>
              </div>
            </div>
          </div>

          <nav className="flex items-center gap-1 bg-gray-100 dark:bg-white/5 p-1 rounded-full border border-gray-200 dark:border-white/10 w-full md:w-auto overflow-x-auto no-scrollbar">
            <button onClick={() => setTab('live')} className={`flex-1 md:flex-none whitespace-nowrap px-4 py-1.5 rounded-full text-[11px] md:text-xs font-bold transition-all ${tab === 'live' ? 'bg-white dark:bg-white/10 shadow-sm text-black dark:text-white' : 'text-gray-500 hover:text-gray-700'}`}>
              Live Manager
            </button>
            <button onClick={() => setTab('factory')} className={`flex-1 md:flex-none whitespace-nowrap px-4 py-1.5 rounded-full text-[11px] md:text-xs font-bold transition-all ${tab === 'factory' ? 'bg-white dark:bg-white/10 shadow-sm text-black dark:text-white' : 'text-gray-500 hover:text-gray-700'}`}>
              Bulk Factory
            </button>
            <button onClick={() => setTab('settings')} className={`flex-1 md:flex-none whitespace-nowrap px-4 py-1.5 rounded-full text-[11px] md:text-xs font-bold transition-all ${tab === 'settings' ? 'bg-white dark:bg-white/10 shadow-sm text-black dark:text-white' : 'text-gray-500 hover:text-gray-700'}`}>
              Settings
            </button>
          </nav>

          <div className="hidden md:block">
            {/* Theme switcher moved to logo */}
          </div>
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
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-gray-400">Roblox API Key</label>
                    <button 
                      onClick={() => setShowApiKeyGuide(!showApiKeyGuide)}
                      className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${showApiKeyGuide ? 'text-blue-500' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      <HelpCircle size={12} />
                      {showApiKeyGuide ? 'Close Guide' : 'How to get?'}
                    </button>
                  </div>

                  <AnimatePresence>
                    {showApiKeyGuide && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="bg-blue-50 dark:bg-blue-500/5 border border-blue-100 dark:border-blue-500/20 rounded-2xl p-5 mb-4 space-y-4 shadow-inner">
                          <h4 className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center gap-2">
                             <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                             Setup Instructions
                          </h4>
                          <ul className="space-y-3">
                            {[
                              { t: "Open Roblox Creator Dashboard", d: "Go to the Credentials Page (https://create.roblox.com/dashboard/credentials)." },
                              { t: "Click Create API Key", d: "Look for the big button at the top right." },
                              { t: "Select API System", d: "Choose 'game-passes' from the permissions dropdown." },
                              { t: "Add Operations", d: "Click 'Select Operations to Add' and add both read and write." },
                              { t: "Pick Your Game", d: "Toggle 'Restrict by Experience' and add the target game." },
                              { t: "Save and Generate", d: "Give it a name, set expiration, and click Save and Generate." }
                            ].map((step, i) => (
                              <li key={i} className="flex gap-3">
                                <span className="flex-shrink-0 w-5 h-5 bg-blue-100 dark:bg-blue-500/20 rounded-full flex items-center justify-center text-[10px] font-black text-blue-600 dark:text-blue-400">{i + 1}</span>
                                <div>
                                  <div className="text-[11px] font-bold text-gray-900 dark:text-gray-100">{step.t}</div>
                                  <div className="text-[10px] text-gray-500 dark:text-blue-300/50 leading-relaxed">{step.d}</div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="relative">
                    <Key size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                      type="password" 
                      value={apiKey} 
                      onChange={e => setApiKey(e.target.value.trim())}
                      placeholder="Place your Roblox API Key here..." 
                      className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl py-3 pl-12 pr-4 outline-none focus:border-black dark:focus:border-white transition-all text-sm font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-gray-400">Universe ID</label>
                    <button 
                      onClick={() => setShowUniverseIdGuide(!showUniverseIdGuide)}
                      className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${showUniverseIdGuide ? 'text-orange-500' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      <HelpCircle size={12} />
                      {showUniverseIdGuide ? 'Close Guide' : 'What is this?'}
                    </button>
                  </div>

                  <AnimatePresence>
                    {showUniverseIdGuide && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="bg-orange-50 dark:bg-orange-500/5 border border-orange-100 dark:border-orange-500/20 rounded-2xl p-5 mb-4 space-y-4 shadow-inner">
                          <h4 className="text-xs font-black text-orange-600 dark:text-orange-400 uppercase tracking-widest flex items-center gap-2">
                             <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                             Universe ID Checklist
                          </h4>
                          <ul className="space-y-3">
                            {[
                                { t: "Go to Creations", d: "Open the Creations Tab (https://create.roblox.com/dashboard/creations)." },
                                { t: "Find Game", d: "Hover over your game's thumbnail." },
                                { t: "Copy ID", d: "Click the ... (three dots) and select 'Copy Universe ID'." }
                            ].map((step, i) => (
                              <li key={i} className="flex gap-3">
                                <span className="flex-shrink-0 w-5 h-5 bg-orange-100 dark:bg-orange-500/20 rounded-full flex items-center justify-center text-[10px] font-black text-orange-600 dark:text-orange-400">{i + 1}</span>
                                <div>
                                  <div className="text-[11px] font-bold text-gray-900 dark:text-gray-100">{step.t}</div>
                                  <div className="text-[10px] text-gray-500 dark:text-orange-300/50 leading-relaxed">{step.d}</div>
                                </div>
                              </li>
                            ))}
                          </ul>
                          
                          <div className="pt-4 border-t border-orange-200 dark:border-orange-500/10 space-y-3">
                            <h5 className="text-[9px] font-black uppercase tracking-widest text-orange-500/50">Pro Tip: Don't use Place ID</h5>
                            <div className="p-3 bg-white dark:bg-black/20 rounded-xl border border-orange-200 dark:border-orange-500/10">
                                <span className="text-[10px] font-black text-red-500 uppercase block mb-1">❌ Incorrect URL</span>
                                <code className="text-[10px] text-gray-400">roblox.com/games/<b>123456789</b>/...</code>
                            </div>
                            <div className="p-3 bg-white dark:bg-black/20 rounded-xl border border-green-200 dark:border-green-500/10">
                                <span className="text-[10px] font-black text-green-500 uppercase block mb-1">✅ Correct Format</span>
                                <code className="text-[10px] text-gray-400">experiences/<b>9876543210</b>/overview</code>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="relative">
                    <Globe size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                      type="text" 
                      value={universeId} 
                      onChange={e => setUniverseId(e.target.value.trim())}
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
                    <div className="flex flex-col gap-4 mb-4">
                        <div className="relative">
                            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input 
                              type="text" 
                              placeholder="Filter by name..." 
                              value={filterName}
                              onChange={e => setFilterName(e.target.value)}
                              className="w-full bg-gray-100 dark:bg-white/5 border border-transparent focus:border-black dark:focus:border-white rounded-xl py-2 pl-9 pr-4 text-xs font-medium outline-none transition-all"
                            />
                        </div>
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                            <Zap size={12} className="text-gray-400 shrink-0" />
                            {(['All', 'OnSale', 'OffSale'] as const).map(s => (
                                <button
                                    key={s}
                                    onClick={() => setFilterSaleStatus(s)}
                                    className={`px-3 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition-all border ${filterSaleStatus === s ? 'bg-black dark:bg-white text-white dark:text-black border-transparent' : 'bg-gray-100 dark:bg-white/5 text-gray-400 border-gray-200 dark:border-white/10'}`}
                                >
                                    {s === 'OnSale' ? 'On Sale' : s === 'OffSale' ? 'Off Sale' : 'All Status'}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 border-t border-gray-100 dark:border-white/5 pt-1">
                            <LayoutGrid size={12} className="text-gray-400 shrink-0" />
                            {availableGroups.map(g => (
                                <button
                                    key={g}
                                    onClick={() => setFilterGroup(g)}
                                    className={`px-3 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition-all border ${filterGroup === g ? 'bg-black dark:bg-white text-white dark:text-black border-transparent' : 'bg-gray-100 dark:bg-white/5 text-gray-400 border-gray-200 dark:border-white/10'}`}
                                >
                                    {g}
                                </button>
                            ))}
                        </div>
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
                        <Hexagon size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 fill-current opacity-50" />
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
                    onClick={emergencyShutdown}
                    disabled={isLoading}
                    className="w-full bg-red-600 text-white py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-red-700 active:scale-95 transition-all shadow-lg shadow-red-500/20 disabled:opacity-50"
                  >
                    <Power size={14} className={isLoading ? 'animate-spin' : ''} />
                    EMERGENCY SHUTDOWN
                  </button>
                </div>
              </div>

              {/* Main Table */}
              <div className="bg-white dark:bg-[#0c0c0c] rounded-3xl overflow-hidden border border-gray-200 dark:border-white/10 shadow-sm transition-all duration-300">
                <div className="px-6 py-6 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.01]">
                  <div className="flex flex-col lg:flex-row items-center justify-between gap-6 mb-4">
                    <div className="flex flex-col gap-1 w-full lg:w-auto">
                      <h3 className="text-sm font-bold flex items-center gap-2">
                        <LayoutGrid size={16} /> Asset Monitor 
                        <span className="text-[10px] text-gray-400 font-normal ml-2 tracking-widest uppercase">{Object.values(groupedLots).flat().length} Results</span>
                      </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end">
                      <div className="flex bg-white dark:bg-white/5 p-1 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm">
                        <button 
                          onClick={() => setViewLayout('detailed')}
                          className={`p-2 rounded-lg transition-all flex items-center gap-2 text-[10px] font-bold ${viewLayout === 'detailed' ? 'bg-gray-100 dark:bg-white/10 text-black dark:text-white shadow-inner' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                          <Layout size={14} /> <span className="hidden sm:inline">Detailed</span>
                        </button>
                        <button 
                          onClick={() => setViewLayout('compact')}
                          className={`p-2 rounded-lg transition-all flex items-center gap-2 text-[10px] font-bold ${viewLayout === 'compact' ? 'bg-gray-100 dark:bg-white/10 text-black dark:text-white shadow-inner' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                          <List size={14} /> <span className="hidden sm:inline">Compact</span>
                        </button>
                        <button 
                          onClick={() => setViewLayout('grid')}
                          className={`p-2 rounded-lg transition-all flex items-center gap-2 text-[10px] font-bold ${viewLayout === 'grid' ? 'bg-gray-100 dark:bg-white/10 text-black dark:text-white shadow-inner' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                          <Grid3X3 size={14} /> <span className="hidden sm:inline">Grid</span>
                        </button>
                      </div>

                      <div className="h-6 w-px bg-gray-200 dark:bg-white/10 hidden sm:block" />

                      <div className="flex items-center gap-2 bg-white dark:bg-white/5 p-1 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm">
                        <div className="flex items-center px-2">
                          <select 
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as 'name' | 'price')}
                            className="bg-transparent text-[10px] font-bold uppercase tracking-widest text-gray-500 outline-none cursor-pointer appearance-none pr-1"
                          >
                            <option value="name">Name</option>
                            <option value="price">Price</option>
                          </select>
                        </div>
                        <button 
                          onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                          className="p-2 bg-gray-50 dark:bg-white/5 rounded-lg text-gray-400 hover:text-black dark:hover:text-white transition-all shadow-sm"
                        >
                          {sortOrder === 'asc' ? <SortAsc size={14} /> : <SortDesc size={14} />}
                        </button>
                      </div>

                      <button 
                        onClick={runAudit}
                        disabled={isLoading}
                        className="px-4 py-2.5 bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 rounded-xl transition-all text-gray-500 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest border border-gray-200 dark:border-white/10 shadow-sm disabled:opacity-50"
                      >
                        <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} /> 
                        <span className="hidden sm:inline">Audit</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Views */}
                <AnimatePresence mode="wait">
                  <motion.div 
                    key={viewLayout}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className={`${viewLayout === 'grid' ? 'p-6 grid grid-cols-2 lg:grid-cols-4 gap-6' : 'divide-y divide-gray-50 dark:divide-white/5'}`}
                  >
                    {(Object.entries(groupedLots) as [string, Lot[]][]).map(([group, assets]) => {
                      const isCollapsed = collapsedGroups[group];
                      
                      if (viewLayout === 'grid') {
                          return assets.map(lot => {
                              const isExpanded = expandedGridId === lot.id;
                              return (
                                  <motion.div 
                                      layout
                                      key={lot.id} 
                                      onClick={() => setExpandedGridId(isExpanded ? null : lot.id)}
                                      className={`relative group bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-3xl p-4 transition-all hover:shadow-xl ${isExpanded ? 'col-span-2 lg:col-span-2 ring-2 ring-black dark:ring-white z-10' : 'hover:-translate-y-1'} ${lot.universeId !== universeId ? 'opacity-60' : ''}`}
                                  >
                                      <div className="flex flex-col gap-3">
                                          <div className="flex justify-between items-start">
                                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${lot.isForSale ? 'bg-green-500/10 text-green-500' : 'bg-gray-400/10 text-gray-400'}`}>
                                                  <Package size={16} />
                                              </div>
                                              <div className="flex gap-1">
                                                  {lot.universeId !== universeId && (
                                                      <Globe size={10} className="text-orange-500" />
                                                  )}
                                                  {lot.isForSale ? (
                                                      <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
                                                  ) : (
                                                      <div className="w-2 h-2 rounded-full bg-gray-400" />
                                                  )}
                                              </div>
                                          </div>
                                        
                                        <div onClick={(e) => e.stopPropagation()}>
                                            {(editingId === lot.id && editingField === 'name') ? (
                                                <input 
                                                    autoFocus
                                                    value={editValue}
                                                    onChange={e => setEditValue(e.target.value)}
                                                    onBlur={saveEdit}
                                                    onKeyDown={e => e.key === 'Enter' && saveEdit() || e.key === 'Escape' && cancelEditing()}
                                                    className="w-full bg-gray-100 dark:bg-white/10 border border-black dark:border-white rounded px-1.5 py-0.5 text-[11px] font-bold outline-none"
                                                />
                                            ) : (
                                                <h4 
                                                    onClick={() => startEditing(lot.id, 'name', lot.name)}
                                                    className="text-[11px] font-black text-gray-900 dark:text-gray-100 uppercase tracking-tighter truncate leading-tight mb-1 cursor-text hover:text-blue-500 transition-colors"
                                                >
                                                    {lot.name}
                                                </h4>
                                            )}
                                            <div className="text-[8px] font-bold text-gray-400 uppercase tracking-widest truncate">{lot.baseName || 'Inventory'}</div>
                                        </div>

                                        <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100 dark:border-white/5">
                                            <div 
                                                onClick={(e) => { e.stopPropagation(); startEditing(lot.id, 'price', lot.price); }}
                                                className="flex items-center gap-1 cursor-pointer hover:text-blue-500 transition-colors"
                                            >
                                                <Hexagon size={10} className="text-gray-400 fill-current opacity-50" />
                                                {editingId === lot.id && editingField === 'price' ? (
                                                    <input 
                                                        autoFocus
                                                        type="number"
                                                        value={editValue}
                                                        onChange={e => setEditValue(e.target.value)}
                                                        onBlur={saveEdit}
                                                        onKeyDown={e => e.key === 'Enter' && saveEdit() || e.key === 'Escape' && cancelEditing()}
                                                        className="w-16 bg-gray-100 dark:bg-white/10 border border-black dark:border-white rounded px-1 text-xs font-mono font-bold outline-none"
                                                    />
                                                ) : (
                                                    <span className="text-xs font-mono font-bold leading-none">{lot.price.toLocaleString()}</span>
                                                )}
                                            </div>
                                            <Maximize2 size={12} className={`text-gray-300 group-hover:text-black dark:group-hover:text-white transition-all ${isExpanded ? 'rotate-180' : ''}`} />
                                        </div>

                                        <AnimatePresence>
                                            {isExpanded && (
                                                <motion.div 
                                                    initial={{ opacity: 0, height: 0 }} 
                                                    animate={{ opacity: 1, height: 'auto' }} 
                                                    exit={{ opacity: 0, height: 0 }}
                                                    transition={{ duration: 0.3, ease: 'circOut' }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="pt-4 mt-2 border-t border-gray-100 dark:border-white/5 space-y-4">
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div className="space-y-1">
                                                                <div className="text-[8px] uppercase font-bold text-gray-400 tracking-widest">Asset ID</div>
                                                                <div className="flex items-center gap-2">
                                                                    <code className="text-[10px] font-mono text-gray-600 dark:text-gray-400">{lot.id}</code>
                                                                    <button onClick={(e) => { e.stopPropagation(); copyToClipboard(lot.id); }} className="text-gray-400 hover:text-black dark:hover:text-white">
                                                                      <Copy size={10} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <div className="space-y-1">
                                                                <div className="text-[8px] uppercase font-bold text-gray-400 tracking-widest">Universe</div>
                                                                <div className="text-[10px] font-mono text-gray-500">{lot.universeId}</div>
                                                            </div>
                                                        </div>

                                                        <div className="flex gap-2">
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); updateAsset(lot.id, { price: Number(globalPrice) }); }}
                                                                className="flex-1 py-2.5 bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 hover:bg-blue-600 transition-all active:scale-95 shadow-lg shadow-blue-500/20"
                                                            >
                                                                <RefreshCw size={12} /> Sync Price
                                                            </button>
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); updateAsset(lot.id, { isForSale: !lot.isForSale }); }}
                                                                className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-all active:scale-95 ${lot.isForSale ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' : 'bg-green-500/10 text-green-500 hover:bg-green-500/20'}`}
                                                            >
                                                                <Power size={12} /> {lot.isForSale ? 'Deactivate' : 'Activate'}
                                                            </button>
                                                        </div>
                                                        
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); startEditing(lot.id, 'name', lot.name); }}
                                                            className="w-full py-2 bg-gray-100 dark:bg-white/5 rounded-xl text-[9px] font-bold text-gray-400 uppercase tracking-widest hover:bg-gray-200 dark:hover:bg-white/10 hover:text-black dark:hover:text-white transition-all"
                                                        >
                                                            Rename Asset
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </motion.div>
                            );
                        });
                    }

                    return (
                      <div key={group}>
                        <div 
                          onClick={() => toggleGroup(group)}
                          className="px-5 py-3 bg-gray-100/50 dark:bg-white/[0.02] border-b border-gray-200 dark:border-white/5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 flex items-center justify-between cursor-pointer hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                             {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                             {group}
                             <span className="ml-2 text-[8px] font-bold opacity-50">({assets.length})</span>
                          </div>
                        </div>
                        {!isCollapsed && (
                          <div className="divide-y divide-gray-50 dark:divide-white/5">
                            {assets.map(lot => (
                              <div key={lot.id} className={`${viewLayout === 'compact' ? 'p-3 flex items-center justify-between' : 'p-5 space-y-4'} ${lot.universeId !== universeId ? 'opacity-60 bg-gray-50/50 dark:bg-white/[0.01]' : ''}`}>
                                {viewLayout === 'compact' ? (
                                    <>
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${lot.isForSale ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-gray-400'}`} />
                                            <div className="flex flex-col min-w-0">
                                                {editingId === lot.id && editingField === 'name' ? (
                                                    <input 
                                                        autoFocus
                                                        value={editValue}
                                                        onChange={e => setEditValue(e.target.value)}
                                                        onBlur={saveEdit}
                                                        onKeyDown={e => e.key === 'Enter' && saveEdit() || e.key === 'Escape' && cancelEditing()}
                                                        className="bg-gray-100 dark:bg-white/10 border border-black dark:border-white rounded px-1 text-xs font-bold outline-none"
                                                    />
                                                ) : (
                                                    <div 
                                                        onClick={() => startEditing(lot.id, 'name', lot.name)}
                                                        className="text-xs font-bold truncate text-gray-900 dark:text-gray-100 cursor-text hover:text-blue-500"
                                                    >
                                                        {lot.name}
                                                    </div>
                                                )}
                                                <div className="text-[8px] text-gray-400 uppercase font-black tracking-widest">{lot.id}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            {editingId === lot.id && editingField === 'price' ? (
                                                <input 
                                                    autoFocus
                                                    type="number"
                                                    value={editValue}
                                                    onChange={e => setEditValue(e.target.value)}
                                                    onBlur={saveEdit}
                                                    onKeyDown={e => e.key === 'Enter' && saveEdit() || e.key === 'Escape' && cancelEditing()}
                                                    className="w-16 bg-gray-100 dark:bg-white/10 border border-black dark:border-white rounded px-1 text-xs font-mono font-bold outline-none"
                                                />
                                            ) : (
                                                <div 
                                                    onClick={() => startEditing(lot.id, 'price', lot.price)}
                                                    className="font-mono text-xs font-bold text-gray-900 dark:text-gray-100 pr-4 cursor-text hover:text-blue-500"
                                                >
                                                    {lot.price} R$
                                                </div>
                                            )}
                                            <div className="flex items-center gap-1">
                                                <button onClick={() => updateAsset(lot.id, { price: Number(globalPrice) })} className="p-1.5 hover:bg-blue-500/10 text-gray-400 hover:text-blue-500 rounded"><RefreshCw size={12} /></button>
                                                <button onClick={() => updateAsset(lot.id, { isForSale: !lot.isForSale })} className={`p-1.5 rounded transition-all ${lot.isForSale ? 'text-green-500 hover:bg-green-500/10' : 'text-gray-400 hover:bg-gray-100/10'}`}><Power size={12} /></button>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex justify-between items-start">
                                          <div className="flex-1 mr-4">
                                            {editingId === lot.id && editingField === 'name' ? (
                                              <input 
                                                autoFocus
                                                value={editValue}
                                                onChange={e => setEditValue(e.target.value)}
                                                onBlur={saveEdit}
                                                onKeyDown={e => e.key === 'Enter' && saveEdit() || e.key === 'Escape' && cancelEditing()}
                                                className="w-full bg-gray-100 dark:bg-white/10 border border-black dark:border-white rounded px-2 py-1 text-sm font-bold outline-none"
                                              />
                                            ) : (
                                              <div 
                                                onClick={() => startEditing(lot.id, 'name', lot.name)}
                                                className="font-bold text-sm text-gray-900 dark:text-gray-100 cursor-text hover:bg-gray-100 dark:hover:bg-white/10 px-1 rounded -ml-1 transition-colors flex items-center gap-1.5 group/name"
                                              >
                                                {lot.name}
                                                <Layout size={10} className="opacity-0 group-hover/name:opacity-30 transition-opacity" />
                                              </div>
                                            )}
                                            <div className="flex flex-col gap-1 mt-1">
                                              <div className="flex items-center gap-2">
                                                <div className="text-[9px] text-gray-400 uppercase tracking-widest font-bold">ID: {lot.id}</div>
                                                <button onClick={() => copyToClipboard(lot.id)} className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded transition-colors text-gray-400">
                                                  <Copy size={10} />
                                                </button>
                                                {lot.universeId !== universeId && (
                                                    <span className="text-[7px] bg-gray-200 dark:bg-white/10 px-1 rounded text-gray-500 uppercase font-black">Outer Univ</span>
                                                )}
                                              </div>
                                              
                                              {editingId === lot.id && editingField === 'group' ? (
                                                <input 
                                                  autoFocus
                                                  value={editValue}
                                                  onChange={e => setEditValue(e.target.value)}
                                                  onBlur={saveEdit}
                                                  onKeyDown={e => e.key === 'Enter' && saveEdit() || e.key === 'Escape' && cancelEditing()}
                                                  className="w-full bg-gray-100 dark:bg-white/10 border border-black dark:border-white rounded px-2 py-0.5 text-[10px] font-bold outline-none mt-1"
                                                />
                                              ) : (
                                                <div 
                                                  onClick={() => startEditing(lot.id, 'group', lot.baseName || 'Inventory')}
                                                  className="text-[10px] text-gray-400 uppercase tracking-widest font-bold cursor-text hover:text-black dark:hover:text-white transition-colors flex items-center gap-1.5 group/group"
                                                >
                                                  Group: {lot.baseName || 'Inventory'}
                                                  <LayoutGrid size={10} className="opacity-0 group-hover/group:opacity-30 transition-opacity" />
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                          {lot.isForSale ? (
                                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[8px] font-black uppercase bg-green-500/10 text-green-500 border border-green-500/20 shadow-sm">
                                              <span className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />
                                              For Sale
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[8px] font-black uppercase bg-gray-500/10 text-gray-500 border border-gray-500/20">
                                              Off-Sale
                                            </span>
                                          )}
                                        </div>
            
                                        <div className="flex items-center justify-between bg-gray-50 dark:bg-white/5 p-3 rounded-2xl border border-gray-100 dark:border-white/5">
                                          <div className="space-y-1">
                                            <div className="text-[8px] uppercase font-bold text-gray-400 tracking-widest">Market Price</div>
                                            <div className={`font-mono text-sm font-bold flex items-center gap-1.5 ${lot.price != Number(globalPrice) ? 'text-orange-500' : 'text-gray-900 dark:text-gray-100'}`}>
                                              <Hexagon size={12} className="opacity-50 fill-current" />
                                              {editingId === lot.id && editingField === 'price' ? (
                                                <input 
                                                  autoFocus
                                                  type="number"
                                                  value={editValue}
                                                  onChange={e => setEditValue(e.target.value)}
                                                  onBlur={saveEdit}
                                                  onKeyDown={e => e.key === 'Enter' && saveEdit() || e.key === 'Escape' && cancelEditing()}
                                                  className="w-20 bg-gray-100 dark:bg-white/10 border border-black dark:border-white rounded px-1 outline-none"
                                                />
                                              ) : (
                                                <span onClick={() => startEditing(lot.id, 'price', lot.price)} className="cursor-text hover:bg-gray-100 dark:hover:bg-white/10 px-1 rounded transition-colors">
                                                  {lot.price.toLocaleString()}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                          <div className="flex gap-2">
                                            <button 
                                              onClick={() => startEditing(lot.id, 'group', lot.baseName || 'Inventory')}
                                              className="p-3 bg-gray-100 dark:bg-white/5 text-gray-400 rounded-xl active:scale-95 transition-all"
                                              title="Change Group"
                                            >
                                              <LayoutGrid size={16} />
                                            </button>
                                            <button 
                                              onClick={() => updateAsset(lot.id, { price: Number(globalPrice) })}
                                              disabled={isLoading}
                                              className="p-3 bg-blue-500/10 text-blue-500 rounded-xl active:scale-95 transition-all"
                                              title="Sync Price"
                                            >
                                              <RefreshCw size={16} />
                                            </button>
                                            <button 
                                              onClick={() => updateAsset(lot.id, { isForSale: !lot.isForSale })}
                                              disabled={isLoading}
                                              className={`p-3 rounded-xl active:scale-95 transition-all ${lot.isForSale ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}
                                              title="Toggle Sale"
                                            >
                                              <Power size={16} />
                                            </button>
                                          </div>
                                        </div>
                                    </>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  </motion.div>
                </AnimatePresence>

                {/* Desktop Table View */}
                {viewLayout !== 'grid' && (
                  <div className="hidden md:block overflow-x-auto">
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
                        {(Object.entries(groupedLots) as [string, Lot[]][]).map(([group, assets]) => {
                          const isCollapsed = collapsedGroups[group];
                          return (
                            <React.Fragment key={group}>
                              <tr 
                                onClick={() => toggleGroup(group)}
                                className="bg-gray-100/50 dark:bg-white/[0.02] cursor-pointer hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                              >
                                <td colSpan={5} className={`px-6 ${viewLayout === 'compact' ? 'py-1.5' : 'py-3'}`}>
                                  <div className="flex items-center gap-2">
                                    {isCollapsed ? <ChevronRight size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">{group}</span>
                                    <span className="text-[8px] font-bold text-gray-400 ml-1">({assets.length})</span>
                                    <div className="h-px flex-1 bg-gray-200 dark:bg-white/5 ml-2" />
                                  </div>
                                </td>
                              </tr>
                              {!isCollapsed && assets.map(lot => (
                                <tr key={lot.id} className={`group hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors ${lot.universeId !== universeId ? 'opacity-60 bg-gray-50/50 dark:bg-white/[0.01]' : ''}`}>
                                  <td className={`px-6 ${viewLayout === 'compact' ? 'py-2' : 'py-4'}`}>
                                    {lot.isForSale ? (
                                      <span className={`inline-flex items-center gap-1.5 rounded-full font-black uppercase bg-green-500/10 text-green-500 border border-green-500/20 shadow-sm shadow-green-500/5 ${viewLayout === 'compact' ? 'px-1.5 py-0.5 text-[7px]' : 'px-2.5 py-1 text-[9px]'}`}>
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                        For Sale
                                      </span>
                                    ) : (
                                      <span className={`inline-flex items-center gap-1.5 rounded-full font-black uppercase bg-gray-500/10 text-gray-500 border border-gray-500/20 ${viewLayout === 'compact' ? 'px-1.5 py-0.5 text-[7px]' : 'px-2.5 py-1 text-[9px]'}`}>
                                        Off-Sale
                                      </span>
                                    )}
                                  </td>
                                  <td className={`px-6 ${viewLayout === 'compact' ? 'py-2' : 'py-4'} text-xs`}>
                                    <div className="flex items-center gap-4">
                                      <div className="flex-1">
                                        {editingId === lot.id && editingField === 'name' ? (
                                            <input 
                                              autoFocus
                                              value={editValue}
                                              onChange={e => setEditValue(e.target.value)}
                                              onBlur={saveEdit}
                                              onKeyDown={e => e.key === 'Enter' && saveEdit() || e.key === 'Escape' && cancelEditing()}
                                              className="w-full bg-gray-100 dark:bg-white/10 border border-black dark:border-white rounded px-2 py-0.5 text-sm font-bold outline-none"
                                            />
                                        ) : (
                                            <div 
                                              onClick={(e) => { e.stopPropagation(); startEditing(lot.id, 'name', lot.name); }}
                                              className={`font-bold tracking-tight text-gray-900 dark:text-gray-100 cursor-text hover:bg-gray-100 dark:hover:bg-white/10 px-1 rounded -ml-1 transition-colors flex items-center gap-1.5 group/name ${viewLayout === 'compact' ? 'text-xs' : 'text-sm'}`}
                                            >
                                              {lot.name}
                                              <Layout size={10} className="opacity-0 group-hover/name:opacity-30 transition-opacity" />
                                            </div>
                                        )}
                                        {viewLayout === 'detailed' && (
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                              {editingId === lot.id && editingField === 'group' ? (
                                                <input 
                                                  autoFocus
                                                  value={editValue}
                                                  onChange={e => setEditValue(e.target.value)}
                                                  onBlur={saveEdit}
                                                  onKeyDown={e => e.key === 'Enter' && saveEdit() || e.key === 'Escape' && cancelEditing()}
                                                  className="w-32 bg-gray-100 dark:bg-white/10 border border-black dark:border-white rounded px-1 text-[10px] font-bold outline-none"
                                                />
                                              ) : (
                                                <div 
                                                  onClick={(e) => { e.stopPropagation(); startEditing(lot.id, 'group', lot.baseName || 'Inventory'); }}
                                                  className="text-[10px] text-gray-400 uppercase tracking-[0.2em] font-bold cursor-text hover:text-black dark:hover:text-white transition-colors flex items-center gap-1.5 group/group"
                                                >
                                                  {lot.baseName || 'Inventory'}
                                                  <LayoutGrid size={10} className="opacity-0 group-hover/group:opacity-30 transition-opacity" />
                                                </div>
                                              )}
                                              {lot.universeId !== universeId && (
                                                  <span className="text-[7px] bg-gray-200 dark:bg-white/10 px-1 rounded text-gray-400 uppercase font-bold border border-transparent group-hover:border-gray-500/20">Univ: {lot.universeId}</span>
                                              )}
                                            </div>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                  <td className={`px-6 ${viewLayout === 'compact' ? 'py-2' : 'py-4'} text-right`}>
                                    <div className={`font-mono font-bold flex items-center justify-end gap-1.5 ${viewLayout === 'compact' ? 'text-xs' : 'text-sm'} ${lot.price != Number(globalPrice) ? 'text-orange-500 underline decoration-dotted decoration-orange-500/50' : 'text-gray-900 dark:text-gray-100'}`}>
                                      <Hexagon size={12} className="opacity-50 fill-current" />
                                      {editingId === lot.id && editingField === 'price' ? (
                                        <input 
                                          autoFocus
                                          type="number"
                                          value={editValue}
                                          onChange={e => setEditValue(e.target.value)}
                                          onBlur={saveEdit}
                                          onKeyDown={e => e.key === 'Enter' && saveEdit() || e.key === 'Escape' && cancelEditing()}
                                          className="w-20 bg-gray-100 dark:bg-white/10 border border-black dark:border-white rounded px-1 text-right outline-none"
                                        />
                                      ) : (
                                        <span 
                                          onClick={(e) => { e.stopPropagation(); startEditing(lot.id, 'price', lot.price); }}
                                          className="cursor-text hover:bg-gray-100 dark:hover:bg-white/10 px-1 rounded transition-colors"
                                        >
                                          {lot.price.toLocaleString()}
                                        </span>
                                      )}
                                    </div>
                                    {lot.price != Number(globalPrice) && viewLayout === 'detailed' && (
                                        <div className="text-[8px] font-bold text-orange-400 uppercase tracking-tighter mt-0.5">Price Mismatch</div>
                                    )}
                                  </td>
                                  <td className={`px-6 ${viewLayout === 'compact' ? 'py-2' : 'py-4'} text-center`}>
                                    <div className="flex items-center justify-center gap-2">
                                      <code className="text-[10px] font-mono text-gray-400 px-3 py-1 bg-gray-100 dark:bg-white/5 rounded-lg border border-transparent group-hover:border-gray-200 dark:group-hover:border-white/10 transition-all">{lot.id}</code>
                                      <button onClick={(e) => { e.stopPropagation(); copyToClipboard(lot.id); }} className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-all text-gray-400 hover:text-black dark:hover:text-white">
                                        <Copy size={12} />
                                      </button>
                                    </div>
                                  </td>
                                  <td className={`px-6 ${viewLayout === 'compact' ? 'py-2' : 'py-4'} text-right`}>
                                    <div className="flex items-center justify-end gap-1.5 opacity-40 group-hover:opacity-100 transition-opacity">
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); startEditing(lot.id, 'group', lot.baseName || 'Inventory'); }}
                                        className="p-2.5 hover:bg-gray-100 dark:hover:bg-white/5 text-gray-400 hover:text-black dark:hover:text-white rounded-xl transition-all"
                                        title="Change Group"
                                      >
                                        <LayoutGrid size={14} />
                                      </button>
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); updateAsset(lot.id, { price: Number(globalPrice) }); }}
                                        disabled={isLoading}
                                        className="p-2.5 hover:bg-blue-50 dark:hover:bg-blue-500/10 text-gray-400 hover:text-blue-500 rounded-xl transition-all"
                                        title="Sync to Global price"
                                      >
                                        <RefreshCw size={14} />
                                      </button>
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); updateAsset(lot.id, { isForSale: !lot.isForSale }); }}
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
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {Object.keys(groupedLots).length === 0 && (
                  <div className="px-6 py-20 text-center text-gray-400">
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
                  </div>
                )}
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
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase font-bold tracking-widest text-gray-400">Asset Name</label>
                        <input 
                            type="text"
                            placeholder="e.g. Stock Share #1"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl py-3 px-4 outline-none focus:border-black dark:focus:border-white transition-all text-sm"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                    <button 
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-black dark:bg-white text-white dark:text-black py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] shadow-xl hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 mt-4 flex items-center justify-center gap-2"
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

        <AnimatePresence>
          {!apiKey && tab !== 'settings' && (
            <motion.div 
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="fixed bottom-0 left-0 right-0 bg-blue-600 text-white px-4 md:px-6 py-3 text-[10px] font-black uppercase tracking-widest flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4 z-50 shadow-2xl"
            >
              <div className="flex items-center gap-2">
                <Shield size={14} className="animate-pulse" />
                <span>UNAUTHORIZED ACCESS: Setup API Key to Enable Cloud Operations</span>
              </div>
              <button onClick={() => setTab('settings')} className="bg-white/20 hover:bg-white/30 px-6 py-2 rounded-full border border-white/30 transition-all font-bold text-[9px]">CONFIGURE NOW</button>
            </motion.div>
          )}
        </AnimatePresence>
    </div>
  );
}
