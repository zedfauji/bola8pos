import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../../contexts/SettingsContext';

const kinds = [
  { value: 'percent', label: 'Percent %' },
  { value: 'fixed', label: 'Fixed Amount' },
];
const scopes = [
  { value: 'items', label: 'Items' },
  { value: 'time', label: 'Billiard Time' },
  { value: 'total', label: 'Total Bill' },
];

async function api(path, opts={}) {
  const base = (import.meta?.env?.VITE_API_URL) || (window?.API_BASE_URL) || 'http://localhost:3001';
  const res = await fetch(base + path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

const emptyForm = { name: '', kind: 'percent', scope: 'total', value: 10, active: true };

function DiscountsPage() {
  const navigate = useNavigate();
  const { hasPermission, isPinRequired, verifyPin } = useSettings();
  const [accessDenied, setAccessDenied] = useState(false);
  const [pinVerified, setPinVerified] = useState(false);
  const [pinError, setPinError] = useState('');

  // Check if user has permission to manage discounts
  const checkAccess = useCallback(async () => {
    try {
      // Check if PIN is required for managing discounts
      if (isPinRequired('manage_discounts') && !pinVerified) {
        const pin = prompt('Enter manager PIN to manage discounts:');
        if (!pin) {
          setAccessDenied(true);
          return false;
        }
        const { ok } = await verifyPin(pin);
        if (!ok) {
          setPinError('Invalid PIN');
          setAccessDenied(true);
          return false;
        }
        setPinVerified(true);
      }
      
      // Check user role permissions
      if (!hasPermission('manage_discounts')) {
        setAccessDenied(true);
        return false;
      }
      
      return true;
    } catch (err) {
      console.error('Access check failed:', err);
      setAccessDenied(true);
      return false;
    }
  }, [hasPermission, isPinRequired, pinVerified, verifyPin]);

  // Check access on component mount
  useEffect(() => {
    checkAccess().then(hasAccess => {
      if (hasAccess) {
        load();
      }
    });
  }, [checkAccess]);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (accessDenied) {
    return (
      <div className="p-6">
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
          <p className="font-bold">Access Denied</p>
          <p>{pinError || 'You do not have permission to manage discounts.'}</p>
        </div>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await api('/api/discounts');
      setList(rows);
    } catch (e) {
      setError(String(e.message||e));
    } finally {
      setLoading(false);
    }
  };



  const handleCreate = async (e) => {
    const hasAccess = await checkAccess();
    if (!hasAccess) return;
    
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, value: Number(form.value) };
      await api('/api/discounts', { method: 'POST', body: JSON.stringify(payload) });
      setForm(emptyForm);
      await load();
    } catch (e) {
      setError(String(e.message||e));
    } finally {
      setSaving(false);
    }
  };

  const updateField = async (id, patch) => {
    const hasAccess = await checkAccess();
    if (!hasAccess) return;
    try {
      await api(`/api/discounts/${id}`, { method: 'PUT', body: JSON.stringify(patch) });
      await load();
    } catch (e) {
      setError(String(e.message||e));
    }
  };

  const deleteDisc = async (id) => {
    const hasAccess = await checkAccess();
    if (!hasAccess) return;
    if (!confirm('Delete this discount?')) return;
    try {
      await api(`/api/discounts/${id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setError(String(e.message||e));
    }
  };

  const activeCount = useMemo(() => list.filter(d => d.active).length, [list]);

  return (
    <div className="p-6 text-slate-100">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-slate-100">Discounts</h1>
          <div className="text-sm text-slate-400">Active: {activeCount} / {list.length}</div>
        </div>

        {error && <div className="mb-3 text-sm text-red-400">{error}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-slate-900 rounded-xl shadow border border-slate-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700 bg-slate-800 font-semibold text-slate-100">Existing Discounts</div>
              {loading ? (
                <div className="p-4 text-slate-400">Loading…</div>
              ) : (
                <div className="divide-y divide-slate-800">
                  {list.length === 0 && (
                    <div className="p-4 text-slate-400">No discounts yet.</div>
                  )}
                  {list.map(d => (
                    <div key={d.id} className="p-4 flex items-center gap-3">
                      <div className="flex-1">
                        <div className="font-semibold text-slate-100">{d.name}</div>
                        <div className="text-xs text-slate-400">{d.kind} • {d.scope} • value: {d.value}</div>
                      </div>
                      <label className="text-sm text-slate-300 flex items-center gap-2">
                        <input type="checkbox" checked={!!d.active} onChange={(e)=>updateField(d.id, { active: e.target.checked })} /> Active
                      </label>
                      <button className="px-3 py-1 text-sm bg-slate-800 border border-slate-700 text-slate-100 rounded hover:bg-slate-700" onClick={()=>updateField(d.id, { name: prompt('Name', d.name) || d.name })}>Rename</button>
                      <button className="px-3 py-1 text-sm bg-slate-800 border border-slate-700 text-slate-100 rounded hover:bg-slate-700" onClick={()=>updateField(d.id, { value: Number(prompt('Value', d.value) || d.value) })}>Edit Value</button>
                      <button className="px-3 py-1 text-sm bg-slate-800 border border-slate-700 text-slate-100 rounded hover:bg-slate-700" onClick={()=>updateField(d.id, { kind: prompt('Kind (percent|fixed)', d.kind) || d.kind })}>Kind</button>
                      <button className="px-3 py-1 text-sm bg-slate-800 border border-slate-700 text-slate-100 rounded hover:bg-slate-700" onClick={()=>updateField(d.id, { scope: prompt('Scope (items|time|total)', d.scope) || d.scope })}>Scope</button>
                      <button className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700" onClick={()=>deleteDisc(d.id)}>Delete</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <form onSubmit={handleCreate} className="bg-slate-900 rounded-xl shadow border border-slate-700 p-4 text-slate-100">
              <div className="font-semibold mb-3">Create Discount</div>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Name</label>
                  <input className="w-full border border-slate-700 bg-slate-800 text-slate-100 rounded px-3 py-2" value={form.name} onChange={(e)=>setForm({...form, name: e.target.value})} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-slate-300 mb-1">Kind</label>
                    <select className="w-full border border-slate-700 bg-slate-800 text-slate-100 rounded px-3 py-2" value={form.kind} onChange={(e)=>setForm({...form, kind: e.target.value})}>
                      {kinds.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-300 mb-1">Scope</label>
                    <select className="w-full border border-slate-700 bg-slate-800 text-slate-100 rounded px-3 py-2" value={form.scope} onChange={(e)=>setForm({...form, scope: e.target.value})}>
                      {scopes.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Value</label>
                  <input type="number" step="0.01" className="w-full border border-slate-700 bg-slate-800 text-slate-100 rounded px-3 py-2" value={form.value} onChange={(e)=>setForm({...form, value: e.target.value})} required />
                </div>
                <label className="text-sm text-slate-300 flex items-center gap-2">
                  <input type="checkbox" checked={form.active} onChange={(e)=>setForm({...form, active: e.target.checked})} /> Active
                </label>
                <button disabled={saving} className="w-full py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold">{saving ? 'Saving…' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DiscountsPage;
