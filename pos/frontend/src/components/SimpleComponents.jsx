// Professional Elegant POS Components

import React, { useState, useEffect } from 'react';
import api, { setAccessCode } from '../services/api';
import { resolveBackendTableId } from './shared/tableMap';
import { useNavigate, useParams } from 'react-router-dom';

// Elegant Tables Page with Professional Design
export const TablesPage = () => {
  const [tables, setTables] = useState([]);
  const navigate = useNavigate();
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusFor, setStatusFor] = useState(null); // table object
  const [statusInfo, setStatusInfo] = useState(null);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [finalizeFor, setFinalizeFor] = useState(null);
  const [finalizeData, setFinalizeData] = useState(null);
  const [startOpen, setStartOpen] = useState(false);
  const [startFor, setStartFor] = useState(null);
  const [startConfig, setStartConfig] = useState({ tariff: 'Hall $10/hr', rate: 10, limited: false, minutes: 60 });
  const [nowTs, setNowTs] = useState(Date.now());
  const [transferFor, setTransferFor] = useState(null);
  const [mergeFor, setMergeFor] = useState(null);
  const [notesFor, setNotesFor] = useState(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [splitFor, setSplitFor] = useState(null);
  const [splitPercent, setSplitPercent] = useState(50);
  // Manager approval modal state
  const [mgrOpen, setMgrOpen] = useState(false);
  const [mgrFor, setMgrFor] = useState(null); // table object
  const [mgrAction, setMgrAction] = useState(null); // 'finalize' | 'end'
  const [mgrReason, setMgrReason] = useState('');
  const [mgrPin, setMgrPin] = useState('');
  const [mgrBusy, setMgrBusy] = useState(false);
  const [mgrError, setMgrError] = useState('');
  // KDS lite state
  const [kdsOpen, setKdsOpen] = useState(false);
  const [kdsOrders, setKdsOrders] = useState([]);
  const [kdsBusy, setKdsBusy] = useState(false);
  const [kdsCode, setKdsCode] = useState(() => {
    try { return localStorage.getItem('pos_access_code') || '1234'; } catch { return '1234'; }
  });
  // Admin settings state
  const [accessCtrl, setAccessCtrl] = useState(null); // from settings: access_control
  const [kdsCfg, setKdsCfg] = useState({ pollIntervalMs: 5000, soundOnNewTicket: true, showModifiers: true, showTicketAging: true });

  // Store receipt settings helpers
  const getStoreConfig = () => {
    try {
      const raw = localStorage.getItem('pos_store_config');
      if (raw) return JSON.parse(raw);
    } catch {}
    return { name: 'BOLA8 POS', address: '123 Billiard Lane, Cue City', footer: 'Thank you for visiting! Please pay your server.' };
  };

  // Optional mapping now imported from './shared/tableMap'
  const storeCfg = getStoreConfig();

  useEffect(() => {
    // simple toast helper
    // placed here to keep diff small; real app should move to a shared component
    setToast(null);
    const load = async () => {
      try {
        const rows = await api.getTables();
        const mapped = (rows || []).map(r => ({
          id: r.id,
          type: r.type,
          name: r.name,
          status: r.status || 'available',
          elapsedTime: Number(r.elapsed_time || 0),
          hourlyRate: Number(r.hourly_rate || 0),
          servicesTotal: Number(r.current_bill || 0),
          paused: !!r.paused,
          cleaningUntil: Number(r.cleaning_until || 0),
          limitEnd: Number(r.limit_end || 0) || undefined,
          capacity: Number(r.capacity || 4),
          revenue: Number(r.current_bill || 0),
        }));
        setTables(mapped);
      } catch (e) {
        console.error('Failed to load tables from backend', e);
      }
    };
    load();
    // Load admin settings for access control and KDS
    (async () => {
      try { const ac = await api.getSetting('access_control'); if (ac?.value) setAccessCtrl(ac.value); } catch {}
      try { const kc = await api.getSetting('kds'); if (kc?.value) setKdsCfg({ ...kdsCfg, ...kc.value }); } catch {}
    })();
  }, []);

  // Toast state and helper
  const [toast, setToast] = useState(null); // { msg, type: 'success'|'error' }
  const showToast = (msg, type = 'success', ms = 2500) => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), ms);
  };

  // Optional manager PIN requirement for lifecycle actions
  const requireLifecyclePin = () => {
    if (accessCtrl && typeof accessCtrl.requirePinLifecycle !== 'undefined') return !!accessCtrl.requirePinLifecycle;
    // fallback to legacy localStorage flag
    try { return localStorage.getItem('pos_require_pin_lifecycle') === '1'; } catch { return false; }
  };
  const verifyPinIfRequired = async () => {
    if (!requireLifecyclePin()) return true;
    const pin = window.prompt('Manager PIN required for this action:');
    if (!pin) return false;
    try {
      const ok = await api.verifyManagerPin(pin);
      if (ok && ok.valid) return true;
      showToast('Invalid manager PIN', 'error');
      return false;
    } catch (e) {
      console.error('PIN verify failed', e);
      showToast('PIN verification failed', 'error');
      return false;
    }
  };

  // tick to update countdowns
  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // KDS helpers
  const refreshKDS = async () => {
    try {
      const data = await api.getKDSOrders();
      setKdsOrders(data.orders || []);
    } catch (e) {
      console.error('KDS fetch failed', e);
    }
  };
  const openKDS = async () => {
    setKdsOpen(true);
    await refreshKDS();
  };
  // Live polling while KDS is open
  useEffect(() => {
    if (!kdsOpen) return;
    const interval = Math.max(500, Number(kdsCfg?.pollIntervalMs || 5000));
    const iv = setInterval(() => { refreshKDS(); }, interval);
    return () => clearInterval(iv);
  }, [kdsOpen, kdsCfg?.pollIntervalMs]);
  const saveAccessCode = () => {
    setAccessCode(kdsCode);
    alert('Access code saved');
  };
  const updateKDSStatus = async (id, status) => {
    setKdsBusy(true);
    try {
      await api.updateOrderStatus(id, status);
      await refreshKDS();
    } catch (e) {
      console.error(e);
      alert('Failed to update status');
    } finally {
      setKdsBusy(false);
    }
  };
  const recallKDS = async (id) => {
    setKdsBusy(true);
    try {
      await api.recallOrder(id);
      await refreshKDS();
    } catch (e) {
      console.error(e);
      alert('Failed to recall');
    } finally {
      setKdsBusy(false);
    }
  };

  // Add Table helper (demo)
  const addTable = async () => {
    try {
      const id = prompt('Enter table ID (e.g., B6 or T11):');
      if (!id) return;
      const name = prompt('Enter table name:', id.startsWith('B') ? `Billiard Table ${id.replace(/\D/g,'')}` : `Bar Table ${id.replace(/\D/g,'')}`) || id;
      const type = (prompt('Enter type: billiard or bar', id.startsWith('B') ? 'billiard' : 'bar') || '').trim();
      if (!['billiard','bar'].includes(type)) { alert('Invalid type'); return; }
      const capacityStr = prompt('Capacity (default 4):', '4');
      const capacity = Math.max(1, parseInt(capacityStr || '4', 10) || 4);
      const hourly_rate = type === 'billiard' ? 15 : 0;
      const created = await api.createTable({ id, name, type, status: 'available', capacity, hourly_rate });
      // reflect in UI
      setTables(prev => ([
        ...prev,
        {
          id: created?.id || id,
          type,
          name: created?.name || name,
          status: 'available',
          elapsedTime: 0,
          hourlyRate: hourly_rate,
          servicesTotal: 0,
          paused: false,
          cleaningUntil: 0,
          capacity,
          revenue: 0,
        }
      ]));
      alert('Table created');
    } catch (e) {
      console.error(e);
      alert('Failed to add table');
    }
  };

  // Utils
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const seedFromId = (id) => {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return h;
  };

  const pseudoRand = (seed) => {
    // simple LCG
    let s = seed;
    return () => (s = (1103515245 * s + 12345) % 0x80000000) / 0x80000000;
  };

  const computeStatus = (table) => {
    const rng = pseudoRand(seedFromId(table.id));
    const occupied = table.status === 'occupied';
    const elapsed = occupied
      ? table.elapsedTime && table.elapsedTime > 0
        ? table.elapsedTime
        : Math.floor(rng() * 5400 + 600) // 10m - 90m
      : 0;
    const items = occupied ? Math.floor(rng() * 6) + (table.type === 'billiard' ? 1 : 0) : 0;
    const combosAvailable = ['Billiard Special', 'Friends Pack', 'La Barra Duo'];
    const comboApplied = occupied && rng() > 0.7 ? combosAvailable[Math.floor(rng() * combosAvailable.length)] : null;
    const inProcess = occupied
      ? Array.from({ length: Math.floor(rng() * 3) }, (_, i) => ({
          id: `K${table.id}-${i + 1}`,
          name: rng() > 0.5 ? 'Buffalo Wings' : 'Margarita',
          quantity: Math.floor(rng() * 3) + 1,
          status: rng() > 0.6 ? 'in-progress' : 'pending'
        }))
      : [];
    return { elapsed, items, comboApplied, inProcess };
  };

  const computeFinalize = (table) => {
    const s = computeStatus(table);
    const sessionId = `${Date.now()}${Math.floor(Math.random()*1000)}`;
    const rate = table.type === 'billiard' ? (table.hourlyRate || 15) : 0; // use selected tariff if any
    const minutes = Math.ceil(s.elapsed / 60);
    const tableCharge = rate > 0 ? Math.max(rate * (minutes / 60), 2) : 0; // min $2
    const services = table.servicesTotal || 0;
    const subtotal = tableCharge + services; // include services
    const tax = +(subtotal * 0.08).toFixed(2);
    const total = +(subtotal + tax).toFixed(2);
    return { sessionId, minutes, rate, tableCharge: +tableCharge.toFixed(2), services: +services.toFixed(2), subtotal: +subtotal.toFixed(2), tax, total };
  };

  const confirmManagerAction = async () => {
    if (!mgrFor || !mgrAction) return;
    setMgrBusy(true);
    setMgrError('');
    try {
      if (mgrAction === 'finalize') {
        await api.finalizeTableBill(mgrFor.id, { reason: mgrReason, managerPin: mgrPin });
        // open pre-bill modal
        setFinalizeFor(mgrFor);
        setFinalizeData(computeFinalize(mgrFor));
        setFinalizeOpen(true);
      } else if (mgrAction === 'end') {
        await api.endTableSession(mgrFor.id, { reason: mgrReason, managerPin: mgrPin });
        // reflect in UI
        setTables(prev => prev.map(t => t.id===mgrFor.id ? { ...t, status: 'available', elapsedTime: 0 } : t));
      }
      setMgrOpen(false);
      setMgrFor(null);
      setMgrAction(null);
      setMgrReason('');
      setMgrPin('');
    } catch (e) {
      console.error(e);
      setMgrError(e?.message || 'Action failed');
    } finally {
      setMgrBusy(false);
    }
  };

  const printHtml = (html) => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  const handleTableAction = (tableId, action) => {
    setTables(prev => prev.map(table => {
      if (table.id === tableId) {
        switch (action) {
          case 'start':
            return { ...table, status: 'occupied', startTime: new Date() };
          case 'stop':
            return { ...table, status: 'available', startTime: null, elapsedTime: 0 };
          default:
            return table;
        }
      }
      return table;
    }));
  };

  // Helper to edit services added at start
  const StartServicesEditor = ({ startConfig, setStartConfig }) => {
    const services = startConfig.services || [];
    const update = (idx, key, value) => {
      const next = services.map((s, i) => i===idx ? { ...s, [key]: value } : s);
      setStartConfig(cfg => ({ ...cfg, services: next }));
    };
    const add = () => {
      const next = [...services, { name: '', price: 0 }];
      setStartConfig(cfg => ({ ...cfg, services: next }));
    };
    const remove = (idx) => {
      const next = services.filter((_, i) => i!==idx);
      setStartConfig(cfg => ({ ...cfg, services: next }));
    };
    const total = services.reduce((a,b)=> a + (Number(b.price)||0), 0);
    return (
      <div className="space-y-3">
        {services.length === 0 && (
          <div className="text-slate-400 text-sm">No services added. Use Add Service to include cues, shoes, etc.</div>
        )}
      {/* Manager Approval Modal */}
      {mgrOpen && mgrFor && (
        <div className="fixed inset-0 z-[125]">
          <div className="absolute inset-0 bg-black/60" onClick={()=>setMgrOpen(false)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
                <div className="text-white font-bold text-xl">Manager Approval</div>
                <button className="text-slate-300 hover:text-white text-xl" onClick={()=>setMgrOpen(false)}>✕</button>
              </div>
              <div className="p-6 space-y-4 text-slate-200">
                <form onSubmit={(e) => { e.preventDefault(); if (!mgrBusy) confirmManagerAction(); }}>
                  <div className="text-sm text-slate-400">Action: <span className="text-slate-200 font-semibold">{mgrAction === 'finalize' ? 'Finalize Bill' : 'End Session'}</span> • Table <span className="font-semibold">{mgrFor.id}</span></div>
                  <div className="mt-3">
                    <label className="block text-sm text-slate-400 mb-1">Reason</label>
                    <input value={mgrReason} onChange={e=>setMgrReason(e.target.value)} className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-700" placeholder="Enter reason" />
                  </div>
                  <div className="mt-3">
                    <label className="block text-sm text-slate-400 mb-1">Manager PIN</label>
                    <input type="password" value={mgrPin} onChange={e=>setMgrPin(e.target.value)} className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-700" placeholder="••••" />
                  </div>
                  {mgrError && <div className="text-rose-400 text-sm mt-2">{mgrError}</div>}
                  <div className="flex justify-end gap-2 pt-4">
                    <button type="button" disabled={mgrBusy} className="px-4 py-2 rounded-lg border border-slate-600 text-slate-200" onClick={()=>setMgrOpen(false)}>Cancel</button>
                    <button type="submit" disabled={mgrBusy} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white">{mgrBusy ? 'Working…' : 'Approve'}</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* KDS Modal */}
      {kdsOpen && (
        <div className="fixed inset-0 z-[130]">
          <div className="absolute inset-0 bg-black/60" onClick={()=>setKdsOpen(false)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-5xl bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
                <div className="text-white font-bold text-xl">Kitchen/Bar Queue</div>
                <div className="flex items-center gap-2">
                  <input value={kdsCode} onChange={e=>setKdsCode(e.target.value)} placeholder="Access code" className="bg-slate-800 text-white rounded px-3 py-1 border border-slate-700 text-sm" />
                  <button onClick={saveAccessCode} className="px-3 py-1 rounded bg-slate-700 text-white text-sm">Save</button>
                  <button onClick={refreshKDS} className="ml-2 px-3 py-1 rounded bg-slate-700 text-white text-sm">Refresh</button>
                  <button onClick={()=>setKdsOpen(false)} className="ml-2 text-slate-300 hover:text-white text-xl">✕</button>
                </div>
              </div>
              <div className="p-6 max-h-[70vh] overflow-auto grid grid-cols-1 md:grid-cols-2 gap-4">
                {kdsOrders.length === 0 && (
                  <div className="text-slate-400">No pending orders.</div>
                )}
                {kdsOrders.map(o => (
                  <div key={o.id} className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-white font-semibold">Order #{o.id.slice(0,8)}</div>
                      <div className="text-xs text-slate-400">{new Date(o.createdAt||Date.now()).toLocaleTimeString()}</div>
                    </div>
                    <div className="text-slate-300 text-sm mb-3">Table: {o.table || '—'} • Status: {o.kitchenStatus}</div>
                    <ul className="text-slate-200 text-sm mb-3 list-disc pl-5">
                      {(o.items||[]).map((it, idx) => (
                        <li key={idx}>{it.id} × {it.qty || 1}</li>
                      ))}
                    </ul>
                    <div className="flex gap-2">
                      <button disabled={kdsBusy} onClick={()=>updateKDSStatus(o.id,'in_progress')} className="px-3 py-2 rounded bg-amber-600 hover:bg-amber-500 text-white text-sm">In Progress</button>
                      <button disabled={kdsBusy} onClick={()=>updateKDSStatus(o.id,'done')} className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-sm">Done</button>
                      <button disabled={kdsBusy} onClick={()=>recallKDS(o.id)} className="px-3 py-2 rounded bg-slate-600 hover:bg-slate-500 text-white text-sm">Recall</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      
        {services.map((s, idx) => (
          <div key={idx} className="grid grid-cols-12 gap-3 items-center">
            <input
              value={s.name}
              onChange={(e)=>update(idx, 'name', e.target.value)}
              placeholder="Service name"
              className="col-span-6 bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-700"
            />
            <input
              type="number" step="0.01"
              value={s.price}
              onChange={(e)=>update(idx, 'price', parseFloat(e.target.value)||0)}
              placeholder="0.00"
              className="col-span-4 bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-700"
            />
            <button onClick={()=>remove(idx)} className="col-span-2 px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white">Remove</button>
          </div>
        ))}
        <div className="flex items-center justify-between">
          <button onClick={add} className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white">+ Add Service</button>
          <div className="text-slate-300 text-sm">Total: ${total.toFixed(2)}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center text-2xl">
              🎱
            </div>
            <div className="flex-1">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">Table Management</h1>
              <p className="text-slate-400 text-lg">Manage billiard and bar tables with real-time monitoring</p>
            </div>
            <div className="shrink-0">
              <button onClick={openKDS} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white">🍳 KDS</button>
              <button onClick={addTable} className="ml-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white">➕ Add Table</button>
            </div>
          </div>
        </div>

        {/* Billiard Tables Section */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-lg flex items-center justify-center text-lg">
                🎯
              </div>
              Billiard Tables
            </h2>
            <div className="text-sm text-slate-400 bg-slate-800/50 px-4 py-2 rounded-lg border border-slate-700">
              $15/hour • Premium Tables
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {tables.filter(t => t.type === 'billiard').map(table => (
              <div key={table.id} className="group relative">
                <div className={`bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl rounded-2xl p-6 border shadow-2xl transition-all duration-500 hover:scale-105 ${
                  (table.status==='occupied' && table.limitEnd && table.limitEnd <= nowTs)
                    ? 'border-rose-500/50 hover:shadow-rose-500/20'
                    : 'border-slate-700/50 hover:shadow-emerald-500/10 hover:border-emerald-500/30'
                }`}>
                  {/* Status Indicator */}
                  <div className="absolute -top-2 -right-2">
                    <div className={`w-6 h-6 rounded-full border-4 border-slate-800 ${
                      table.status === 'available' 
                        ? 'bg-gradient-to-r from-emerald-400 to-green-500 shadow-lg shadow-emerald-500/50' 
                        : 'bg-gradient-to-r from-red-400 to-rose-500 shadow-lg shadow-red-500/50'
                    }`}></div>
                  </div>

                  {/* Cleaning Badge */}
                  {table.cleaningUntil && table.cleaningUntil > nowTs && (
                    <div className="absolute top-2 left-2">
                      <div className="px-2 py-1 rounded-md text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        🧽 Cleaning {(() => { const rem = Math.max(0, Math.floor((table.cleaningUntil - nowTs)/1000)); const m = Math.floor(rem/60).toString().padStart(2,'0'); const s = (rem%60).toString().padStart(2,'0'); return `${m}:${s}`; })()}
                      </div>
                    </div>
                  )}

                  {/* Limited Time Badge */}
                  {table.status === 'occupied' && table.limitEnd && (
                    <div className="absolute top-2 right-2">
                      {(() => {
                        const remSec = Math.floor((table.limitEnd - nowTs) / 1000);
                        if (remSec <= 0) {
                          return (
                            <div className="px-2 py-1 rounded-md text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              ⏰ Time Up
                            </div>
                          );
                        }
                        const m = Math.floor(remSec/60).toString().padStart(2,'0');
                        const s = (remSec%60).toString().padStart(2,'0');
                        return (
                          <div className="px-2 py-1 rounded-md text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            ⏱ {m}:{s}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Table Header */}
                  <div className="mb-6">
                    <h3 className="text-xl font-bold text-white mb-2">{table.id}</h3>
                    <p className="text-slate-400 text-sm">{table.name}</p>
                    {table.note && (
                      <div className="mt-2 text-xs text-slate-300 bg-slate-700/40 inline-block px-2 py-1 rounded-md border border-slate-600">📝 {table.note}</div>
                    )}
                  </div>

                  {/* Timer Display */}
                  <div className="mb-6">
                    <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-600/30">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                        <span className="text-slate-400 text-xs uppercase tracking-wider">Timer</span>
                      </div>
                      <div className="text-center">
                        <span className="text-3xl font-mono font-bold text-white">
                          {formatTime(table.elapsedTime)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Table Info */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="text-center">
                      <div className="text-slate-400 text-xs mb-1">Capacity</div>
                      <div className="text-white font-semibold">{table.capacity}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-slate-400 text-xs mb-1">Revenue</div>
                      <div className="text-emerald-400 font-semibold">${table.revenue}</div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-3">
                    {table.status === 'available' ? (
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => { setStartFor(table); setStartOpen(true); }}
                          className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-300 shadow-lg hover:shadow-emerald-500/25 hover:scale-105"
                        >
                          ▶ Start
                        </button>
                        <button
                          onClick={async () => {
                            if (!(await verifyPinIfRequired())) return;
                            try {
                              await api.setCleaning(table.id, 5);
                              const rows = await api.getTables();
                              const mapped = (rows || []).map(r => ({
                                id: r.id,
                                type: r.type,
                                name: r.name,
                                status: r.status || 'available',
                                elapsedTime: Number(r.elapsed_time || 0),
                                hourlyRate: Number(r.hourly_rate || 0),
                                servicesTotal: Number(r.current_bill || 0),
                                paused: !!r.paused,
                                cleaningUntil: Number(r.cleaning_until || 0),
                                limitEnd: Number(r.limit_end || 0) || undefined,
                                capacity: Number(r.capacity || 4),
                                revenue: Number(r.current_bill || 0),
                              }));
                              setTables(mapped);
                              showToast('Cleaning set for 5 minutes');
                            } catch (e) {
                              console.error('Failed to set cleaning', e);
                              showToast('Failed to set cleaning: ' + (e?.message || 'Unknown error'), 'error');
                            }
                          }}
                          className="w-full bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-300 border border-slate-500"
                        >
                          🧽 Cleaning
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={async () => {
                            if (!(await verifyPinIfRequired())) return;
                            const isPaused = !!(table.isPaused || table.paused);
                            try {
                              if (isPaused) {
                                await api.resumeTable(table.id);
                              } else {
                                await api.pauseTable(table.id);
                              }
                              const rows = await api.getTables();
                              const mapped = (rows || []).map(r => ({
                                id: r.id,
                                type: r.type,
                                name: r.name,
                                status: r.status || 'available',
                                elapsedTime: Number(r.elapsed_time || 0),
                                hourlyRate: Number(r.hourly_rate || 0),
                                servicesTotal: Number(r.current_bill || 0),
                                paused: !!r.paused,
                                cleaningUntil: Number(r.cleaning_until || 0),
                                limitEnd: Number(r.limit_end || 0) || undefined,
                                capacity: Number(r.capacity || 4),
                                revenue: Number(r.current_bill || 0),
                              }));
                              setTables(mapped);
                              showToast(isPaused ? 'Table resumed' : 'Table paused');
                            } catch (e) {
                              console.error('Failed to toggle pause/resume', e);
                              showToast('Failed to toggle pause/resume: ' + (e?.message || 'Unknown error'), 'error');
                            }
                          }}
                          className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold py-3 px-4 rounded-xl"
                        >
                          { (table.isPaused || table.paused) ? '▶ Resume' : '⏸ Pause' }
                        </button>
                        <button
                          onClick={() => setTransferFor(table)}
                          className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold py-3 px-4 rounded-xl"
                        >
                          🔁 Transfer
                        </button>
                        <button
                          onClick={() => setMergeFor(table)}
                          className="w-full bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:from-purple-600 hover:to-fuchsia-700 text-white font-semibold py-3 px-4 rounded-xl"
                        >
                          🧩 Merge
                        </button>
                        <button
                          onClick={() => setSplitFor(table)}
                          className="w-full bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white font-semibold py-3 px-4 rounded-xl"
                        >
                          🪓 Split
                        </button>
                        <button
                          onClick={() => { setNotesFor(table); setNoteDraft(table.note || ''); }}
                          className="w-full bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600 text-white font-semibold py-3 px-4 rounded-xl"
                        >
                          📝 Notes
                        </button>
                        <button
                          onClick={() => { setMgrFor(table); setMgrAction('end'); setMgrReason(''); setMgrPin(''); setMgrError(''); setMgrOpen(true); }}
                          className="col-span-2 w-full bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white font-semibold py-3 px-4 rounded-xl"
                        >
                          ⏹ End Session
                        </button>
                      </div>
                    )}
                    <button onClick={() => navigate(`/orders/${table.id}`)} className="w-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-300 shadow-lg hover:shadow-purple-500/25 hover:scale-105">
                      🛒 View Orders
                    </button>
                    <button
                      onClick={() => {
                        const info = computeStatus(table);
                        setStatusFor(table);
                        setStatusInfo(info);
                        setStatusOpen(true);
                      }}
                      className="w-full bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-300 border border-slate-600"
                    >
                      ℹ️ Status
                    </button>
                    <button
                      onClick={() => { setMgrFor(table); setMgrAction('finalize'); setMgrReason(''); setMgrPin(''); setMgrError(''); setMgrOpen(true); }}
                      className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-300 shadow-lg hover:shadow-amber-500/25 hover:scale-105"
                    >
                      🧾 Finalize Bill
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Start Game Modal */}
        {startOpen && startFor && (
          <div className="fixed inset-0 z-[120]">
            <div className="absolute inset-0 bg-black/60" onClick={() => { setStartOpen(false); setStartFor(null); }} />
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <div className="w-full max-w-2xl bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
                  <div className="text-white font-bold text-xl">Start Game — {startFor.id}</div>
                  <button className="text-slate-300 hover:text-white text-xl" onClick={() => { setStartOpen(false); setStartFor(null); }}>✕</button>
                </div>
                <div className="p-6 space-y-6 text-slate-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Tariff Name</label>
                      <input
                        value={startConfig.tariff}
                        onChange={(e)=>setStartConfig(s=>({ ...s, tariff: e.target.value }))}
                        className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-700"
                        placeholder="e.g., Hall $10/hr"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-1">Rate ($/hr)</label>
                      <input
                        type="number" step="0.01"
                        value={startConfig.rate}
                        onChange={(e)=>setStartConfig(s=>({ ...s, rate: parseFloat(e.target.value)||0 }))}
                        className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-700"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm text-slate-400 mb-1">Time Mode</label>
                      <div className="flex items-center gap-6">
                        <label className="flex items-center gap-2 text-sm">
                          <input type="radio" checked={!startConfig.limited} onChange={()=>setStartConfig(s=>({ ...s, limited: false }))} /> Unlimited
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input type="radio" checked={startConfig.limited} onChange={()=>setStartConfig(s=>({ ...s, limited: true }))} /> Limited
                          <input
                            type="number" min="5" step="5"
                            value={startConfig.minutes}
                            onChange={(e)=>setStartConfig(s=>({ ...s, minutes: parseInt(e.target.value)||60 }))}
                            className="ml-3 w-24 bg-slate-800 text-white rounded-lg px-3 py-1 border border-slate-700"
                          />
                          <span className="text-slate-400 text-xs">minutes</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4">
                    <div className="text-slate-200 font-semibold mb-3">Services</div>
                    <StartServicesEditor startConfig={startConfig} setStartConfig={setStartConfig} />
                  </div>

                  <div className="flex items-center justify-end gap-3">
                    <button onClick={()=>{ setStartOpen(false); setStartFor(null); }} className="px-4 py-2 rounded-lg bg-slate-700 text-white">Cancel</button>
                    <button
                      onClick={async ()=>{
                        try {
                          const servicesTotal = (startConfig.services||[]).reduce((a,b)=>a + (Number(b.price)||0), 0);
                          await api.startTable(startFor.id, {
                            rate: startConfig.rate,
                            limited: !!startConfig.limited,
                            minutes: startConfig.minutes||0,
                            services: servicesTotal,
                          });
                          // reload tables from backend for consistency
                          const rows = await api.getTables();
                          const mapped = (rows || []).map(r => ({
                            id: r.id,
                            type: r.type,
                            name: r.name,
                            status: r.status || 'available',
                            elapsedTime: Number(r.elapsed_time || 0),
                            hourlyRate: Number(r.hourly_rate || 0),
                            servicesTotal: Number(r.current_bill || 0),
                            paused: !!r.paused,
                            cleaningUntil: Number(r.cleaning_until || 0),
                            capacity: Number(r.capacity || 4),
                            revenue: Number(r.current_bill || 0),
                            limitEnd: Number(r.limit_end || 0) || undefined,
                          }));
                          setTables(mapped);
                          showToast('Session started');
                        } catch (e) {
                          console.error('Failed to start table', e);
                          showToast('Failed to start session: ' + (e?.message || 'Unknown error'), 'error');
                        } finally {
                          setStartOpen(false); setStartFor(null);
                        }
                      }}
                      className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                    >
                      ▶ Start Session
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bar Tables Section */}
        <div>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg flex items-center justify-center text-lg">
                🍺
              </div>
              Bar Tables
            </h2>
            <div className="text-sm text-slate-400 bg-slate-800/50 px-4 py-2 rounded-lg border border-slate-700">
              Dining & Drinks
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {tables.filter(t => t.type === 'bar').map(table => (
              <div key={table.id} className="group relative">
                <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50 shadow-2xl hover:shadow-amber-500/10 transition-all duration-500 hover:scale-105 hover:border-amber-500/30">
                  {/* Status Indicator */}
                  <div className="absolute -top-2 -right-2">
                    <div className={`w-6 h-6 rounded-full border-4 border-slate-800 ${
                      table.status === 'available' 
                        ? 'bg-gradient-to-r from-emerald-400 to-green-500 shadow-lg shadow-emerald-500/50' 
                        : 'bg-gradient-to-r from-amber-400 to-orange-500 shadow-lg shadow-amber-500/50'
                    }`}></div>
                  </div>

                  {/* Table Header */}
                  <div className="mb-6">
                    <h3 className="text-xl font-bold text-white mb-2">{table.id}</h3>
                    <p className="text-slate-400 text-sm">{table.name}</p>
                  </div>

                  {/* Table Info */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="text-center">
                      <div className="text-slate-400 text-xs mb-1">Capacity</div>
                      <div className="text-white font-semibold">{table.capacity}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-slate-400 text-xs mb-1">Revenue</div>
                      <div className="text-amber-400 font-semibold">${table.revenue}</div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="mb-6">
                    <div className={`px-4 py-2 rounded-xl text-center font-semibold text-sm ${
                      table.status === 'available'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}>
                      {table.status === 'available' ? '✓ Available' : '👥 Occupied'}
                    </div>
                  </div>

                  {/* Action Button */}
                  <button onClick={() => navigate(`/orders/${table.id}`)} className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-300 shadow-lg hover:shadow-amber-500/25 hover:scale-105">
                    🛒 Manage Orders
                  </button>
                  <button
                    onClick={() => {
                      const info = computeStatus(table);
                      setStatusFor(table);
                      setStatusInfo(info);
                      setStatusOpen(true);
                    }}
                    className="mt-3 w-full bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-300 border border-slate-600"
                  >
                    ℹ️ Status
                  </button>
                  <button
                    onClick={() => {
                      setFinalizeFor(table);
                      setFinalizeData(computeFinalize(table));
                      setFinalizeOpen(true);
                    }}
                    className="mt-3 w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-300 shadow-lg hover:shadow-amber-500/25 hover:scale-105"
                  >
                    🧾 Finalize Bill
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[200] px-4 py-3 rounded-xl border shadow-lg ${toast.type==='error' ? 'bg-rose-600/20 border-rose-500 text-rose-200' : 'bg-emerald-600/20 border-emerald-500 text-emerald-200'}`}>
          {toast.msg}
        </div>
      )}
      {/* Status Modal */}
      {statusOpen && statusFor && statusInfo && (
        <div className="fixed inset-0 z-[100]">
          <div className="absolute inset-0 bg-black/60" onClick={() => setStatusOpen(false)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-xl bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600/30 border border-blue-500/40 rounded-lg flex items-center justify-center">🎱</div>
                  <div>
                    <div className="text-white font-bold text-lg">{statusFor.name}</div>
                    <div className="text-slate-400 text-sm">ID: {statusFor.id} • {statusFor.type === 'billiard' ? 'Billiard' : 'Bar'} Table</div>
                  </div>
                </div>
                <button className="text-slate-300 hover:text-white text-xl" onClick={() => setStatusOpen(false)}>✕</button>
              </div>
              <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4">
                  <div className="text-slate-400 text-xs uppercase tracking-wide mb-1">Time Logged</div>
                  <div className="text-2xl font-mono font-bold text-white">{formatTime(statusInfo.elapsed)}</div>
                </div>
                <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4">
                  <div className="text-slate-400 text-xs uppercase tracking-wide mb-1">Items Consumed</div>
                  <div className="text-2xl font-bold text-emerald-400">{statusInfo.items}</div>
                </div>
                <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4 md:col-span-2">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-slate-400 text-xs uppercase tracking-wide">Combo Applied</div>
                    <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusInfo.comboApplied ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-slate-700/40 text-slate-300 border-slate-600'}`}>
                      {statusInfo.comboApplied ? 'YES' : 'NO'}
                    </div>
                  </div>
                  <div className="text-white text-sm min-h-[1.5rem]">{statusInfo.comboApplied ?? '—'}</div>
                </div>
                <div className="md:col-span-2">
                  <div className="text-slate-300 font-semibold mb-3">Orders In Process</div>
                  {statusInfo.inProcess.length === 0 ? (
                    <div className="text-slate-500 text-sm">No orders in process</div>
                  ) : (
                    <div className="space-y-2">
                      {statusInfo.inProcess.map((o) => (
                        <div key={o.id} className="flex items-center justify-between bg-slate-900/60 border border-slate-700 rounded-lg p-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center">🍽️</div>
                            <div>
                              <div className="text-white text-sm font-medium">{o.name}</div>
                              <div className="text-slate-400 text-xs">Qty: {o.quantity}</div>
                            </div>
                          </div>
                          <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${o.status === 'in-progress' ? 'bg-orange-500/15 text-orange-300 border-orange-500/30' : 'bg-blue-500/15 text-blue-300 border-blue-500/30'}`}>
                            {o.status === 'in-progress' ? 'IN PROGRESS' : 'PENDING'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="px-6 py-4 border-t border-slate-700 flex items-center justify-end gap-3">
                <button onClick={() => setStatusOpen(false)} className="px-4 py-2 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800">Close</button>
                <button onClick={() => { setStatusOpen(false); navigate(`/orders/${statusFor.id}`); }} className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-indigo-600 text-white">Go to Orders</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Transfer Modal (root) */}
      {transferFor && (
        <div className="fixed inset-0 z-[115]">
          <div className="absolute inset-0 bg-black/60" onClick={()=>setTransferFor(null)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
                <div className="text-white font-bold text-xl">Transfer Session • {transferFor.id}</div>
                <button className="text-slate-300 hover:text-white text-xl" onClick={()=>setTransferFor(null)}>✕</button>
              </div>
              <div className="p-6 text-slate-200 space-y-3">
                <div className="text-sm text-slate-400">Select an available table to receive this session.</div>
                <div className="grid grid-cols-3 gap-3 max-h-[50vh] overflow-auto">
                  {tables.filter(t=>t.status==='available' && t.type==='billiard').map(t=> (
                    <button key={t.id}
                      onClick={async () => {
                        // Try to persist via backend migrate
                        try {
                          const src = resolveBackendTableId(transferFor.id);
                          const dst = resolveBackendTableId(t.id);
                          if (src != null && dst != null) {
                            await api.migrateTable(src, dst, false);
                          } else {
                            console.warn('Table mapping missing; skipping backend migrate', { src: transferFor.id, dst: t.id });
                          }
                        } catch (e) {
                          console.warn('Backend migrate failed (UI will still update):', e);
                        }
                        setTables(prev => {
                          const src = prev.find(x=>x.id===transferFor.id);
                          return prev.map(x => {
                            if (x.id===transferFor.id) return { ...x, status:'available', hourlyRate:0, servicesTotal:0, limitEnd:undefined, limitRemaining:undefined, isPaused:false };
                            if (x.id===t.id) return { ...x, status:'occupied', hourlyRate:src?.hourlyRate||0, servicesTotal:src?.servicesTotal||0, limitEnd:src?.limitEnd, limitRemaining:src?.limitRemaining, isPaused:src?.isPaused||false, startMeta: src?.startMeta };
                            return x;
                          });
                        });
                        setTransferFor(null);
                      }}
                      className="p-3 rounded-xl border border-slate-600 bg-slate-800 hover:bg-slate-700 text-white">
                      {t.id}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Merge Modal (root) */}
      {mergeFor && (
        <div className="fixed inset-0 z-[115]">
          <div className="absolute inset-0 bg-black/60" onClick={()=>setMergeFor(null)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
                <div className="text-white font-bold text-xl">Merge Into… • {mergeFor.id}</div>
                <button className="text-slate-300 hover:text-white text-xl" onClick={()=>setMergeFor(null)}>✕</button>
              </div>
              <div className="p-6 text-slate-200 space-y-3">
                <div className="text-sm text-slate-400">Select another occupied billiard table to merge into. Services total will be summed; time limit keeps the later expiry.</div>
                <div className="grid grid-cols-3 gap-3 max-h-[50vh] overflow-auto">
                  {tables.filter(t=>t.status==='occupied' && t.type==='billiard' && t.id!==mergeFor.id).map(t=> (
                    <button key={t.id}
                      onClick={async () => {
                        // Fire an idempotent merge event for backend processors (best-effort)
                        try {
                          const sourceTableId = resolveBackendTableId(mergeFor.id);
                          const destTableId = resolveBackendTableId(t.id);
                          if (sourceTableId != null && destTableId != null) {
                            await api.moveEvent({ sourceTableId, destTableId, scope: 'all', idempotencyKey: `merge:${mergeFor.id}->${t.id}:${Date.now()}` });
                          } else {
                            console.warn('Table mapping missing; skipping backend merge event', { src: mergeFor.id, dst: t.id });
                          }
                        } catch (e) {
                          console.warn('Backend merge event failed (UI will still update):', e);
                        }
                        setTables(prev => {
                          const src = prev.find(x=>x.id===mergeFor.id);
                          const dst = prev.find(x=>x.id===t.id);
                          return prev.map(x => {
                            if (x.id===mergeFor.id) return { ...x, status:'available', hourlyRate:0, servicesTotal:0, limitEnd:undefined, limitRemaining:undefined, isPaused:false };
                            if (x.id===t.id) return {
                              ...x,
                              servicesTotal: (dst?.servicesTotal||0) + (src?.servicesTotal||0),
                              limitEnd: (dst?.limitEnd && src?.limitEnd) ? Math.max(dst.limitEnd, src.limitEnd) : (dst?.limitEnd||src?.limitEnd),
                              limitRemaining: (dst?.limitRemaining && src?.limitRemaining) ? Math.max(dst.limitRemaining, src.limitRemaining) : (dst?.limitRemaining||src?.limitRemaining),
                              startMeta: { ...(dst?.startMeta||{}), mergedFrom: [ ...(dst?.startMeta?.mergedFrom||[]), src?.id ] }
                            };
                            return x;
                          });
                        });
                        setMergeFor(null);
                      }}
                      className="p-3 rounded-xl border border-slate-600 bg-slate-800 hover:bg-slate-700 text-white">
                      {t.id}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Split Modal (root) */}
      {splitFor && (
        <div className="fixed inset-0 z-[115]">
          <div className="absolute inset-0 bg-black/60" onClick={()=>setSplitFor(null)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-xl bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
                <div className="text-white font-bold text-xl">Split Session • {splitFor.id}</div>
                <button className="text-slate-300 hover:text-white text-xl" onClick={()=>setSplitFor(null)}>✕</button>
              </div>
              <div className="p-6 text-slate-200 space-y-4">
                <div className="text-sm text-slate-400">Choose an available table and how much to move.</div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Percent to move</label>
                  <input type="range" min="10" max="90" step="5" value={splitPercent} onChange={e=>setSplitPercent(parseInt(e.target.value)||50)} className="w-full" />
                  <div className="text-right text-sm text-slate-300">{splitPercent}%</div>
                </div>
                <div className="grid grid-cols-3 gap-3 max-h-[40vh] overflow-auto">
                  {tables.filter(t=>t.status==='available' && t.type==='billiard').map(t=> (
                    <button key={t.id}
                      onClick={async () => {
                        // Fire an idempotent split event (best-effort)
                        try {
                          const sourceTableId = resolveBackendTableId(splitFor.id);
                          const destTableId = resolveBackendTableId(t.id);
                          if (sourceTableId != null && destTableId != null) {
                            await api.moveEvent({ sourceTableId, destTableId, scope: 'all', idempotencyKey: `split:${splitFor.id}->${t.id}:${splitPercent}:${Date.now()}` });
                          } else {
                            console.warn('Table mapping missing; skipping backend split event', { src: splitFor.id, dst: t.id });
                          }
                        } catch (e) {
                          console.warn('Backend split event failed (UI will still update):', e);
                        }
                        setTables(prev => {
                          const src = prev.find(x=>x.id===splitFor.id);
                          const moveFrac = Math.min(0.9, Math.max(0.1, (splitPercent||50)/100));
                          const movedServices = Math.round(((src?.servicesTotal||0)*moveFrac)*100)/100;
                          const remainServices = Math.round(((src?.servicesTotal||0)-movedServices)*100)/100;
                          const now = Date.now();
                          const srcRemainingMs = src?.limitEnd ? Math.max(0, src.limitEnd - now) : (src?.limitRemaining||undefined);
                          const moveMs = srcRemainingMs ? Math.floor(srcRemainingMs * moveFrac) : undefined;
                          const remainMs = srcRemainingMs && moveMs!==undefined ? Math.max(0, srcRemainingMs - moveMs) : undefined;
                          return prev.map(x => {
                            if (x.id===splitFor.id) return { ...x, servicesTotal: remainServices, limitEnd: remainMs ? now + remainMs : src?.limitEnd, limitRemaining: src?.isPaused ? remainMs : undefined };
                            if (x.id===t.id) return { ...x, status:'occupied', hourlyRate:src?.hourlyRate||0, servicesTotal: movedServices, limitEnd: (!src?.isPaused && moveMs) ? now + moveMs : undefined, limitRemaining: src?.isPaused ? moveMs : undefined, isPaused: src?.isPaused||false, startMeta: { ...(src?.startMeta||{}), splitFrom: splitFor.id, percent: moveFrac } };
                            return x;
                          });
                        });
                        setSplitFor(null);
                      }}
                      className="p-3 rounded-xl border border-slate-600 bg-slate-800 hover:bg-slate-700 text-white">
                      {t.id}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notes Modal (root) */}
      {notesFor && (
        <div className="fixed inset-0 z-[115]">
          <div className="absolute inset-0 bg-black/60" onClick={()=>setNotesFor(null)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
                <div className="text-white font-bold text-xl">Table Notes • {notesFor.id}</div>
                <button className="text-slate-300 hover:text-white text-xl" onClick={()=>setNotesFor(null)}>✕</button>
              </div>
              <div className="p-6 text-slate-200 space-y-3">
                <textarea className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-700" rows={5} value={noteDraft} onChange={e=>setNoteDraft(e.target.value)} />
                <div className="text-xs text-slate-400">Notes are stored locally for demo. Wire to backend sessions in production.</div>
                <div className="flex justify-end gap-2">
                  <button className="px-4 py-2 rounded-lg border border-slate-600 text-slate-200" onClick={()=>setNotesFor(null)}>Cancel</button>
                  <button className="px-4 py-2 rounded-lg bg-emerald-600 text-white" onClick={()=>{
                    setTables(prev => prev.map(t => t.id===notesFor.id ? { ...t, note: noteDraft } : t));
                    setNotesFor(null);
                  }}>Save</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Finalize/Pre-Bill Modal */}
      {finalizeOpen && finalizeFor && finalizeData && (
        <div className="fixed inset-0 z-[110]">
          <div className="absolute inset-0 bg-black/60" onClick={() => setFinalizeOpen(false)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-3xl bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
                <div>
                  <div className="text-white font-bold text-xl">Finalize Bill for {finalizeFor.id}</div>
                  <div className="text-slate-400 text-sm">Review charges and print a pre-bill before payment.</div>
                </div>
                <button className="text-slate-300 hover:text-white text-xl" onClick={() => setFinalizeOpen(false)}>✕</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6">
                <div className="md:col-span-2">
                  <div id="prebill-receipt" className="bg-white text-gray-800 rounded-xl shadow p-6">
                    <div className="text-center mb-4">
                      <div className="text-xl font-extrabold">{storeCfg.name}</div>
                      <div className="text-xs text-gray-500">{storeCfg.address}<br/>Official Receipt (Pre-Bill)</div>
                    </div>
                    <div className="text-sm mb-3 flex justify-between">
                      <div>
                        <div><span className="font-semibold">Table:</span> {finalizeFor.id}</div>
                        <div><span className="font-semibold">Customer:</span> —</div>
                      </div>
                      <div className="text-right">
                        <div><span className="font-semibold">Date:</span> {new Date().toLocaleDateString()}</div>
                        <div><span className="font-semibold">Time:</span> {new Date().toLocaleTimeString()}</div>
                        <div className="truncate max-w-[180px]"><span className="font-semibold">Session ID:</span> {finalizeData.sessionId}</div>
                      </div>
                    </div>
                    <hr className="my-2"/>
                    <div className="text-sm">
                      <div className="flex justify-between py-1">
                        <span>Table Time ({finalizeData.minutes} min @ ${finalizeData.rate}/hr)</span>
                        <span>${finalizeData.tableCharge.toFixed(2)}</span>
                      </div>
                      {finalizeData.services > 0 && (
                        <div className="flex justify-between py-1">
                          <span>Services</span>
                          <span>${finalizeData.services.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                    <hr className="my-2"/>
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="font-medium">Subtotal</span>
                        <span>${finalizeData.subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">Tax (8%)</span>
                        <span>${finalizeData.tax.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-lg font-extrabold pt-1">
                        <span>Total</span>
                        <span>${finalizeData.total.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="text-center text-xs text-gray-500 mt-4">{storeCfg.footer}</div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4">
                    <div className="font-semibold text-slate-200 mb-3">Actions</div>
                    <button
                      onClick={() => {
                        const el = document.getElementById('prebill-receipt');
                        if (el) {
                          const style = `
                            <style>
                              @page { size: auto; margin: 0; }
                              html, body { margin: 0; padding: 0; background: #fff; }
                              .receipt { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 12px; line-height: 1.25; color: #000; }
                              .receipt.receipt-80 { width: 80mm; }
                              .receipt hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
                              .receipt * { background: #fff !important; color: #000 !important; box-shadow: none !important; }
                              .receipt .border { border-color: #000 !important; }
                              .receipt .rounded-lg, .receipt .rounded-xl { border-radius: 0; }
                              .receipt .p-5, .receipt .p-6 { padding: 8px; }
                            </style>`;
                          const html = `<html><head><title>Pre-Bill</title>${style}</head><body><div class="receipt receipt-80">${el.innerHTML}</div></body></html>`;
                          printHtml(html);
                        }
                      }}
                      className="w-full bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-lg mb-2"
                    >
                      🖨️ Print Pre-Bill
                    </button>
                    <button
                      onClick={() => { setFinalizeOpen(false); navigate(`/payment/${finalizeFor.id}`); }}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg"
                    >
                      ➡️ Proceed to Payment
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
    </div>
  );
};

// Simple Order Page — moved to components/orders/OrderPage.jsx

// Modifier Modal
// Placed after OrderPage component to keep JSX locality

// (PaymentPage extracted to components/payment/PaymentPage.jsx)

// Helper component: create discount
const DiscountForm = ({ onAdd }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState('percent'); // percent|fixed
  const [scope, setScope] = useState('total'); // items|time|total
  const [value, setValue] = useState(10);
  return (
    <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4">
      <div className="text-slate-200 font-semibold mb-3">Create Discount</div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Name" className="bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-700" />
        <select value={type} onChange={e=>setType(e.target.value)} className="bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-700">
          <option value="percent">Percent %</option>
          <option value="fixed">Fixed $</option>
        </select>
        <select value={scope} onChange={e=>setScope(e.target.value)} className="bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-700">
          <option value="items">Items</option>
          <option value="time">Billiard Time</option>
          <option value="total">Total Bill</option>
        </select>
        <input type="number" step="0.01" value={value} onChange={e=>setValue(parseFloat(e.target.value)||0)} className="bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-700" />
      </div>
      <div className="mt-3 text-right">
        <button
          onClick={()=>{ if(!name) return; onAdd({ name, type, scope, value: Number(value) }); setName(''); setType('percent'); setScope('total'); setValue(10); }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg"
        >
          ➕ Add Discount
        </button>
      </div>
    </div>
  );
};

// Simple Kitchen Display — moved to components/kds/KitchenDisplay.jsx
