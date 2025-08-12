import React, { useEffect, useMemo, useState } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { getSocket } from '../../lib/socket';

function getApiBase() {
  return (import.meta?.env?.VITE_API_URL) || (window?.API_BASE_URL) || 'http://localhost:3001';
}

async function api(path, opts = {}) {
  const base = getApiBase();
  const res = await fetch(base + path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

const DEV_ACCESS_CODE = (window?.POS_DEV_ACCESS_CODE) || '1234';

async function setStatus(id, status) {
  return api(`/api/orders/${id}/status`, {
    method: 'POST',
    body: JSON.stringify({ status, accessCode: DEV_ACCESS_CODE })
  });
}

async function recallOrder(id) {
  return api(`/api/orders/${id}/recall`, {
    method: 'POST',
    body: JSON.stringify({ accessCode: DEV_ACCESS_CODE })
  });
}

async function completeByTable(table) {
  return api('/api/orders/complete-by-table', {
    method: 'POST',
    body: JSON.stringify({ table, accessCode: DEV_ACCESS_CODE })
  });
}

function statusChip(status) {
  const s = (status || '').toLowerCase();
  let bg = 'bg-slate-700';
  let label = 'Pending';
  if (s === 'in_progress' || s === 'preparing') { bg = 'bg-amber-600'; label = 'In Progress'; }
  else if (s === 'done' || s === 'delivered' || s === 'ready' || s === 'completed') { bg = 'bg-emerald-600'; label = 'Done'; }
  else if (s === 'pending') { bg = 'bg-slate-600'; label = 'Pending'; }
  return <span className={`text-xs px-2 py-0.5 rounded ${bg} text-white`}>{label}</span>;
}

export default function OrdersSummary() {
  const { isPinRequired, verifyPin, hasPermission } = useSettings();
  const [pending, setPending] = useState([]);
  const [delivered, setDelivered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | pending | in_progress
  const [tableQuery, setTableQuery] = useState('');
  const [stationFilter, setStationFilter] = useState('all'); // all | kitchen | bar
  const [deliveredQuery, setDeliveredQuery] = useState('');
  const [deliveredStatus, setDeliveredStatus] = useState('all'); // all | done | delivered

  async function load() {
    setError('');
    try {
      // Pending orders from KDS endpoint (kitchen + bar queue)
      const kds = await api('/api/orders/kds');
      setPending(Array.isArray(kds) ? kds : (kds?.orders || []));
      // Delivered summary (best-effort; backend may not have endpoint yet)
      try {
        const done = await api('/api/orders?status=delivered');
        setDelivered(Array.isArray(done) ? done : (done?.orders || []));
      } catch (_) {
        setDelivered([]); // fallback silently
      }
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    const socket = getSocket();
    const onAny = () => { load(); };
    socket.on('order:created', onAny);
    socket.on('order:status_changed', onAny);
    socket.on('order:completed', onAny);
    socket.on('order:recalled', onAny);
    return () => {
      clearInterval(t);
      socket.off('order:created', onAny);
      socket.off('order:status_changed', onAny);
      socket.off('order:completed', onAny);
      socket.off('order:recalled', onAny);
    };
  }, []);

  async function withGuard(action, run) {
    try {
      if (typeof hasPermission === 'function' && !hasPermission('orders.manage')) {
        window.toast?.error?.('Not permitted');
        return;
      }
      if (typeof isPinRequired === 'function' && isPinRequired(action)) {
        const pin = window.prompt('Manager PIN required');
        if (!pin) return;
        const res = await verifyPin(pin);
        if (!res?.ok) {
          window.toast?.error?.('Invalid PIN');
          return;
        }
      }
      await run();
    } catch (e) {
      window.toast?.error?.(String(e)) || alert(String(e));
    } finally {
      await load();
    }
  }

  const pendingCount = pending.length;
  const deliveredCount = delivered.length;
  const getStation = (o) => {
    if (o.station) return String(o.station).toLowerCase();
    const items = o.items || o.orderItems || [];
    const st = items[0]?.station;
    return st ? String(st).toLowerCase() : '';
  };

  const filteredPending = pending.filter(o => {
    const s = (o.kitchenStatus || o.status || 'pending').toLowerCase();
    const table = String(o.tableNumber || o.tableId || '').toLowerCase();
    const passStatus = statusFilter === 'all' || s === statusFilter;
    const passTable = !tableQuery || table.includes(tableQuery.toLowerCase());
    const st = getStation(o);
    const passStation = stationFilter === 'all' || st === stationFilter;
    return passStatus && passTable && passStation;
  });

  const filteredDelivered = delivered.filter(o => {
    const s = (o.kitchenStatus || o.status || 'done').toLowerCase();
    const table = String(o.tableNumber || o.tableId || '').toLowerCase();
    const passStatus = deliveredStatus === 'all' || s === deliveredStatus || (deliveredStatus === 'done' && s === 'completed');
    const passTable = !deliveredQuery || table.includes(deliveredQuery.toLowerCase());
    const st = getStation(o);
    const passStation = stationFilter === 'all' || st === stationFilter;
    return passStatus && passTable && passStation;
  });

  return (
    <div className="p-6 text-slate-100">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Orders</h1>
        <div className="flex items-center gap-3">
          <div className="text-sm text-slate-400">Pending: {pendingCount} • Delivered: {deliveredCount}</div>
          <button
            className="px-2 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600 text-slate-100"
            onClick={() => { setLoading(true); load().then(() => window.toast?.success?.('Refreshed') || null).catch((e)=> window.toast?.error?.(String(e)) || alert(String(e))); }}
          >Refresh</button>
        </div>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-400">{error}</div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[0,1].map(i => (
            <div key={i} className="bg-slate-900 rounded-xl shadow border border-slate-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700 bg-slate-800">
                <div className="h-4 w-32 bg-slate-700 animate-pulse rounded"/>
              </div>
              <div className="p-4 space-y-4">
                {[0,1,2].map(j => (
                  <div key={j} className="space-y-2">
                    <div className="h-4 w-48 bg-slate-800 animate-pulse rounded"/>
                    <div className="h-3 w-full bg-slate-800 animate-pulse rounded"/>
                    <div className="h-3 w-2/3 bg-slate-800 animate-pulse rounded"/>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-900 rounded-xl shadow border border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700 bg-slate-800">
              <div className="flex items-center justify-between">
                <div className="font-semibold">Pending</div>
                <div className="flex items-center gap-2">
                  <input
                    value={tableQuery}
                    onChange={(e)=> setTableQuery(e.target.value)}
                    placeholder="Search table…"
                    className="px-2 py-1 text-xs rounded bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-400"
                  />
                  <div className="flex gap-1">
                    {['all','pending','in_progress'].map(k => (
                      <button key={k}
                        onClick={()=> setStatusFilter(k)}
                        className={`px-2 py-1 text-xs rounded ${statusFilter===k? 'bg-blue-600 text-white':'bg-slate-700 text-slate-100 hover:bg-slate-600'}`}
                      >{k==='all'?'All':k==='in_progress'?'In Progress':'Pending'}</button>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    {['all','kitchen','bar'].map(k => (
                      <button key={k}
                        onClick={()=> setStationFilter(k)}
                        className={`px-2 py-1 text-xs rounded ${stationFilter===k? 'bg-purple-600 text-white':'bg-slate-700 text-slate-100 hover:bg-slate-600'}`}
                      >{k==='all'?'All Stations':(k.charAt(0).toUpperCase()+k.slice(1))}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="divide-y divide-slate-800">
              {filteredPending.length === 0 && (
                <div className="p-4 text-slate-400">No pending orders.</div>
              )}
              {filteredPending.map((o) => {
                const items = o.items || o.orderItems || [];
                return (
                  <div key={o.id || o._id || `${o.tableId}-${o.createdAt}`} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="font-semibold">Table {o.tableNumber || o.tableId || '—'}</div>
                        {statusChip((o.kitchenStatus || o.status || 'pending').replace('_',' '))}
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          className="px-2 py-1 text-xs rounded bg-amber-600 hover:bg-amber-700 text-white"
                          onClick={() => withGuard('start', async () => { await setStatus(o.id || o._id, 'in_progress'); window.toast?.success?.('Marked In Progress'); })}
                        >Start</button>
                        <button
                          className="px-2 py-1 text-xs rounded bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => withGuard('end', async () => { await setStatus(o.id || o._id, 'done'); window.toast?.success?.('Marked Done'); })}
                        >Done</button>
                        <button
                          className="px-2 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600 text-slate-100"
                          onClick={() => withGuard('finalize', async () => {
                            const table = o.tableNumber || o.tableId;
                            await completeByTable(table);
                            window.toast?.success?.(`Completed all for table ${table}`);
                          })}
                        >Complete all</button>
                        <div className="text-xs text-slate-400">{new Date(o.createdAt || o.time || Date.now()).toLocaleTimeString()}</div>
                      </div>
                    </div>
                    <div className="mt-1 text-sm text-slate-300">{items.length} items</div>
                    {o.notes && <div className="mt-1 text-xs text-slate-400">{o.notes}</div>}
                    {items.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {items.map((it, idx) => (
                          <div key={it.id || it._id || `${idx}-${it.name || it.itemName || 'item'}`} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-200">{it.qty || it.quantity || 1}x</span>
                              <span className="text-slate-100">{it.name || it.itemName || it.title || 'Item'}</span>
                            </div>
                            <div />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-slate-900 rounded-xl shadow border border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700 bg-slate-800">
              <div className="flex items-center justify-between">
                <div className="font-semibold">Delivered (recent)</div>
                <div className="flex items-center gap-2">
                  <input
                    value={deliveredQuery}
                    onChange={(e)=> setDeliveredQuery(e.target.value)}
                    placeholder="Search table…"
                    className="px-2 py-1 text-xs rounded bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-400"
                  />
                  <div className="flex gap-1">
                    {['all','delivered','done'].map(k => (
                      <button key={k}
                        onClick={()=> setDeliveredStatus(k)}
                        className={`px-2 py-1 text-xs rounded ${deliveredStatus===k? 'bg-blue-600 text-white':'bg-slate-700 text-slate-100 hover:bg-slate-600'}`}
                      >{k==='all'?'All':k.toUpperCase()}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="divide-y divide-slate-800">
              {filteredDelivered.length === 0 && (
                <div className="p-4 text-slate-400">No delivered orders found.</div>
              )}
              {filteredDelivered.map((o) => {
                const items = o.items || o.orderItems || [];
                return (
                  <div key={o.id || o._id || `${o.tableId}-d-${o.updatedAt || o.createdAt}`} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="font-semibold">Table {o.tableNumber || o.tableId || '—'}</div>
                        {statusChip((o.kitchenStatus || o.status || 'done').replace('_',' '))}
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          className="px-2 py-1 text-xs rounded bg-slate-700 hover:bg-slate-600 text-slate-100"
                          onClick={() => withGuard('start', async () => { await recallOrder(o.id || o._id); window.toast?.success?.('Recalled to queue'); })}
                        >Recall</button>
                        <div className="text-xs text-slate-400">{new Date(o.updatedAt || o.createdAt || Date.now()).toLocaleTimeString()}</div>
                      </div>
                    </div>
                    <div className="mt-1 text-sm text-slate-300">{items.length} items</div>
                    {items.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {items.map((it, idx) => (
                          <div key={it.id || it._id || `${idx}-${it.name || it.itemName || 'item'}`} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-200">{it.qty || it.quantity || 1}x</span>
                              <span className="text-slate-100">{it.name || it.itemName || it.title || 'Item'}</span>
                            </div>
                            <div />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
