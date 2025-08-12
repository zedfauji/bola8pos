import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { useSettings } from '../../contexts/SettingsContext';

function Panel({ title, children, right }) {
  return (
    <div className="pos-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold">{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

export default function ShiftHistory() {
  const { isPinRequired, verifyPin } = useSettings();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  async function ensureAccess() {
    if (!isPinRequired('reports')) return true;
    const pin = window.prompt('Manager PIN required to view shift history', '');
    if (pin == null) return false;
    const res = await verifyPin(pin);
    if (!res.ok) {
      setError('Invalid PIN');
      return false;
    }
    return true;
  }

  async function load() {
    setLoading(true);
    setError('');
    try {
      if (!(await ensureAccess())) { setLoading(false); return; }
      const list = await api.getShiftHistory({ limit: 50 });
      setItems(list || []);
      if (list && list.length) {
        const first = list[0];
        try { const detail = await api.getShiftSummary(first.id); setSelected(detail || first); } catch {}
      }
    } catch (e) {
      setError(e.message || 'Failed to load history');
    } finally {
      setLoading(false);
    }
  }

  async function viewDetails(it) {
    try {
      setSelected(null);
      const detail = await api.getShiftSummary(it.id);
      setSelected(detail || it);
    } catch {
      setSelected(it);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Shift History</h1>
        <button onClick={load} className="pos-button" disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
      </div>
      {error ? <div className="text-red-400">⚠ {error}</div> : null}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-3">
          <Panel title="Past Shifts">
            <div className="divide-y divide-gray-800">
              {(items || []).map(it => (
                <button key={it.id} onClick={() => viewDetails(it)} className={`w-full text-left px-3 py-2 hover:bg-white/5 rounded flex items-center justify-between ${selected && selected.id === it.id ? 'bg-white/10' : ''}`}>
                  <div>
                    <div className="text-white text-sm font-medium">Shift #{it.id}</div>
                    <div className="text-xs text-gray-400">{it.start_time} → {it.end_time || 'active'}</div>
                  </div>
                  <div className="text-xs text-gray-300">${it.expected ?? it.total ?? '-'}</div>
                </button>
              ))}
            </div>
          </Panel>
        </div>
        <div className="lg:col-span-2 space-y-3">
          <Panel title="Summary" right={selected ? <button className="pos-button" onClick={() => window.print()}>🖨️ Print</button> : null}>
            {!selected ? (
              <div className="text-gray-300">Select a shift to view details.</div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="bg-white/5 rounded p-3">
                    <div className="text-xs text-gray-400">Start Cash</div>
                    <div className="text-white font-semibold">${Number(selected.start_cash ?? 0).toFixed(2)}</div>
                  </div>
                  <div className="bg-white/5 rounded p-3">
                    <div className="text-xs text-gray-400">Expected Cash</div>
                    <div className="text-white font-semibold">${Number(selected.expected ?? 0).toFixed(2)}</div>
                  </div>
                  <div className="bg-white/5 rounded p-3">
                    <div className="text-xs text-gray-400">Counted Cash</div>
                    <div className="text-white font-semibold">${selected.counted != null ? Number(selected.counted).toFixed(2) : '-'}</div>
                  </div>
                  <div className="bg-white/5 rounded p-3">
                    <div className="text-xs text-gray-400">Over / Short</div>
                    <div className="text-white font-semibold">{selected.over_short != null ? Number(selected.over_short).toFixed(2) : '-'}</div>
                  </div>
                  <div className="bg-white/5 rounded p-3">
                    <div className="text-xs text-gray-400">Payments (Cash)</div>
                    <div className="text-white font-semibold">${Number(selected.cash_total ?? 0).toFixed(2)}</div>
                  </div>
                  <div className="bg-white/5 rounded p-3">
                    <div className="text-xs text-gray-400">Payments (Card)</div>
                    <div className="text-white font-semibold">${Number(selected.card_total ?? 0).toFixed(2)}</div>
                  </div>
                </div>
                <div>
                  <h4 className="text-white font-semibold mb-2">Movements</h4>
                  <div className="overflow-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-gray-400">
                          <th className="text-left pr-4 py-2">Type</th>
                          <th className="text-left pr-4 py-2">Amount</th>
                          <th className="text-left pr-4 py-2">Reason</th>
                          <th className="text-left pr-4 py-2">At</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-200">
                        {(selected.movements || []).map((m, idx) => (
                          <tr key={idx} className="border-t border-gray-800">
                            <td className="pr-4 py-2">{m.type}</td>
                            <td className="pr-4 py-2">${Number(m.amount).toFixed(2)}</td>
                            <td className="pr-4 py-2">{m.reason || ''}</td>
                            <td className="pr-4 py-2">{m.created_at || ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
