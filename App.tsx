import { motion, AnimatePresence } from 'motion/react';
import { Wallet, TrendingUp, TrendingDown, Search, User, Moon, Sun, X, Loader2, Factory, CheckCircle2, RefreshCw, Download, ToggleLeft, ToggleRight } from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';

// ── TYPES ─────────────────────────────────────────────────────────────────────
interface GamepassLot {
  id: string;
  symbol: string;
  name: string;
  baseName: string;
  universeId: string;
  num: number;
  currentPrice: number;
  robloxPrice?: number;
  isForSale: boolean;
  changePercent: number;
  sector: string;
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
async function api(path: string, method = 'GET', body?: object) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── APP ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [theme, setTheme]                   = useState<'light' | 'dark'>('dark');
  const [activeTab, setActiveTab]           = useState<'market' | 'manage'>('market');
  const [bridgeOnline, setBridgeOnline]     = useState(false);
  const [lots, setLots]                     = useState<GamepassLot[]>([]);
  const [search, setSearch]                 = useState('');
  const [notification, setNotification]     = useState<{ msg: string; ok: boolean } | null>(null);

  // Import form
  const [importBase, setImportBase]         = useState('');
  const [importUniverse, setImportUniverse] = useState('');
  const [isImporting, setIsImporting]       = useState(false);

  // Audit
  const [isAuditing, setIsAuditing]         = useState(false);

  // Factory panel
  const [showFactory, setShowFactory]       = useState(false);
  const [factoryStatus, setFactoryStatus]   = useState<'idle' | 'processing' | 'done'>('idle');
  const [factoryCount, setFactoryCount]     = useState<number | null>(null);
  const [fPrefix, setFPrefix]               = useState('');
  const [fQty, setFQty]                     = useState('');
  const [fPrice, setFPrice]                 = useState('');
  const [fUniverse, setFUniverse]           = useState('');

  // Bulk controls
  const [bulkPrice, setBulkPrice]           = useState('');
  const [isBulkSyncing, setIsBulkSyncing]   = useState(false);
  const [showShutdown, setShowShutdown]     = useState(false);

  // ── NOTIFICATION ──────────────────────────────────────────────────────────
  const notify = (msg: string, ok = true) => {
    setNotification({ msg, ok });
    setTimeout(() => setNotification(null), 3500);
  };

  // ── THEME ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // ── PING ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const check = async () => {
      try { await api('/ping'); setBridgeOnline(true); }
      catch { setBridgeOnline(false); }
    };
    check();
    const t = setInterval(check, 10000);
    return () => clearInterval(t);
  }, []);

  // ── FETCH LOTS ────────────────────────────────────────────────────────────
  const fetchLots = useCallback(async () => {
    try {
      const data = await api('/get_ids');
      if (Array.isArray(data)) setLots(data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchLots(); }, [fetchLots]);

  // ── IMPORT ────────────────────────────────────────────────────────────────
  const handleImport = async () => {
    if (!importBase || !importUniverse) return;
    setIsImporting(true);
    try {
      const data = await api('/import_existing', 'POST', { baseName: importBase, universeId: importUniverse });
      notify(`Imported ${data.imported}/${data.total} lots`);
      await fetchLots();
      setImportBase(''); setImportUniverse('');
    } catch (e: any) { notify(e.message, false); }
    finally { setIsImporting(false); }
  };

  // ── AUDIT (check prices) ──────────────────────────────────────────────────
  const handleAudit = async () => {
    if (!lots.length) { notify('No lots loaded yet', false); return; }
    setIsAuditing(true);
    try {
      // Group by baseName+universeId and check each group
      const groups = new Map<string, GamepassLot>();
      lots.forEach(l => groups.set(`${l.baseName}::${l.universeId}`, l));
      
      for (const [, sample] of groups) {
        const data = await api('/check_prices', 'POST', { baseName: sample.baseName, universeId: sample.universeId });
        if (data.results) {
          setLots(prev => prev.map(lot => {
            const result = data.results.find((r: any) => r.id === lot.id);
            if (!result) return lot;
            return { ...lot, robloxPrice: result.price ?? 0, currentPrice: result.price ?? 0, isForSale: result.isForSale };
          }));
        }
      }
      notify('Audit complete');
    } catch (e: any) { notify(e.message, false); }
    finally { setIsAuditing(false); }
  };

  // ── PER-ROW PRICE SYNC ────────────────────────────────────────────────────
  const handleRowPrice = async (lot: GamepassLot, price: string) => {
    if (!price) return;
    try {
      await api('/set_price', 'POST', { baseName: lot.baseName, universeId: lot.universeId, price: parseFloat(price) });
      setLots(prev => prev.map(l => l.id === lot.id ? { ...l, currentPrice: parseFloat(price), robloxPrice: parseFloat(price) } : l));
      notify(`${lot.name} → ${price} R$`);
    } catch (e: any) { notify(e.message, false); }
  };

  // ── PER-ROW TOGGLE SALE ───────────────────────────────────────────────────
  const handleRowToggle = async (lot: GamepassLot) => {
    const newState = !lot.isForSale;
    try {
      await api('/toggle_sale', 'POST', {
        baseName: lot.baseName, universeId: lot.universeId,
        forSale: newState, price: lot.currentPrice
      });
      setLots(prev => prev.map(l => l.id === lot.id ? { ...l, isForSale: newState } : l));
      notify(`${lot.name} → ${newState ? 'ON SALE' : 'OFF SALE'}`);
    } catch (e: any) { notify(e.message, false); }
  };

  // ── BULK SYNC ─────────────────────────────────────────────────────────────
  const handleBulkSync = async () => {
    if (!bulkPrice || !lots.length) return;
    setIsBulkSyncing(true);
    try {
      const groups = new Map<string, GamepassLot>();
      lots.forEach(l => groups.set(`${l.baseName}::${l.universeId}`, l));
      for (const [, sample] of groups) {
        await api('/sync', 'POST', { baseName: sample.baseName, universeId: sample.universeId, price: parseFloat(bulkPrice) });
      }
      setLots(prev => prev.map(l => ({ ...l, currentPrice: parseFloat(bulkPrice), robloxPrice: parseFloat(bulkPrice), isForSale: true })));
      notify(`All lots synced to ${bulkPrice} R$`);
    } catch (e: any) { notify(e.message, false); }
    finally { setIsBulkSyncing(false); }
  };

  // ── EMERGENCY SHUTDOWN ────────────────────────────────────────────────────
  const handleShutdown = async () => {
    try {
      const groups = new Map<string, GamepassLot>();
      lots.forEach(l => groups.set(`${l.baseName}::${l.universeId}`, l));
      for (const [, sample] of groups) {
        await api('/toggle_sale', 'POST', { baseName: sample.baseName, universeId: sample.universeId, forSale: false });
      }
      setLots(prev => prev.map(l => ({ ...l, isForSale: false })));
      setShowShutdown(false);
      notify('All lots taken off sale');
    } catch (e: any) { notify(e.message, false); }
  };

  // ── ACTIVATE ALL ──────────────────────────────────────────────────────────
  const handleActivateAll = async () => {
    try {
      const groups = new Map<string, GamepassLot>();
      lots.forEach(l => groups.set(`${l.baseName}::${l.universeId}`, l));
      for (const [, sample] of groups) {
        await api('/toggle_sale', 'POST', { baseName: sample.baseName, universeId: sample.universeId, forSale: true, price: sample.currentPrice });
      }
      setLots(prev => prev.map(l => ({ ...l, isForSale: true })));
      notify('All lots activated');
    } catch (e: any) { notify(e.message, false); }
  };

  // ── FACTORY ───────────────────────────────────────────────────────────────
  const handleFactory = async () => {
    if (!fPrefix || !fQty || !fPrice || !fUniverse) return;
    setFactoryStatus('processing');
    try {
      const data = await api('/create_lots', 'POST', {
        baseName: fPrefix, prefix: fPrefix,
        count: parseInt(fQty), quantity: parseInt(fQty),
        price: parseFloat(fPrice),
        universeId: fUniverse, universe_id: fUniverse,
      });
      setFactoryCount(data.created || data.created_count || parseInt(fQty));
      setFactoryStatus('done');
      await fetchLots();
      setTimeout(() => { setFactoryStatus('idle'); setShowFactory(false); }, 3000);
    } catch (e: any) { notify(e.message, false); setFactoryStatus('idle'); }
  };

  const filteredLots = lots.filter(l =>
    !search || l.name.toLowerCase().includes(search.toLowerCase()) || l.baseName.toLowerCase().includes(search.toLowerCase())
  );

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#fcfcfc] dark:bg-[#080808] text-[#1a1a1a] dark:text-[#f0f0f0] font-sans transition-colors duration-300 pb-24">

      {/* Notification toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-[300] px-5 py-3 rounded-xl text-sm font-semibold shadow-xl border ${
              notification.ok
                ? 'bg-emerald-500 text-white border-emerald-400'
                : 'bg-rose-500 text-white border-rose-400'
            }`}
          >
            {notification.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nav */}
      <nav className="h-14 border-b border-gray-100 dark:border-white/5 px-6 md:px-12 flex items-center justify-between bg-white/90 dark:bg-black/90 backdrop-blur sticky top-0 z-50">
        <div className="flex items-center gap-10">
          <h1 className="text-lg font-semibold tracking-tight text-black dark:text-white">
            Blox<span className="font-light text-gray-400 dark:text-gray-600">Ex</span>
          </h1>
          <div className="flex items-center gap-6">
            {(['market', 'manage'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`text-sm tracking-wide capitalize transition-colors ${activeTab === tab ? 'font-semibold text-black dark:text-white' : 'text-gray-400 dark:text-gray-600 hover:text-black dark:hover:text-white'}`}>
                {tab === 'market' ? 'Market' : 'Manage'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-gray-100 dark:border-white/5">
            <div className={`w-1.5 h-1.5 rounded-full ${bridgeOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            <span className={`text-[10px] font-bold uppercase tracking-wider ${bridgeOnline ? 'text-emerald-500' : 'text-rose-500'}`}>
              {bridgeOnline ? 'Online' : 'Offline'}
            </span>
          </div>
          <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5 transition-colors text-gray-500">
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 md:px-12 pt-12">

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-6 mb-12">
          {[
            { label: 'Total Lots', value: lots.length },
            { label: 'On Sale', value: lots.filter(l => l.isForSale).length },
            { label: 'Off Sale', value: lots.filter(l => !l.isForSale).length },
          ].map(({ label, value }) => (
            <div key={label} className="p-5 rounded-2xl border border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
              <div className="text-[10px] uppercase tracking-widest font-semibold text-gray-400 dark:text-gray-600 mb-2">{label}</div>
              <div className="text-3xl font-light text-black dark:text-white">{value}</div>
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.15 }}>

            {/* ── MARKET TAB ─────────────────────────────────────────────── */}
            {activeTab === 'market' && (
              <div className="space-y-10">

                {/* Import section */}
                <section className="p-6 rounded-2xl border border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
                  <div className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-4">Import Lots from Roblox</div>
                  <div className="flex flex-col md:flex-row gap-3">
                    <input type="text" placeholder="Base Name (e.g. CATI)" value={importBase} onChange={e => setImportBase(e.target.value)}
                      className="flex-1 bg-white dark:bg-black border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-black dark:focus:ring-white" />
                    <input type="text" placeholder="Universe ID" value={importUniverse} onChange={e => setImportUniverse(e.target.value)}
                      className="flex-1 bg-white dark:bg-black border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-black dark:focus:ring-white" />
                    <button onClick={handleImport} disabled={isImporting || !importBase || !importUniverse}
                      className="px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest bg-black dark:bg-white text-white dark:text-black hover:opacity-90 disabled:opacity-40 transition-all flex items-center gap-2">
                      {isImporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                      {isImporting ? 'Scanning...' : 'Scan Roblox'}
                    </button>
                  </div>
                </section>

                {/* Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-white/5">
                  <div className="flex items-center gap-3">
                    <button onClick={handleAudit} disabled={isAuditing}
                      className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-500/20 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/5 hover:bg-amber-100 dark:hover:bg-amber-500/10 transition-all">
                      <RefreshCw size={11} className={isAuditing ? 'animate-spin' : ''} />
                      {isAuditing ? 'Auditing...' : 'Refresh Audit'}
                    </button>
                    <button onClick={() => setShowFactory(true)}
                      className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest px-3 py-2 rounded-lg border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/5 hover:bg-emerald-100 dark:hover:bg-emerald-500/10 transition-all">
                      <Factory size={11} />
                      Bulk Factory
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={handleActivateAll}
                      className="px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-emerald-500 hover:bg-emerald-600 text-white transition-all">
                      Activate All
                    </button>
                    <button onClick={() => setShowShutdown(true)}
                      className="px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-rose-500 hover:bg-rose-600 text-white transition-all">
                      Shutdown All
                    </button>
                    <div className="flex items-center bg-gray-50 dark:bg-white/5 rounded-lg border border-gray-100 dark:border-white/10 overflow-hidden">
                      <input type="number" placeholder="Bulk price" value={bulkPrice} onChange={e => setBulkPrice(e.target.value)}
                        className="w-24 pl-3 pr-1 py-2 text-xs bg-transparent outline-none placeholder:text-gray-300 dark:placeholder:text-gray-700" />
                      <button onClick={handleBulkSync} disabled={isBulkSyncing || !bulkPrice}
                        className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest bg-black dark:bg-white text-white dark:text-black disabled:opacity-40 flex items-center gap-1">
                        {isBulkSyncing ? <Loader2 size={10} className="animate-spin" /> : <TrendingUp size={10} />}
                        Sync
                      </button>
                    </div>
                    <div className="relative">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 dark:text-gray-700" />
                      <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
                        className="pl-8 pr-4 py-2 text-xs bg-gray-50 dark:bg-white/5 rounded-lg border border-gray-100 dark:border-white/5 outline-none w-36 focus:ring-1 focus:ring-black dark:focus:ring-white placeholder:text-gray-300 dark:placeholder:text-gray-700" />
                    </div>
                  </div>
                </div>

                {/* Lots table */}
                {filteredLots.length === 0 ? (
                  <div className="py-24 text-center text-xs uppercase tracking-widest text-gray-300 dark:text-gray-700">
                    {lots.length === 0 ? 'No lots loaded — import or create some' : 'No results'}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-[10px] uppercase tracking-widest text-gray-300 dark:text-gray-700">
                          <th className="pb-5 font-medium">ID</th>
                          <th className="pb-5 font-medium">Name</th>
                          <th className="pb-5 font-medium">Group</th>
                          <th className="pb-5 font-medium">Status</th>
                          <th className="pb-5 font-medium text-right">Price (R$)</th>
                          <th className="pb-5 font-medium text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                        {filteredLots.map(lot => (
                          <tr key={lot.id} className="group hover:bg-gray-50/50 dark:hover:bg-white/[0.015] transition-colors">
                            <td className="py-4 font-mono text-[10px] text-gray-400 dark:text-gray-600">{lot.id.slice(-8)}</td>
                            <td className="py-4">
                              <div className="text-sm font-medium text-black dark:text-white">{lot.name}</div>
                              <div className="text-[10px] text-gray-400 mt-0.5">Universe: {lot.universeId}</div>
                            </td>
                            <td className="py-4 text-xs text-gray-500 dark:text-gray-500 font-mono uppercase">{lot.baseName}</td>
                            <td className="py-4">
                              <button onClick={() => handleRowToggle(lot)}
                                className={`flex items-center gap-1.5 text-[9px] font-bold px-2.5 py-1.5 rounded-md tracking-wide transition-all ${
                                  lot.isForSale
                                    ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100'
                                    : 'bg-gray-100 dark:bg-white/5 text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10'
                                }`}>
                                {lot.isForSale ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
                                {lot.isForSale ? 'ON SALE' : 'OFF SALE'}
                              </button>
                            </td>
                            <td className="py-4 text-right">
                              <div className="text-sm font-mono font-medium text-gray-700 dark:text-gray-300">
                                {lot.currentPrice > 0 ? lot.currentPrice : '—'}
                                {lot.robloxPrice !== undefined && lot.robloxPrice !== lot.currentPrice && lot.robloxPrice > 0 && (
                                  <div className="text-[9px] text-amber-500 font-bold">MISMATCH</div>
                                )}
                              </div>
                            </td>
                            <td className="py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <input type="number" placeholder="Price"
                                  defaultValue={lot.currentPrice || ''}
                                  className="w-20 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                                  onKeyDown={e => { if (e.key === 'Enter') handleRowPrice(lot, (e.target as HTMLInputElement).value); }}
                                  onBlur={e => handleRowPrice(lot, e.target.value)}
                                />
                                <span className="text-[9px] text-gray-300 dark:text-gray-700">↵ to save</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── MANAGE TAB ─────────────────────────────────────────────── */}
            {activeTab === 'manage' && (
              <div className="space-y-8">
                <div className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-6">Bulk Group Management</div>

                {/* Group cards */}
                {(() => {
                  const groups = new Map<string, GamepassLot[]>();
                  lots.forEach(l => {
                    const key = `${l.baseName}::${l.universeId}`;
                    if (!groups.has(key)) groups.set(key, []);
                    groups.get(key)!.push(l);
                  });

                  if (groups.size === 0) return (
                    <div className="py-24 text-center text-xs uppercase tracking-widest text-gray-300 dark:text-gray-700">
                      No groups — import or create lots first
                    </div>
                  );

                  return Array.from(groups.entries()).map(([key, groupLots]) => {
                    const sample = groupLots[0];
                    const onSale = groupLots.filter(l => l.isForSale).length;
                    const [groupPrice, setGroupPrice] = React.useState('');

                    return (
                      <div key={key} className="p-6 rounded-2xl border border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
                        <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
                          <div>
                            <div className="text-lg font-semibold text-black dark:text-white">{sample.baseName}</div>
                            <div className="text-xs text-gray-400 mt-1">Universe: {sample.universeId} · {groupLots.length} lots · {onSale} on sale</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={async () => {
                              try {
                                await api('/toggle_sale', 'POST', { baseName: sample.baseName, universeId: sample.universeId, forSale: true, price: sample.currentPrice });
                                setLots(prev => prev.map(l => l.baseName === sample.baseName && l.universeId === sample.universeId ? { ...l, isForSale: true } : l));
                                notify(`${sample.baseName} → ON SALE`);
                              } catch (e: any) { notify(e.message, false); }
                            }} className="px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-emerald-500 hover:bg-emerald-600 text-white transition-all">
                              On Sale
                            </button>
                            <button onClick={async () => {
                              try {
                                await api('/toggle_sale', 'POST', { baseName: sample.baseName, universeId: sample.universeId, forSale: false });
                                setLots(prev => prev.map(l => l.baseName === sample.baseName && l.universeId === sample.universeId ? { ...l, isForSale: false } : l));
                                notify(`${sample.baseName} → OFF SALE`);
                              } catch (e: any) { notify(e.message, false); }
                            }} className="px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-rose-500 hover:bg-rose-600 text-white transition-all">
                              Off Sale
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <input type="number" placeholder="New price (R$)" value={groupPrice} onChange={e => setGroupPrice(e.target.value)}
                            className="flex-1 bg-white dark:bg-black border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-black dark:focus:ring-white" />
                          <button onClick={async () => {
                            if (!groupPrice) return;
                            try {
                              await api('/set_price', 'POST', { baseName: sample.baseName, universeId: sample.universeId, price: parseFloat(groupPrice) });
                              setLots(prev => prev.map(l => l.baseName === sample.baseName && l.universeId === sample.universeId ? { ...l, currentPrice: parseFloat(groupPrice) } : l));
                              notify(`${sample.baseName} → ${groupPrice} R$`);
                              setGroupPrice('');
                            } catch (e: any) { notify(e.message, false); }
                          }} className="px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest bg-black dark:bg-white text-white dark:text-black hover:opacity-90 transition-all">
                            Set Price
                          </button>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── FACTORY PANEL ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showFactory && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => factoryStatus !== 'processing' && setShowFactory(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100]" />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
              className="fixed inset-y-0 right-0 w-full max-w-md bg-white dark:bg-[#0d0d0d] shadow-2xl z-[101] border-l border-gray-100 dark:border-white/5 p-8 flex flex-col">
              <div className="flex items-center justify-between mb-10">
                <div>
                  <h2 className="text-xl font-semibold text-black dark:text-white">Bulk Factory</h2>
                  <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest">Create lots in batch</p>
                </div>
                <button onClick={() => setShowFactory(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full text-gray-400 transition-colors">
                  <X size={18} />
                </button>
              </div>

              {factoryStatus === 'idle' && (
                <div className="flex-1 space-y-5">
                  {[
                    { label: 'Base Name', ph: 'e.g. CATI', val: fPrefix, set: setFPrefix, type: 'text' },
                    { label: 'Universe ID', ph: 'Roblox Universe ID', val: fUniverse, set: setFUniverse, type: 'text' },
                  ].map(({ label, ph, val, set, type }) => (
                    <div key={label}>
                      <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-2 block">{label}</label>
                      <input type={type} value={val} onChange={e => set(e.target.value)} placeholder={ph}
                        className="w-full bg-gray-50 dark:bg-white/5 rounded-xl px-4 py-3 outline-none focus:ring-1 focus:ring-black dark:focus:ring-white text-sm" />
                    </div>
                  ))}
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: 'Quantity', ph: '20', val: fQty, set: setFQty },
                      { label: 'Price (R$)', ph: '100', val: fPrice, set: setFPrice },
                    ].map(({ label, ph, val, set }) => (
                      <div key={label}>
                        <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-2 block">{label}</label>
                        <input type="number" value={val} onChange={e => set(e.target.value)} placeholder={ph}
                          className="w-full bg-gray-50 dark:bg-white/5 rounded-xl px-4 py-3 outline-none focus:ring-1 focus:ring-black dark:focus:ring-white text-sm" />
                      </div>
                    ))}
                  </div>
                  <div className="p-4 bg-amber-50 dark:bg-amber-500/5 rounded-xl border border-amber-200/50 dark:border-amber-500/10">
                    <p className="text-[10px] text-amber-700 dark:text-amber-500 font-medium uppercase tracking-wider">
                      Rate limited to 5 req/s. Allow ~{Math.ceil(parseInt(fQty || '0') * 0.22)}s for {fQty || 'N'} lots.
                    </p>
                  </div>
                  <button onClick={handleFactory} disabled={!fPrefix || !fQty || !fPrice || !fUniverse}
                    className="w-full bg-black dark:bg-white text-white dark:text-black py-4 rounded-xl font-bold uppercase tracking-widest text-xs hover:opacity-90 disabled:opacity-40 transition-all">
                    Start Batch
                  </button>
                </div>
              )}

              {factoryStatus === 'processing' && (
                <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center">
                  <Loader2 size={44} className="animate-spin text-black dark:text-white" />
                  <div>
                    <p className="text-lg font-medium text-black dark:text-white">Creating lots...</p>
                    <p className="text-xs text-gray-400 mt-1">Rate limiting active — please wait</p>
                  </div>
                </div>
              )}

              {factoryStatus === 'done' && (
                <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center">
                  <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    className="w-16 h-16 bg-emerald-50 dark:bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500">
                    <CheckCircle2 size={32} />
                  </motion.div>
                  <div>
                    <p className="text-lg font-medium text-black dark:text-white">Done!</p>
                    <p className="text-xs text-gray-400 mt-1">Created <span className="font-bold text-emerald-500">{factoryCount}</span> lots</p>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── SHUTDOWN CONFIRM ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {showShutdown && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowShutdown(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-md z-[200]" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white dark:bg-[#0f0f0f] p-8 rounded-3xl shadow-2xl z-[201] border border-rose-500/20">
              <div className="text-center space-y-5">
                <div className="w-14 h-14 bg-rose-500/10 rounded-full flex items-center justify-center text-rose-500 mx-auto">
                  <TrendingDown size={28} />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-black dark:text-white">Emergency Shutdown</h3>
                  <p className="text-sm text-gray-400 mt-2">All lots will be taken off sale immediately.</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowShutdown(false)}
                    className="flex-1 px-4 py-3 bg-gray-100 dark:bg-white/5 text-gray-500 rounded-xl text-xs font-bold uppercase tracking-widest">
                    Cancel
                  </button>
                  <button onClick={handleShutdown}
                    className="flex-1 px-4 py-3 bg-rose-500 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-rose-600 transition-all">
                    Shutdown
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <footer className="max-w-6xl mx-auto px-6 md:px-12 mt-20 pt-8 border-t border-gray-100 dark:border-white/5 flex justify-between items-center">
        <span className="text-[9px] uppercase tracking-[0.3em] font-semibold text-gray-300 dark:text-gray-700">BloxEx Market Proxy</span>
        <span className="text-[9px] uppercase tracking-widest text-gray-300 dark:text-gray-700">Roblox Economy Services</span>
      </footer>
    </div>
  );
}
