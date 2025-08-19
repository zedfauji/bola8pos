import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../../contexts/SettingsContext';
import api from '../../services/api';

const Section = ({ title, children, actions = null }) => (
  <div className="bg-slate-900 text-slate-100 rounded-xl shadow p-6 border border-slate-700">
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-xl font-semibold">{title}</h2>
      {actions}
    </div>
    {children}
  </div>
);

function TextInput({ label, value, onChange, placeholder = '', type = 'text' }) {
  return (
    <div>
      <label className="block text-sm text-slate-300 mb-1">{label}</label>
      <input type={type} placeholder={placeholder} className="w-full border border-slate-700 bg-slate-800 text-slate-100 rounded px-3 py-2" value={value || ''} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

function Switch({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <span className="text-sm text-slate-300">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`w-12 h-6 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-slate-700'}`}
      >
        <span className={`block h-5 w-5 bg-white rounded-full transform transition-transform translate-y-0.5 ${checked ? 'translate-x-6' : 'translate-x-1'}`}></span>
      </button>
    </label>
  );
}

const GeneralTab = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cfg, setCfg] = useState({
    name: 'BOLA8 POS',
    address: '',
    phone: '',
    taxId: '',
    locale: 'en-US',
    currencyCode: 'USD',
    currencySymbol: '$',
    footer: 'Thank you!',
    taxRate: 0.08,
    defaultHourlyRate: 15,
    requirePinLifecycle: false,
    receiptWidthMM: 80,
  });
  const [msg, setMsg] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const res = await api.getSetting('store_config');
        if (mounted && res && res.value) setCfg({ ...cfg, ...res.value });
      } catch {}
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  const preview = useMemo(() => {
    try {
      const nf = new Intl.NumberFormat(cfg.locale || 'en-US', { style: 'currency', currency: cfg.currencyCode || 'USD' });
      const dt = new Intl.DateTimeFormat(cfg.locale || 'en-US', { dateStyle: 'short', timeStyle: 'short' });
      return `${dt.format(new Date())} • ${nf.format(1234.56)}`;
    } catch {
      return `${new Date().toLocaleString()} • ${(cfg.currencySymbol||'$')}1234.56`;
    }
  }, [cfg]);

  const save = async () => {
    setSaving(true); setMsg('');
    try {
      await api.setSetting('store_config', cfg);
      try { localStorage.setItem('pos_store_config', JSON.stringify(cfg)); } catch {}
      setMsg('Saved.');
    } catch (e) {
      setMsg('Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-4 text-slate-300">Loading...</div>;

  return (
    <Section title="General / Store & Receipt">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TextInput label="Store Name" value={cfg.name} onChange={v=>setCfg({...cfg,name:v})} />
        <TextInput label="Phone" value={cfg.phone} onChange={v=>setCfg({...cfg,phone:v})} />
        <div className="md:col-span-2"><TextInput label="Address" value={cfg.address} onChange={v=>setCfg({...cfg,address:v})} /></div>
        <TextInput label="Tax ID" value={cfg.taxId} onChange={v=>setCfg({...cfg,taxId:v})} />
        <TextInput label="Locale" placeholder="e.g. en-US, es-MX" value={cfg.locale} onChange={v=>setCfg({...cfg,locale:v})} />
        <TextInput label="Currency Code" placeholder="e.g. USD, MXN" value={cfg.currencyCode} onChange={v=>setCfg({...cfg,currencyCode:v})} />
        <TextInput label="Currency Symbol" value={cfg.currencySymbol} onChange={v=>setCfg({...cfg,currencySymbol:v})} />
        <div className="md:col-span-2">
          <label className="block text-sm text-slate-300 mb-1">Receipt Footer</label>
          <textarea rows={3} className="w-full border border-slate-700 bg-slate-800 text-slate-100 rounded px-3 py-2 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200" value={cfg.footer} onChange={e=>setCfg({...cfg,footer:e.target.value})} />
        </div>
        <TextInput label="Tax Rate" type="number" value={cfg.taxRate} onChange={v=>setCfg({...cfg,taxRate:Number(v)})} />
        <TextInput label="Default Hourly Rate" type="number" value={cfg.defaultHourlyRate} onChange={v=>setCfg({...cfg,defaultHourlyRate:Number(v)})} />
        <TextInput label="Receipt Width (mm)" type="number" value={cfg.receiptWidthMM} onChange={v=>setCfg({...cfg,receiptWidthMM:Number(v)})} />
        <div className="md:col-span-2">
          <Switch label="Require Manager PIN for lifecycle actions (Finalize, End Session)" checked={!!cfg.requirePinLifecycle} onChange={v=>setCfg({...cfg, requirePinLifecycle: v})} />
        </div>
      </div>
      <div className="text-sm text-slate-400 mt-3">Preview: {preview}</div>
      <div className="flex justify-end mt-6 gap-3">
        {msg && <div className="self-center text-sm text-slate-300">{msg}</div>}
        <button onClick={save} disabled={saving} className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-60">{saving ? 'Saving...' : 'Save'}</button>
      </div>
    </Section>
  );
};

// Security & Roles
const SecurityTab = () => {
  const [auth, setAuth] = useState({ loginMode: 'pin', sessionTimeoutMinutes: 30, pinPolicy: { minLength: 4, rotateDays: 0, preventReuse: true }, twoFA: { require2FAFor: [] } });
  const [access, setAccess] = useState({ requirePinLifecycle: true, requirePinVoidComp: true, requirePinRefund: true, approvalThresholds: { discountPct: 20, refundAmount: 50, cashPayoutAmount: 50 } });
  const [roles, setRoles] = useState({});
  const [msg, setMsg] = useState('');
  useEffect(() => { (async () => {
    try { const a = await api.getSetting('auth'); if (a?.value) setAuth(a.value); } catch {}
    try { const ac = await api.getSetting('access_control'); if (ac?.value) setAccess(ac.value); } catch {}
    try { const r = await api.getSetting('roles_policy'); if (r?.value) setRoles(r.value); } catch {}
  })(); }, []);
  const save = async () => {
    setMsg('');
    try {
      await api.setSetting('auth', auth);
      await api.setSetting('access_control', access);
      await api.setSetting('roles_policy', roles);
      setMsg('Saved.');
    } catch { setMsg('Save failed'); }
  };
  return (
    <Section title="Security & Roles" actions={<button onClick={save} className="px-3 py-2 bg-blue-600 text-white rounded">Save</button>}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="font-medium mb-2">Authentication</div>
          <label className="block text-sm text-slate-300 mb-1">Login Mode</label>
          <select className="border border-slate-700 bg-slate-800 text-slate-100 rounded px-3 py-2 w-full" value={auth.loginMode} onChange={e=>setAuth({...auth, loginMode: e.target.value})}>
            <option value="pin">PIN only</option>
            <option value="user_pin">User + PIN</option>
            <option value="user_password">User + Password</option>
          </select>
          <TextInput label="Admin Session Timeout (min)" type="number" value={auth.sessionTimeoutMinutes} onChange={v=>setAuth({...auth, sessionTimeoutMinutes: Number(v)})} />
          <div className="grid grid-cols-3 gap-2 mt-2">
            <TextInput label="PIN Min Length" type="number" value={auth.pinPolicy?.minLength||4} onChange={v=>setAuth({...auth, pinPolicy:{...auth.pinPolicy, minLength:Number(v)}})} />
            <TextInput label="PIN Rotate Days" type="number" value={auth.pinPolicy?.rotateDays||0} onChange={v=>setAuth({...auth, pinPolicy:{...auth.pinPolicy, rotateDays:Number(v)}})} />
            <Switch label="Prevent Reuse" checked={!!auth.pinPolicy?.preventReuse} onChange={v=>setAuth({...auth, pinPolicy:{...auth.pinPolicy, preventReuse:v}})} />
          </div>
        </div>
        <div>
          <div className="font-medium mb-2">Access Control</div>
          <div className="space-y-2">
            <Switch label="Require PIN: Lifecycle actions" checked={!!access.requirePinLifecycle} onChange={v=>setAccess({...access, requirePinLifecycle:v})} />
            <Switch label="Require PIN: Void/Comp" checked={!!access.requirePinVoidComp} onChange={v=>setAccess({...access, requirePinVoidComp:v})} />
            <Switch label="Require PIN: Refund" checked={!!access.requirePinRefund} onChange={v=>setAccess({...access, requirePinRefund:v})} />
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            <TextInput label="Approve Discount > %" type="number" value={access.approvalThresholds.discountPct} onChange={v=>setAccess({...access, approvalThresholds:{...access.approvalThresholds, discountPct:Number(v)}})} />
            <TextInput label="Approve Refund >" type="number" value={access.approvalThresholds.refundAmount} onChange={v=>setAccess({...access, approvalThresholds:{...access.approvalThresholds, refundAmount:Number(v)}})} />
            <TextInput label="Approve Cash Payout >" type="number" value={access.approvalThresholds.cashPayoutAmount} onChange={v=>setAccess({...access, approvalThresholds:{...access.approvalThresholds, cashPayoutAmount:Number(v)}})} />
          </div>
        </div>
      </div>
      {msg && <div className="text-sm text-slate-400 mt-3">{msg}</div>}
    </Section>
  );
};

// Taxes & Tips
const TaxesTipsTab = () => {
  const [taxes, setTaxes] = useState({ defaultTaxRate: 0.08, taxMode: 'exclusive', serviceChargePercent: 0, applyTo: 'all' });
  const [tips, setTips] = useState({ enableTips: true, suggestedPercents: [10,15,20], tipOnPreTax: true, allowSplitTender: true });
  const [msg, setMsg] = useState('');
  useEffect(() => { (async () => {
    try { const t = await api.getSetting('taxes'); if (t?.value) setTaxes(t.value); } catch {}
    try { const tp = await api.getSetting('tips'); if (tp?.value) setTips(tp.value); } catch {}
  })(); }, []);
  const save = async () => { setMsg(''); try { await api.setSetting('taxes', taxes); await api.setSetting('tips', tips); setMsg('Saved.'); } catch { setMsg('Save failed'); } };
  return (
    <Section title="Taxes & Tips" actions={<button onClick={save} className="px-3 py-2 bg-blue-600 text-white rounded">Save</button>}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="font-medium mb-2">Taxes</div>
          <TextInput label="Default Tax Rate" type="number" value={taxes.defaultTaxRate} onChange={v=>setTaxes({...taxes, defaultTaxRate:Number(v)})} />
          <label className="block text-sm text-slate-300 mb-1">Tax Mode</label>
          <select className="border border-slate-700 bg-slate-800 text-slate-100 rounded px-3 py-2 w-full" value={taxes.taxMode} onChange={e=>setTaxes({...taxes, taxMode:e.target.value})}>
            <option value="exclusive">Exclusive</option>
            <option value="inclusive">Inclusive</option>
          </select>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <TextInput label="Service Charge %" type="number" value={taxes.serviceChargePercent} onChange={v=>setTaxes({...taxes, serviceChargePercent:Number(v)})} />
            <div>
              <label className="block text-sm text-slate-300 mb-1">Apply To</label>
              <select className="border border-slate-700 bg-slate-800 text-slate-100 rounded px-3 py-2 w-full" value={taxes.applyTo} onChange={e=>setTaxes({...taxes, applyTo:e.target.value})}>
                <option value="all">All</option>
                <option value="food">Food</option>
                <option value="drinks">Drinks</option>
              </select>
            </div>
          </div>
        </div>
        <div>
          <div className="font-medium mb-2">Tips</div>
          <Switch label="Enable Tips" checked={!!tips.enableTips} onChange={v=>setTips({...tips, enableTips:v})} />
          <TextInput label="Suggested Percents (comma-separated)" value={(tips.suggestedPercents||[]).join(',')} onChange={v=>setTips({...tips, suggestedPercents: v.split(',').map(s=>Number(s.trim())).filter(n=>!Number.isNaN(n))})} />
          <Switch label="Tip on Pre-Tax" checked={!!tips.tipOnPreTax} onChange={v=>setTips({...tips, tipOnPreTax:v})} />
          <Switch label="Allow Split Tender" checked={!!tips.allowSplitTender} onChange={v=>setTips({...tips, allowSplitTender:v})} />
        </div>
      </div>
      {msg && <div className="text-sm text-gray-600 mt-3">{msg}</div>}
    </Section>
  );
};

// Tables & Sessions
const TablesSessionsTab = () => {
  const [cfg, setCfg] = useState({ defaultHourlyRate: 15, maxSessionHours: 6, limitedSessionDefaults: { minutes: 60, warnAtRemainingMinutes: 5 }, cleaningMinutesDefault: 5, allowMergeSplit: true });
  const [msg, setMsg] = useState('');
  useEffect(()=>{(async()=>{ try{ const r=await api.getSetting('tables'); if(r?.value) setCfg(r.value);}catch{}})()},[]);
  const save = async()=>{ setMsg(''); try{ await api.setSetting('tables', cfg); setMsg('Saved.'); }catch{ setMsg('Save failed'); } };
  return (
    <Section title="Tables & Sessions" actions={<button onClick={save} className="px-3 py-2 bg-blue-600 text-white rounded">Save</button>}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TextInput label="Default Hourly Rate" type="number" value={cfg.defaultHourlyRate} onChange={v=>setCfg({...cfg, defaultHourlyRate:Number(v)})} />
        <TextInput label="Max Session Hours" type="number" value={cfg.maxSessionHours} onChange={v=>setCfg({...cfg, maxSessionHours:Number(v)})} />
        <TextInput label="Limited Minutes" type="number" value={cfg.limitedSessionDefaults.minutes} onChange={v=>setCfg({...cfg, limitedSessionDefaults:{...cfg.limitedSessionDefaults, minutes:Number(v)}})} />
        <TextInput label="Warn At Remaining (min)" type="number" value={cfg.limitedSessionDefaults.warnAtRemainingMinutes} onChange={v=>setCfg({...cfg, limitedSessionDefaults:{...cfg.limitedSessionDefaults, warnAtRemainingMinutes:Number(v)}})} />
        <TextInput label="Cleaning Minutes Default" type="number" value={cfg.cleaningMinutesDefault} onChange={v=>setCfg({...cfg, cleaningMinutesDefault:Number(v)})} />
        <div><Switch label="Allow Merge/Split" checked={!!cfg.allowMergeSplit} onChange={v=>setCfg({...cfg, allowMergeSplit:v})} /></div>
      </div>
      {msg && <div className="text-sm text-gray-600 mt-3">{msg}</div>}
    </Section>
  );
};

// Orders & KDS
const OrdersKDSTab = () => {
  const [orders, setOrders] = useState({ defaultPrepPriority: 'normal', voidCompGraceSeconds: 120, routeByCategory: true });
  const [kds, setKds] = useState({ pollIntervalMs: 2000, soundOnNewTicket: true, showModifiers: true, showTicketAging: true, autoCompleteThresholdMinutes: 0 });
  const [msg, setMsg] = useState('');
  useEffect(()=>{(async()=>{ try{ const o=await api.getSetting('orders'); if(o?.value) setOrders(o.value);}catch{} try{ const k=await api.getSetting('kds'); if(k?.value) setKds(k.value);}catch{} })()},[]);
  const save = async()=>{ setMsg(''); try{ await api.setSetting('orders', orders); await api.setSetting('kds', kds); setMsg('Saved.'); }catch{ setMsg('Save failed'); } };
  return (
    <Section title="Orders & KDS" actions={<button onClick={save} className="px-3 py-2 bg-blue-600 text-white rounded">Save</button>}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="font-medium mb-2">Orders</div>
          <label className="block text-sm text-gray-600 mb-1">Default Prep Priority</label>
          <select className="border rounded px-3 py-2 w-full" value={orders.defaultPrepPriority} onChange={e=>setOrders({...orders, defaultPrepPriority:e.target.value})}>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </select>
          <TextInput label="Void/Comp Grace (sec)" type="number" value={orders.voidCompGraceSeconds} onChange={v=>setOrders({...orders, voidCompGraceSeconds:Number(v)})} />
          <Switch label="Route by Category" checked={!!orders.routeByCategory} onChange={v=>setOrders({...orders, routeByCategory:v})} />
        </div>
        <div>
          <div className="font-medium mb-2">KDS</div>
          <TextInput label="Poll Interval (ms)" type="number" value={kds.pollIntervalMs} onChange={v=>setKds({...kds, pollIntervalMs:Number(v)})} />
          <Switch label="Sound On New Ticket" checked={!!kds.soundOnNewTicket} onChange={v=>setKds({...kds, soundOnNewTicket:v})} />
          <Switch label="Show Modifiers" checked={!!kds.showModifiers} onChange={v=>setKds({...kds, showModifiers:v})} />
          <Switch label="Show Ticket Aging" checked={!!kds.showTicketAging} onChange={v=>setKds({...kds, showTicketAging:v})} />
          <TextInput label="Auto-Complete Threshold (min, 0=off)" type="number" value={kds.autoCompleteThresholdMinutes} onChange={v=>setKds({...kds, autoCompleteThresholdMinutes:Number(v)})} />
        </div>
      </div>
      {msg && <div className="text-sm text-gray-600 mt-3">{msg}</div>}
    </Section>
  );
};

// Printing Layout
const PrintingLayoutTab = () => {
  const [cfg, setCfg] = useState({ receiptWidthMM: 80, logoOnReceipt: false, showQrOnFinal: true, showBillIdOnPrebill: true, copies: { prebill: 1, final: 1, kitchen: 1, bar: 1 } });
  const [msg, setMsg] = useState('');
  useEffect(()=>{(async()=>{ try{ const r=await api.getSetting('printing'); if(r?.value) setCfg(r.value);}catch{}})()},[]);
  const save = async()=>{ setMsg(''); try{ await api.setSetting('printing', cfg); setMsg('Saved.'); }catch{ setMsg('Save failed'); } };
  return (
    <Section title="Printing & Receipt Layout" actions={<button onClick={save} className="px-3 py-2 bg-blue-600 text-white rounded">Save</button>}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TextInput label="Receipt Width (mm)" type="number" value={cfg.receiptWidthMM} onChange={v=>setCfg({...cfg, receiptWidthMM:Number(v)})} />
        <Switch label="Logo on Receipt" checked={!!cfg.logoOnReceipt} onChange={v=>setCfg({...cfg, logoOnReceipt:v})} />
        <Switch label="Show QR on Final" checked={!!cfg.showQrOnFinal} onChange={v=>setCfg({...cfg, showQrOnFinal:v})} />
        <Switch label="Show Bill ID on Pre-bill" checked={!!cfg.showBillIdOnPrebill} onChange={v=>setCfg({...cfg, showBillIdOnPrebill:v})} />
        <div className="grid grid-cols-4 gap-2 md:col-span-2">
          <TextInput label="Copies: Pre-bill" type="number" value={cfg.copies.prebill} onChange={v=>setCfg({...cfg, copies:{...cfg.copies, prebill:Number(v)}})} />
          <TextInput label="Copies: Final" type="number" value={cfg.copies.final} onChange={v=>setCfg({...cfg, copies:{...cfg.copies, final:Number(v)}})} />
          <TextInput label="Copies: Kitchen" type="number" value={cfg.copies.kitchen} onChange={v=>setCfg({...cfg, copies:{...cfg.copies, kitchen:Number(v)}})} />
          <TextInput label="Copies: Bar" type="number" value={cfg.copies.bar} onChange={v=>setCfg({...cfg, copies:{...cfg.copies, bar:Number(v)}})} />
        </div>
      </div>
      {msg && <div className="text-sm text-gray-600 mt-3">{msg}</div>}
    </Section>
  );
};

// Cash Management
const CashManagementTab = () => {
  const [cfg, setCfg] = useState({ openFloatMin: 0, autoDropThreshold: 0, blindClose: true, overShortAlertThreshold: 10 });
  const [msg, setMsg] = useState('');
  useEffect(()=>{(async()=>{ try{ const r=await api.getSetting('cash'); if(r?.value) setCfg(r.value);}catch{}})()},[]);
  const save = async()=>{ setMsg(''); try{ await api.setSetting('cash', cfg); setMsg('Saved.'); }catch{ setMsg('Save failed'); } };
  return (
    <Section title="Cash Management" actions={<button onClick={save} className="px-3 py-2 bg-blue-600 text-white rounded">Save</button>}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TextInput label="Opening Float Min" type="number" value={cfg.openFloatMin} onChange={v=>setCfg({...cfg, openFloatMin:Number(v)})} />
        <TextInput label="Auto Drop Threshold" type="number" value={cfg.autoDropThreshold} onChange={v=>setCfg({...cfg, autoDropThreshold:Number(v)})} />
        <Switch label="Blind Close" checked={!!cfg.blindClose} onChange={v=>setCfg({...cfg, blindClose:v})} />
        <TextInput label="Over/Short Alert Threshold" type="number" value={cfg.overShortAlertThreshold} onChange={v=>setCfg({...cfg, overShortAlertThreshold:Number(v)})} />
      </div>
      {msg && <div className="text-sm text-gray-600 mt-3">{msg}</div>}
    </Section>
  );
};

// Reports & Compliance
const ReportsComplianceTab = () => {
  const [reports, setReports] = useState({ defaultShiftOpen: '10:00', defaultShiftClose: '18:00', includePaymentBreakdown: true, includeVoidComp: true, defaultExport: 'csv' });
  const [compliance, setCompliance] = useState({ legalFooter: '', privacyNoticeUrl: '', showTaxIdOnReceipt: true });
  const [msg, setMsg] = useState('');
  useEffect(()=>{(async()=>{ try{ const r=await api.getSetting('reports'); if(r?.value) setReports(r.value);}catch{} try{ const c=await api.getSetting('compliance'); if(c?.value) setCompliance(c.value);}catch{} })()},[]);
  const save = async()=>{ setMsg(''); try{ await api.setSetting('reports', reports); await api.setSetting('compliance', compliance); setMsg('Saved.'); }catch{ setMsg('Save failed'); } };
  return (
    <Section title="Reports & Compliance" actions={<button onClick={save} className="px-3 py-2 bg-blue-600 text-white rounded">Save</button>}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="font-medium mb-2">Reports</div>
          <TextInput label="Default Shift Open (HH:mm)" value={reports.defaultShiftOpen} onChange={v=>setReports({...reports, defaultShiftOpen:v})} />
          <TextInput label="Default Shift Close (HH:mm)" value={reports.defaultShiftClose} onChange={v=>setReports({...reports, defaultShiftClose:v})} />
          <Switch label="Include Payment Breakdown" checked={!!reports.includePaymentBreakdown} onChange={v=>setReports({...reports, includePaymentBreakdown:v})} />
          <Switch label="Include Void/Comp" checked={!!reports.includeVoidComp} onChange={v=>setReports({...reports, includeVoidComp:v})} />
          <label className="block text-sm text-slate-300 mb-1">Default Export</label>
          <select className="border border-slate-700 bg-slate-800 text-slate-100 rounded px-3 py-2 w-full" value={reports.defaultExport} onChange={e=>setReports({...reports, defaultExport:e.target.value})}>
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
          </select>
        </div>
        <div>
          <div className="font-medium mb-2">Compliance</div>
          <TextInput label="Legal Footer" value={compliance.legalFooter} onChange={v=>setCompliance({...compliance, legalFooter:v})} />
          <TextInput label="Privacy Notice URL" value={compliance.privacyNoticeUrl} onChange={v=>setCompliance({...compliance, privacyNoticeUrl:v})} />
          <Switch label="Show Tax ID on Receipt" checked={!!compliance.showTaxIdOnReceipt} onChange={v=>setCompliance({...compliance, showTaxIdOnReceipt:v})} />
        </div>
      </div>
      {msg && <div className="text-sm text-gray-600 mt-3">{msg}</div>}
    </Section>
  );
};

// Retention & Backups
const RetentionBackupsTab = () => {
  const [retention, setRetention] = useState({ auditLogsDays: 180, billsDays: 365, ordersDays: 365, autoCleanup: true });
  const [backups, setBackups] = useState({ enableBackups: false, schedule: 'daily', timeOfDay: '03:00', target: 'local' });
  const [msg, setMsg] = useState('');
  useEffect(()=>{(async()=>{ try{ const r=await api.getSetting('retention'); if(r?.value) setRetention(r.value);}catch{} try{ const b=await api.getSetting('backups'); if(b?.value) setBackups(b.value);}catch{} })()},[]);
  const save = async()=>{ setMsg(''); try{ await api.setSetting('retention', retention); await api.setSetting('backups', backups); setMsg('Saved.'); }catch{ setMsg('Save failed'); } };
  return (
    <Section title="Retention & Backups" actions={<button onClick={save} className="px-3 py-2 bg-blue-600 text-white rounded">Save</button>}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="font-medium mb-2">Retention</div>
          <TextInput label="Audit Logs (days)" type="number" value={retention.auditLogsDays} onChange={v=>setRetention({...retention, auditLogsDays:Number(v)})} />
          <TextInput label="Bills (days)" type="number" value={retention.billsDays} onChange={v=>setRetention({...retention, billsDays:Number(v)})} />
          <TextInput label="Orders (days)" type="number" value={retention.ordersDays} onChange={v=>setRetention({...retention, ordersDays:Number(v)})} />
          <Switch label="Auto Cleanup" checked={!!retention.autoCleanup} onChange={v=>setRetention({...retention, autoCleanup:v})} />
        </div>
        <div>
          <div className="font-medium mb-2">Backups</div>
          <Switch label="Enable Backups" checked={!!backups.enableBackups} onChange={v=>setBackups({...backups, enableBackups:v})} />
          <label className="block text-sm text-slate-300 mb-1">Schedule</label>
          <select className="border border-slate-700 bg-slate-800 text-slate-100 rounded px-3 py-2 w-full" value={backups.schedule} onChange={e=>setBackups({...backups, schedule:e.target.value})}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
          <TextInput label="Time of Day (HH:mm)" value={backups.timeOfDay} onChange={v=>setBackups({...backups, timeOfDay:v})} />
          <label className="block text-sm text-slate-300 mb-1">Target</label>
          <select className="border border-slate-700 bg-slate-800 text-slate-100 rounded px-3 py-2 w-full" value={backups.target} onChange={e=>setBackups({...backups, target:e.target.value})}>
            <option value="local">Local</option>
            <option value="gcs">GCS</option>
            <option value="s3">S3</option>
          </select>
        </div>
      </div>
      {msg && <div className="text-sm text-gray-600 mt-3">{msg}</div>}
    </Section>
  );
};

// Notifications & Integrations
const NotificationsIntegrationsTab = () => {
  const [notifications, setNotifications] = useState({ enableEmail: false, enableSMS: false, enableWebhook: false, webhookUrl: '', events: { paymentCompleted: true, kdsOverdue: true, shiftStartMissed: true } });
  const [integrations, setIntegrations] = useState({ accounting: { enabled: false }, analytics: { enabled: false } });
  const [msg, setMsg] = useState('');
  useEffect(()=>{(async()=>{ try{ const n=await api.getSetting('notifications'); if(n?.value) setNotifications(n.value);}catch{} try{ const i=await api.getSetting('integrations'); if(i?.value) setIntegrations(i.value);}catch{} })()},[]);
  const save = async()=>{ setMsg(''); try{ await api.setSetting('notifications', notifications); await api.setSetting('integrations', integrations); setMsg('Saved.'); }catch{ setMsg('Save failed'); } };
  return (
    <Section title="Notifications & Integrations" actions={<button onClick={save} className="px-3 py-2 bg-blue-600 text-white rounded">Save</button>}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="font-medium mb-2">Notifications</div>
          <Switch label="Enable Email" checked={!!notifications.enableEmail} onChange={v=>setNotifications({...notifications, enableEmail:v})} />
          <Switch label="Enable SMS" checked={!!notifications.enableSMS} onChange={v=>setNotifications({...notifications, enableSMS:v})} />
          <Switch label="Enable Webhook" checked={!!notifications.enableWebhook} onChange={v=>setNotifications({...notifications, enableWebhook:v})} />
          <TextInput label="Webhook URL" value={notifications.webhookUrl||''} onChange={v=>setNotifications({...notifications, webhookUrl:v})} />
          <div className="grid grid-cols-2 gap-2 mt-2">
            <Switch label="Event: Payment Completed" checked={!!notifications.events?.paymentCompleted} onChange={v=>setNotifications({...notifications, events:{...notifications.events, paymentCompleted:v}})} />
            <Switch label="Event: KDS Overdue" checked={!!notifications.events?.kdsOverdue} onChange={v=>setNotifications({...notifications, events:{...notifications.events, kdsOverdue:v}})} />
            <Switch label="Event: Shift Start Missed" checked={!!notifications.events?.shiftStartMissed} onChange={v=>setNotifications({...notifications, events:{...notifications.events, shiftStartMissed:v}})} />
          </div>
        </div>
        <div>
          <div className="font-medium mb-2">Integrations</div>
          <Switch label="Accounting Enabled" checked={!!integrations.accounting?.enabled} onChange={v=>setIntegrations({...integrations, accounting:{...integrations.accounting, enabled:v}})} />
          <Switch label="Analytics Enabled" checked={!!integrations.analytics?.enabled} onChange={v=>setIntegrations({...integrations, analytics:{...integrations.analytics, enabled:v}})} />
        </div>
      </div>
      {msg && <div className="text-sm text-gray-600 mt-3">{msg}</div>}
    </Section>
  );
};

// System / Hardware / PWA
const SystemHardwarePWATab = () => {
  const [system, setSystem] = useState({ maintenanceMode: false, apiBaseOverride: '', healthPollIntervalMs: 10000 });
  const [hardware, setHardware] = useState({ customerDisplay: { enabled: false, url: '' }, barcodeScanner: { prefix: '', suffix: '', delayMs: 0 }, cashDrawer: { kickCode: '', driver: '' } });
  const [pwa, setPwa] = useState({ cacheStrategy: 'networkFirst', syncIntervalMs: 30000, maxOfflineQueue: 200 });
  const [msg, setMsg] = useState('');
  useEffect(()=>{(async()=>{ try{ const s=await api.getSetting('system'); if(s?.value) setSystem(s.value);}catch{} try{ const h=await api.getSetting('hardware'); if(h?.value) setHardware(h.value);}catch{} try{ const p=await api.getSetting('pwa'); if(p?.value) setPwa(p.value);}catch{} })()},[]);
  const save = async()=>{ setMsg(''); try{ await api.setSetting('system', system); await api.setSetting('hardware', hardware); await api.setSetting('pwa', pwa); setMsg('Saved.'); }catch{ setMsg('Save failed'); } };
  return (
    <Section title="System / Hardware / PWA" actions={<button onClick={save} className="px-3 py-2 bg-blue-600 text-white rounded">Save</button>}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="font-medium mb-2">System</div>
          <Switch label="Maintenance Mode" checked={!!system.maintenanceMode} onChange={v=>setSystem({...system, maintenanceMode:v})} />
          <TextInput label="API Base Override" value={system.apiBaseOverride||''} onChange={v=>setSystem({...system, apiBaseOverride:v})} />
          <TextInput label="Health Poll Interval (ms)" type="number" value={system.healthPollIntervalMs} onChange={v=>setSystem({...system, healthPollIntervalMs:Number(v)})} />
        </div>
        <div>
          <div className="font-medium mb-2">Hardware</div>
          <Switch label="Customer Display Enabled" checked={!!hardware.customerDisplay?.enabled} onChange={v=>setHardware({...hardware, customerDisplay:{...hardware.customerDisplay, enabled:v}})} />
          <TextInput label="Customer Display URL" value={hardware.customerDisplay?.url||''} onChange={v=>setHardware({...hardware, customerDisplay:{...hardware.customerDisplay, url:v}})} />
          <TextInput label="Scanner Prefix" value={hardware.barcodeScanner?.prefix||''} onChange={v=>setHardware({...hardware, barcodeScanner:{...hardware.barcodeScanner, prefix:v}})} />
          <TextInput label="Scanner Suffix" value={hardware.barcodeScanner?.suffix||''} onChange={v=>setHardware({...hardware, barcodeScanner:{...hardware.barcodeScanner, suffix:v}})} />
          <TextInput label="Scanner Delay (ms)" type="number" value={hardware.barcodeScanner?.delayMs||0} onChange={v=>setHardware({...hardware, barcodeScanner:{...hardware.barcodeScanner, delayMs:Number(v)}})} />
          <TextInput label="Cash Drawer Kick Code" value={hardware.cashDrawer?.kickCode||''} onChange={v=>setHardware({...hardware, cashDrawer:{...hardware.cashDrawer, kickCode:v}})} />
          <TextInput label="Cash Drawer Driver" value={hardware.cashDrawer?.driver||''} onChange={v=>setHardware({...hardware, cashDrawer:{...hardware.cashDrawer, driver:v}})} />
        </div>
        <div className="md:col-span-2">
          <div className="font-medium mb-2">PWA</div>
          <label className="block text-sm text-gray-600 mb-1">Cache Strategy</label>
          <select className="border rounded px-3 py-2 w-full md:w-64" value={pwa.cacheStrategy} onChange={e=>setPwa({...pwa, cacheStrategy:e.target.value})}>
            <option value="networkFirst">networkFirst</option>
            <option value="staleWhileRevalidate">staleWhileRevalidate</option>
            <option value="cacheFirst">cacheFirst</option>
          </select>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <TextInput label="Sync Interval (ms)" type="number" value={pwa.syncIntervalMs} onChange={v=>setPwa({...pwa, syncIntervalMs:Number(v)})} />
            <TextInput label="Max Offline Queue" type="number" value={pwa.maxOfflineQueue} onChange={v=>setPwa({...pwa, maxOfflineQueue:Number(v)})} />
          </div>
        </div>
      </div>
      {msg && <div className="text-sm text-gray-600 mt-3">{msg}</div>}
    </Section>
  );
};

// UI / Accessibility
const UIAccessibilityTab = () => {
  const [ui, setUi] = useState({ theme: 'light', fontScale: 1, highContrast: false, hapticFeedback: false });
  const [msg, setMsg] = useState('');
  useEffect(()=>{(async()=>{ try{ const r=await api.getSetting('ui'); if(r?.value) setUi(r.value);}catch{}})()},[]);
  const save = async()=>{ setMsg(''); try{ await api.setSetting('ui', ui); setMsg('Saved.'); }catch{ setMsg('Save failed'); } };
  return (
    <Section title="UI & Accessibility" actions={<button onClick={save} className="px-3 py-2 bg-blue-600 text-white rounded">Save</button>}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="block text-sm text-gray-600 mb-1">Theme</label>
        <select className="border rounded px-3 py-2 w-full md:w-64" value={ui.theme} onChange={e=>setUi({...ui, theme:e.target.value})}>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="system">System</option>
        </select>
        <TextInput label="Font Scale" type="number" value={ui.fontScale} onChange={v=>setUi({...ui, fontScale:Number(v)})} />
        <Switch label="High Contrast" checked={!!ui.highContrast} onChange={v=>setUi({...ui, highContrast:v})} />
        <Switch label="Haptic Feedback" checked={!!ui.hapticFeedback} onChange={v=>setUi({...ui, hapticFeedback:v})} />
      </div>
      {msg && <div className="text-sm text-gray-600 mt-3">{msg}</div>}
    </Section>
  );
};

const GroupsTab = () => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', description: '', active: true });
  const load = async () => {
    setLoading(true);
    try { setGroups(await api.getPrinterGroups()); } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.name.trim()) return;
    await api.createPrinterGroup({ ...form });
    setForm({ name: '', description: '', active: true });
    load();
  };
  const update = async (id, patch) => { await api.updatePrinterGroup(id, patch); load(); };
  const remove = async (id) => { await api.deletePrinterGroup(id); load(); };

  return (
    <Section title="Printer Groups" actions={
      <div className="flex gap-2">
        <input className="border rounded px-3 py-2" placeholder="Group name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} />
        <input className="border rounded px-3 py-2" placeholder="Description" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} />
        <button onClick={create} className="px-3 py-2 bg-blue-600 text-white rounded">Add</button>
      </div>
    }>
      {loading ? 'Loading...' : (
        <div className="divide-y">
          {groups.map(g => (
            <div key={g.id} className="flex items-center gap-3 py-3">
              <div className="flex-1">
                <div className="font-medium">{g.name} {g.active ? '' : <span className="text-xs text-red-500">(inactive)</span>}</div>
                <div className="text-sm text-gray-500">{g.description || ''}</div>
              </div>
              <button onClick={()=>update(g.id, { active: g.active ? 0 : 1 })} className="px-3 py-1 rounded bg-gray-100">{g.active ? 'Disable' : 'Enable'}</button>
              <button onClick={()=>remove(g.id)} className="px-3 py-1 rounded bg-red-600 text-white">Delete</button>
            </div>
          ))}
          {groups.length === 0 && <div className="py-6 text-gray-500">No groups. Add one above.</div>}
        </div>
      )}
    </Section>
  );
};

const PrintersTab = () => {
  const [groups, setGroups] = useState([]);
  const [printers, setPrinters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ group_id: '', name: '', driver: 'web', connection_url: '', width_mm: 80, copies: 1, active: true });
  const load = async () => {
    setLoading(true);
    try {
      const [gs, ps] = await Promise.all([api.getPrinterGroups(), api.getPrinters()]);
      setGroups(gs); setPrinters(ps);
      if (!form.group_id && gs[0]) setForm(f=>({...f, group_id: gs[0].id}));
    } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.group_id || !form.name || !form.connection_url) return;
    await api.createPrinter({ ...form });
    setForm({ group_id: form.group_id, name: '', driver: 'web', connection_url: '', width_mm: 80, copies: 1, active: true });
    load();
  };
  const update = async (id, patch) => { await api.updatePrinter(id, patch); load(); };
  const remove = async (id) => { await api.deletePrinter(id); load(); };

  return (
    <Section title="Printers" actions={
      <div className="flex flex-wrap gap-2">
        <select className="border rounded px-3 py-2" value={form.group_id} onChange={e=>setForm({...form, group_id: e.target.value})}>
          <option value="">Select group</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <input className="border rounded px-3 py-2" placeholder="Printer name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} />
        <select className="border rounded px-3 py-2" value={form.driver} onChange={e=>setForm({...form,driver:e.target.value})}>
          <option value="web">web</option>
          <option value="ipp">ipp</option>
          <option value="escpos">escpos</option>
        </select>
        <input className="border rounded px-3 py-2 w-72" placeholder="Connection URL (e.g. http://ip:631/printers/X or usb://...)" value={form.connection_url} onChange={e=>setForm({...form,connection_url:e.target.value})} />
        <input type="number" className="border rounded px-3 py-2 w-24" placeholder="Width" value={form.width_mm} onChange={e=>setForm({...form,width_mm:Number(e.target.value)})} />
        <input type="number" className="border rounded px-3 py-2 w-24" placeholder="Copies" value={form.copies} onChange={e=>setForm({...form,copies:Number(e.target.value)})} />
        <button onClick={create} className="px-3 py-2 bg-blue-600 text-white rounded">Add</button>
      </div>
    }>
      {loading ? 'Loading...' : (
        <div className="divide-y">
          {printers.map(p => (
            <div key={p.id} className="flex items-center gap-3 py-3">
              <div className="flex-1">
                <div className="font-medium">{p.name} — <span className="text-sm text-gray-500">{p.driver}</span></div>
                <div className="text-sm text-gray-500">Group: {groups.find(g=>g.id===p.group_id)?.name || p.group_id} • URL: {p.connection_url} • {p.width_mm}mm • copies: {p.copies}</div>
              </div>
              <button onClick={()=>update(p.id, { active: p.active ? 0 : 1 })} className="px-3 py-1 rounded bg-gray-100">{p.active ? 'Disable' : 'Enable'}</button>
              <button onClick={()=>remove(p.id)} className="px-3 py-1 rounded bg-red-600 text-white">Delete</button>
            </div>
          ))}
          {printers.length === 0 && <div className="py-6 text-gray-500">No printers. Add one above.</div>}
        </div>
      )}
    </Section>
  );
};

const RoutingTab = () => {
  const [groups, setGroups] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ category: 'food', group_id: '' });

  const load = async () => {
    setLoading(true);
    try {
      const [gs, rs] = await Promise.all([api.getPrinterGroups(), api.getPrintRoutes()]);
      setGroups(gs); setRoutes(rs);
      if (!form.group_id && gs[0]) setForm(f=>({...f, group_id: gs[0].id}));
    } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.category || !form.group_id) return;
    await api.createPrintRoute({ ...form });
    setForm({ category: form.category, group_id: form.group_id });
    load();
  };
  const update = async (id, patch) => { await api.updatePrintRoute(id, patch); load(); };
  const remove = async (id) => { await api.deletePrintRoute(id); load(); };

  const categories = ['beers','cocktails','food','combos','billiard','other'];

  return (
    <Section title="Routing by Menu Category" actions={
      <div className="flex flex-wrap gap-2">
        <select className="border rounded px-3 py-2" value={form.category} onChange={e=>setForm({...form, category: e.target.value})}>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="border rounded px-3 py-2" value={form.group_id} onChange={e=>setForm({...form, group_id: e.target.value})}>
          <option value="">Select group</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <button onClick={create} className="px-3 py-2 bg-blue-600 text-white rounded">Map</button>
      </div>
    }>
      {loading ? 'Loading...' : (
        <div className="divide-y">
          {routes.map(r => (
            <div key={r.id} className="flex items-center gap-3 py-3">
              <div className="flex-1">
                <div className="font-medium">{r.category}</div>
                <div className="text-sm text-gray-500">Group: {groups.find(g=>g.id===r.group_id)?.name || r.group_id}</div>
              </div>
              <button onClick={()=>update(r.id, { group_id: groups[0]?.id || r.group_id })} className="px-3 py-1 rounded bg-gray-100">Set to first group</button>
              <button onClick={()=>remove(r.id)} className="px-3 py-1 rounded bg-red-600 text-white">Delete</button>
            </div>
          ))}
          {routes.length === 0 && <div className="py-6 text-gray-500">No routing rules. Add one above.</div>}
        </div>
      )}
    </Section>
  );
};

const AdminSettings = () => {
  const navigate = useNavigate();
  const { hasPermission, isPinRequired, verifyPin } = useSettings();
  const [accessDenied, setAccessDenied] = useState(false);
  const [pinVerified, setPinVerified] = useState(false);
  const [pinError, setPinError] = useState('');

  // Check if user has permission to access admin settings
  const checkAccess = useCallback(async () => {
    try {
      // Check if PIN is required for admin access
      if (isPinRequired('admin_access') && !pinVerified) {
        const pin = prompt('Enter admin PIN to continue:');
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
      if (!hasPermission('admin_settings')) {
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
    checkAccess();
  }, [checkAccess]);

  if (accessDenied) {
    return (
      <div className="p-6">
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
          <p className="font-bold">Access Denied</p>
          <p>{pinError || 'You do not have permission to access admin settings.'}</p>
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
  // Define grouped navigation with subtabs; reuse existing tab components
  const groups = [
    {
      key: 'store', name: 'Store', subs: [
        { key: 'general', name: 'General', render: () => <GeneralTab /> },
      ]
    },
    {
      key: 'security', name: 'Security', subs: [
        { key: 'securityRoles', name: 'Security & Roles', render: () => <SecurityTab /> },
      ]
    },
    {
      key: 'sales', name: 'Sales', subs: [
        { key: 'taxesTips', name: 'Taxes & Tips', render: () => <TaxesTipsTab /> },
        { key: 'printingLayout', name: 'Printing & Receipt', render: () => <PrintingLayoutTab /> },
      ]
    },
    {
      key: 'operations', name: 'Operations', subs: [
        { key: 'tables', name: 'Tables & Sessions', render: () => <TablesSessionsTab /> },
        { key: 'ordersKds', name: 'Orders & KDS', render: () => <OrdersKDSTab /> },
        { key: 'routing', name: 'Routing', render: () => <RoutingTab /> },
        { key: 'groups', name: 'Printer Groups', render: () => <GroupsTab /> },
        { key: 'printers', name: 'Printers', render: () => <PrintersTab /> },
        { key: 'cash', name: 'Cash Mgmt', render: () => <CashManagementTab /> },
      ]
    },
    {
      key: 'compliance', name: 'Compliance', subs: [
        { key: 'reportsCompliance', name: 'Reports & Compliance', render: () => <ReportsComplianceTab /> },
        { key: 'retention', name: 'Retention & Backups', render: () => <RetentionBackupsTab /> },
      ]
    },
    {
      key: 'system', name: 'System', subs: [
        { key: 'notifications', name: 'Notifications & Integrations', render: () => <NotificationsIntegrationsTab /> },
        { key: 'hardware', name: 'System/Hardware/PWA', render: () => <SystemHardwarePWATab /> },
        { key: 'ui', name: 'UI & Accessibility', render: () => <UIAccessibilityTab /> },
      ]
    },
  ];

  const [activeGroup, setActiveGroup] = useState(groups[0].key);
  const [activeSub, setActiveSub] = useState(groups[0].subs[0].key);

  const currentGroup = groups.find(g => g.key === activeGroup) || groups[0];
  const currentSub = currentGroup.subs.find(s => s.key === activeSub) || currentGroup.subs[0];

  // Ensure activeSub is valid when group changes
  useEffect(() => {
    const grp = groups.find(g => g.key === activeGroup);
    if (grp && !grp.subs.find(s => s.key === activeSub)) {
      setActiveSub(grp.subs[0]?.key || '');
    }
  }, [activeGroup]);

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-6">Admin Settings</h1>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Left: Groups */}
          <div className="md:col-span-1">
            <div className="pos-card p-2">
              <div className="flex md:flex-col gap-2">
                {groups.map(g => (
                  <button
                    key={g.key}
                    onClick={() => setActiveGroup(g.key)}
                    className={`px-3 py-2 rounded text-left ${activeGroup===g.key ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                  >{g.name}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Subtabs + Panel */}
          <div className="md:col-span-4">
            <div className="pos-card">
              <div className="flex flex-wrap gap-2 p-2 border-b border-gray-700">
                {currentGroup.subs.map(s => (
                  <button
                    key={s.key}
                    onClick={() => setActiveSub(s.key)}
                    className={`px-4 py-2 rounded ${activeSub===s.key ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                  >{s.name}</button>
                ))}
              </div>
              <div className="p-4">
                {currentSub?.render && currentSub.render()}
              </div>
            </div>

            <div className="text-sm text-gray-400 mt-3">Tip: Configure groups (e.g., Kitchen, Barra), add printers under groups, then map menu categories to groups in Routing.</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;
