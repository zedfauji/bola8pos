import React, { useEffect, useState } from 'react';

const loadStoreCfg = () => {
  try {
    const raw = localStorage.getItem('pos_store_config');
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    name: 'BOLA8 POS',
    address: '123 Billiard Lane, Cue City',
    phone: '',
    taxId: '',
    currencySymbol: '$',
    locale: 'en-US',
    currencyCode: 'USD',
    footer: 'Thank you for visiting! Please come again.'
  };
};

const SettingsPage = () => {
  const [cfg, setCfg] = useState(loadStoreCfg());
  const [saved, setSaved] = useState(false);

  useEffect(() => { setSaved(false); }, [cfg]);

  const handleSave = () => {
    const next = { ...cfg };
    if (!next.locale) next.locale = 'en-US';
    if (!next.currencyCode) next.currencyCode = 'USD';
    try { localStorage.setItem('pos_store_config', JSON.stringify(next)); } catch {}
    setCfg(next);
    setSaved(true);
  };

  const examplePreview = () => {
    try {
      const nf = new Intl.NumberFormat(cfg.locale || 'en-US', { style: 'currency', currency: cfg.currencyCode || 'USD' });
      const dt = new Intl.DateTimeFormat(cfg.locale || 'en-US', { dateStyle: 'short', timeStyle: 'short' });
      return `${dt.format(new Date())} • ${nf.format(1234.56)}`;
    } catch {
      return `${new Date().toLocaleString()} • ${(cfg.currencySymbol||'$')}1234.56`;
    }
  };

  return (
    <div className="bg-slate-900 text-slate-100 rounded-xl shadow p-6 border border-slate-800">
      <h1 className="text-2xl font-bold mb-4">Settings</h1>

      <div className="bg-slate-900 rounded-xl shadow p-6 border border-slate-700">
        <h2 className="text-xl font-semibold mb-4">Store Receipt Settings</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1">Store Name</label>
            <input className="w-full border border-slate-700 bg-slate-800 text-slate-100 rounded px-3 py-2" value={cfg.name||''} onChange={(e)=>setCfg({...cfg, name:e.target.value})} />
          </div>
          <div>
            <label className="block text-sm text-slate-300 mb-1">Phone</label>
            <input className="w-full border border-slate-700 bg-slate-800 text-slate-100 rounded px-3 py-2" value={cfg.phone||''} onChange={(e)=>setCfg({...cfg, phone:e.target.value})} />
          </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-slate-300 mb-1">Address</label>
              <input className="w-full border border-slate-700 bg-slate-800 text-slate-100 rounded px-3 py-2" value={cfg.address||''} onChange={(e)=>setCfg({...cfg, address:e.target.value})} />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1">Tax ID</label>
              <input className="w-full border border-slate-700 bg-slate-800 text-slate-100 rounded px-3 py-2" value={cfg.taxId||''} onChange={(e)=>setCfg({...cfg, taxId:e.target.value})} />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1">Currency Symbol</label>
              <input className="w-full border border-slate-700 bg-slate-800 text-slate-100 rounded px-3 py-2" value={cfg.currencySymbol||''} onChange={(e)=>setCfg({...cfg, currencySymbol:e.target.value})} />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1">Locale</label>
              <input placeholder="e.g. en-US, es-MX" className="w-full border border-slate-700 bg-slate-800 text-slate-100 rounded px-3 py-2" value={cfg.locale||''} onChange={(e)=>setCfg({...cfg, locale:e.target.value})} />
            </div>
            <div>
              <label className="block text-sm text-slate-300 mb-1">Currency Code</label>
              <input placeholder="e.g. USD, MXN" className="w-full border border-slate-700 bg-slate-800 text-slate-100 rounded px-3 py-2" value={cfg.currencyCode||''} onChange={(e)=>setCfg({...cfg, currencyCode:e.target.value})} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-slate-300 mb-1">Footer</label>
              <textarea rows={3} className="w-full border border-slate-700 bg-slate-800 text-slate-100 rounded px-3 py-2" value={cfg.footer||''} onChange={(e)=>setCfg({...cfg, footer:e.target.value})} />
            </div>
          </div>

          <div className="text-sm text-slate-400 mt-3">Preview: {examplePreview()}</div>

          <div className="flex justify-end mt-6">
            <button onClick={handleSave} className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold">Save Settings</button>
          </div>
          {saved && (
            <div className="mt-3 text-sm text-green-400">Settings saved.</div>
          )}
      </div>
    </div>
  );
};

export default SettingsPage;
