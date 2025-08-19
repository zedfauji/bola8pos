import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../../services/api';
import { useSettings } from '../../contexts/SettingsContext';

function Modal({ title, children, onClose, testId }) {
  // Prevent body scroll when modal is open
  React.useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const modalContent = (
    <div 
      className="fixed inset-0 flex items-center justify-center p-4" 
      style={{ 
        zIndex: '2147483647',
        position: 'fixed',
        top: '0',
        left: '0',
        right: '0', 
        bottom: '0',
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        backdropFilter: 'blur(2px)'
      }}
      onClick={(e) => {
        // Close on backdrop click
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-gray-900 rounded-lg shadow-xl w-full max-w-md relative"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid={testId || undefined}
        style={{ 
          zIndex: '2147483647',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-gray-700 flex items-center justify-between">
          <h3 className="text-white font-semibold">{title}</h3>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-white text-xl leading-none" 
            data-testid="modal-close-x"
            style={{ minWidth: '24px', minHeight: '24px' }}
          >
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );

  // Render modal at document root using Portal
  return createPortal(modalContent, document.body);
}

export default function ShiftBar() {
  const { isPinRequired, verifyPin, access, isLoading, checkAccess } = useSettings();
  const [loading, setLoading] = useState(false);
  const [shift, setShift] = useState(null);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // { type: 'open'|'movement'|'close', payload }
  const isLoadingRef = useRef(isLoading);
  useEffect(() => { isLoadingRef.current = isLoading; }, [isLoading]);
  const startCashRef = useRef(null);

  async function refresh() {
    try {
      setError('');
      const s = await api.getActiveShift();
      setShift(s && s.id ? s : null);
      if (!s || !s.id) {
        // no active shift info
      }
    } catch (e) {
      setError('Failed to load shift');
      if (window.toast) window.toast.error('Failed to load shift');
    }
  }

  useEffect(() => { refresh(); }, []);

  // Wait for settings to load to avoid enforcing default PIN flags before real settings arrive
  async function waitForSettingsReady() {
    if (!isLoadingRef.current) return;
    // wait up to ~3s
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 50));
      if (!isLoadingRef.current) break;
    }
  }

  async function ensurePinIfRequired(action, force = false, context = {}) {
    if (!force && !isPinRequired(action)) return true;
    const {
      actionLabel,
      amount,
      threshold,
    } = context || {};

    // Improved copy for PIN prompt
    const parts = [];
    parts.push(`Manager approval required to ${actionLabel || 'perform this action'}.`);
    if (typeof amount === 'number' && typeof threshold === 'number') {
      parts.push(`Note: payouts at or above ${Number(threshold).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} require manager PIN. This amount: ${Number(amount).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}.`);
    }
    const message = parts.join('\n');

    let pin = '';
    // Keep prompt for compatibility with tests; future enhancement could use a dedicated modal
    pin = window.prompt(message, '');
    if (pin == null) return false;
    const res = await verifyPin(pin);
    if (!res.ok) {
      setError('Invalid PIN');
      return false;
    }
    return true;
  }

  function openOpenModal() {
    // Prefill from last remembered start cash
    let last = 200;
    try { const v = localStorage.getItem('pos_last_start_cash'); if (v!=null) last = Number(v)||200; } catch {}
    setModal({ type: 'open', payload: { start: last, notes: '' } });
  }
  function openMovementModal(kind) {
    setModal({ type: 'movement', payload: { kind, amount: kind==='adjustment'?5:20, reason: '' } });
  }
  function openCloseModal() {
    setModal({ type: 'close', payload: { counted: 0, notes: '', useDenoms: true, denoms: { 100:0, 50:0, 20:0, 10:0, 5:0, 1:0, 0.25:0, 0.1:0, 0.05:0, 0.01:0 } } });
  }

  async function submitOpen({ start, notes }) {
    await waitForSettingsReady();
    if (!(await ensurePinIfRequired('start', false, { actionLabel: 'open this shift' }))) return;
    setLoading(true);
    try {
      // Clamp to 2 decimals and disallow negatives
      const amount = Math.max(0, Math.round((Number(start)||0)*100)/100);
      const opened = await api.openShift({ start_cash: amount, notes: notes||'Opened via UI' });
      try { localStorage.setItem('pos_last_start_cash', String(amount)); } catch {}
      // Immediately reflect the opened shift in UI to avoid timing issues
      if (opened && opened.id) setShift(opened);
      setError('');
      setModal(null);
      // Background refresh to sync any server-calculated fields
      refresh();
      if (window.toast) window.toast.success('Shift opened');
    } catch (e) { setError(e.message||'Open failed'); } finally { setLoading(false); }
  }

  async function submitMovement({ kind, amount, reason }) {
    await waitForSettingsReady();
    // Always enforce PIN for payouts; other movements follow lifecycle PIN flag
    let requireAction = 'finalize';
    if (kind === 'payout') {
      requireAction = 'refund';
      if (!(await ensurePinIfRequired(requireAction, true, { actionLabel: 'authorize this payout' }))) return;
    } else {
      if (!(await ensurePinIfRequired(requireAction, false, { actionLabel: 'record this cash movement' }))) return;
    }
    setLoading(true);
    try {
      await api.addShiftMovement(shift.id, { type: kind, amount: Number(amount)||0, reason: reason||'' });
      await refresh();
      setModal(null);
      if (window.toast) window.toast.success(`${kind} recorded`);
      // Offer/auto-print a small receipt for cash movements
      if (kind === 'drop' || kind === 'payout' || kind === 'adjustment') {
        printMovementReceipt(kind, amount, reason);
      }
    } catch (e) { setError(e.message||'Movement failed'); } finally { setLoading(false); }
  }

  async function submitClose({ counted, notes }) {
    await waitForSettingsReady();
    if (!(await ensurePinIfRequired('end', false, { actionLabel: 'close this shift' }))) return;
    setLoading(true);
    try {
      await api.closeShift(shift.id, { end_cash_counted: Number(counted)||0, notes: notes||'Closed via UI' });
      await refresh();
      setModal(null);
      if (window.toast) window.toast.success('Shift closed');
    } catch (e) { setError(e.message||'Close failed'); } finally { setLoading(false); }
  }

  function printSummary() {
    if (!shift) return;
    const w = window.open('', 'shift_summary');
    const now = new Date().toLocaleString();
    const movementsHtml = (shift.movements||[]).map(m=>`<tr><td>${m.type}</td><td>${Number(m.amount).toFixed(2)}</td><td>${m.reason||''}</td><td>${m.created_at||''}</td></tr>`).join('');
    w.document.write(`
      <html><head><title>Shift Summary</title>
      <style>
        body{font-family:ui-sans-serif,system-ui; padding:16px;}
        h1{font-size:18px;margin:0 0 8px}
        table{width:100%;border-collapse:collapse;margin-top:8px}
        td,th{border-bottom:1px solid #ddd;padding:6px 4px;text-align:left;font-size:12px}
        .muted{color:#666}
        .sign{margin-top:24px; display:flex; gap:24px}
        .line{border-top:1px solid #333; width:220px; height:1px}
        .label{font-size:12px;color:#333;margin-top:6px}
        @media print{ body{color:#000} }
      </style>
      </head><body>
      <h1>Shift Close Report</h1>
      <div class="muted">${now}</div>
      <table>
        <tr><th>Expected Cash</th><td>${shift.expected?.toFixed?.(2) ?? shift.expected}</td></tr>
        <tr><th>Counted Cash</th><td>${shift.counted?.toFixed?.(2) ?? (shift.counted ?? '-')}</td></tr>
        <tr><th>Over/Short</th><td>${shift.over_short ?? '-'}</td></tr>
      </table>
      <h3>Movements</h3>
      <table>
        <tr><th>Type</th><th>Amount</th><th>Reason</th><th>At</th></tr>
        ${movementsHtml}
      </table>
      <div class="sign">
        <div>
          <div class="line"></div>
          <div class="label">Cashier Signature</div>
        </div>
        <div>
          <div class="line"></div>
          <div class="label">Manager Signature</div>
        </div>
      </div>
      <script>window.print()</script>
      </body></html>
    `);
    w.document.close();
  }

  function printMovementReceipt(kind, amount, reason) {
    const w = window.open('', 'movement_receipt');
    const now = new Date().toLocaleString();
    w.document.write(`
      <html><head><title>${kind} Receipt</title>
      <style>
        body{font-family:ui-sans-serif,system-ui; padding:16px; width:280px}
        h1{font-size:16px;margin:0 0 8px}
        .row{display:flex;justify-content:space-between;font-size:12px;margin:4px 0}
        .sign{margin-top:24px}
        .line{border-top:1px solid #333; width:220px; height:1px}
        .label{font-size:12px;color:#333;margin-top:6px}
      </style>
      </head><body>
      <h1>${kind.toUpperCase()} Receipt</h1>
      <div class="row"><span>Date</span><span>${now}</span></div>
      <div class="row"><span>Amount</span><span>${Number(amount).toFixed(2)}</span></div>
      <div class="row"><span>Reason</span><span>${reason||''}</span></div>
      <div class="sign" style="margin-top:24px">
        <div class="line"></div>
        <div class="label">Authorized By</div>
      </div>
      <script>window.print()</script>
      </body></html>
    `);
    w.document.close();
  }

  return (
    <div className="flex items-center gap-2">
      {error ? <span className="text-red-400 text-sm">⚠ {error}</span> : null}
      {!shift ? (
        <button disabled={loading || (checkAccess && !checkAccess('shifts','open'))} onClick={openOpenModal} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded flex items-center gap-2">
          {loading ? <span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full"></span> : null}
          <span>Open Shift</span>
        </button>
      ) : (
        <>
          <span className="text-sm text-gray-300">Shift: {shift.id}</span>
          <button disabled={(checkAccess && !checkAccess('shifts.movement','drop'))} onClick={() => openMovementModal('drop')} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed">Drop</button>
          <div className="flex items-center gap-2">
            <button disabled={(checkAccess && !checkAccess('shifts.movement','payout'))} onClick={() => openMovementModal('payout')} className="bg-yellow-600 hover:bg-yellow-700 text-black px-3 py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed">Payout</button>
            <span className="text-[11px] text-gray-400">PIN Required</span>
          </div>
          <button disabled={(checkAccess && !checkAccess('shifts.movement','adjust'))} onClick={() => openMovementModal('adjustment')} className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed">Adjust</button>
          <button disabled={(checkAccess && !checkAccess('shifts','print'))} onClick={printSummary} className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed">Print</button>
          <button disabled={loading || (checkAccess && !checkAccess('shifts','close'))} onClick={openCloseModal} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? <span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full"></span> : null}
            <span>Close</span>
          </button>
        </>
      )}

      {/* Modals */}
      {modal?.type === 'open' && (
        <Modal title="Open Shift" onClose={() => setModal(null)} testId="modal-open-shift">
          <form onSubmit={(e)=>{e.preventDefault(); const amt=Number(modal.payload.start); if (!isFinite(amt) || amt<0) return; submitOpen(modal.payload);}}>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label htmlFor="start-cash" className="text-sm text-gray-300">Start Cash</label>
                {isPinRequired('start') ? (<span className="text-[11px] text-gray-400">PIN Required</span>) : null}
              </div>
              <input id="start-cash" ref={startCashRef} autoFocus data-testid="open-start-cash" className="pos-input w-full" type="number" min="0" step="0.01" value={modal.payload.start}
                onChange={e=>{
                  const v=e.target.value; setModal(m=>({...m,payload:{...m.payload,start:v}}));
                }} />
              <div className="text-[12px] text-gray-400">Opening drawer cash. Use quick buttons or enter a custom amount.</div>
              <div className="flex gap-2">
                {[0,100,200].map(v=> (
                  <button type="button" key={v} className="pos-button-secondary px-2 py-1" onClick={()=>setModal(m=>({...m,payload:{...m.payload,start:String(v)}}))}>{v.toLocaleString('en-US',{style:'currency',currency:'USD'})}</button>
                ))}
              </div>
              {(() => { const n=Number(modal.payload.start); const invalid = !isFinite(n) || n<0; return invalid ? (<div className="text-red-400 text-xs">Enter a valid non-negative amount.</div>) : null; })()}
              <label htmlFor="open-notes" className="block text-sm text-gray-300">Notes</label>
              <textarea id="open-notes" placeholder="Optional notes (e.g., shift handover)" className="pos-input w-full" rows={3} value={modal.payload.notes}
                onChange={e=>setModal(m=>({...m,payload:{...m.payload,notes:e.target.value}}))} />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={()=>setModal(null)} className="pos-button-secondary">Cancel</button>
                <button type="submit" disabled={!isFinite(Number(modal.payload.start)) || Number(modal.payload.start) < 0} className="pos-button disabled:opacity-50 disabled:cursor-not-allowed">Open</button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {modal?.type === 'movement' && (
        <Modal title={`Add ${modal.payload.kind}`} onClose={() => setModal(null)} testId="modal-movement">
          <div className="space-y-3">
            <label className="block text-sm text-gray-300">Amount</label>
            <input data-testid="movement-amount" className="pos-input w-full" type="number" step="0.01" value={modal.payload.amount}
              onChange={e=>setModal(m=>({...m,payload:{...m.payload,amount:e.target.value}}))} />
            {modal.payload.kind === 'payout' ? (
              <div className="text-[12px] text-gray-400">
                Manager PIN is required for all payouts. Current amount: {Number(modal.payload.amount || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}.
              </div>
            ) : null}
            <label className="block text-sm text-gray-300">Reason</label>
            <input data-testid="movement-reason" className="pos-input w-full" value={modal.payload.reason}
              onChange={e=>setModal(m=>({...m,payload:{...m.payload,reason:e.target.value}}))} />
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={()=>setModal(null)} className="pos-button-secondary">Cancel</button>
              <button onClick={()=>submitMovement(modal.payload)} className="pos-button">Add</button>
            </div>
          </div>
        </Modal>
      )}

      {modal?.type === 'close' && (
        <Modal title="Close Shift" onClose={() => setModal(null)} testId="modal-close-shift">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-300">Use Denominations</label>
              <input type="checkbox" className="w-4 h-4" checked={!!modal.payload.useDenoms}
                onChange={e=>setModal(m=>({...m,payload:{...m.payload,useDenoms:e.target.checked}}))} />
            </div>

            {modal.payload.useDenoms ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  100,50,20,10,5,1,0.25,0.1,0.05,0.01
                ].map(v => (
                  <div key={v} className="bg-white/5 rounded p-2" data-testid={`denom-cell-${v}`}>
                    <div className="text-xs text-gray-400">${v.toFixed(2)}</div>
                    <input data-testid={`denom-input-${v}`} className="pos-input w-full mt-1" type="number" min="0" step="1" value={modal.payload.denoms[String(v)] ?? 0}
                      onChange={e=>setModal(m=>{
                        const qty = Math.max(0, Number(e.target.value)||0);
                        const denoms = { ...m.payload.denoms, [String(v)]: qty };
                        const counted = Object.entries(denoms).reduce((sum,[k,q])=> sum + (Number(k)*Number(q||0)), 0);
                        return { ...m, payload: { ...m.payload, denoms, counted } };
                      })}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div>
                <label className="block text-sm text-gray-300">Counted Cash</label>
                <input data-testid="close-counted" className="pos-input w-full" type="number" step="0.01" value={modal.payload.counted}
                  onChange={e=>setModal(m=>({...m,payload:{...m.payload,counted:e.target.value}}))} />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white/5 rounded p-3">
                <div className="text-xs text-gray-400">Expected</div>
                <div className="text-white font-semibold">${shift && shift.expected != null ? Number(shift.expected).toFixed(2) : '-'}</div>
              </div>
              <div className="bg-white/5 rounded p-3">
                <div className="text-xs text-gray-400">Counted</div>
                <div className="text-white font-semibold">${Number(modal.payload.counted || 0).toFixed(2)}</div>
              </div>
              <div className="bg-white/5 rounded p-3">
                <div className="text-xs text-gray-400">Over / Short</div>
                <div className={`font-semibold ${(() => {
                  const exp = Number(shift?.expected ?? 0);
                  const cnt = Number(modal.payload.counted || 0);
                  const diff = (cnt - exp);
                  return diff < 0 ? 'text-red-400' : diff > 0 ? 'text-green-400' : 'text-white';
                })()}`}>{(() => {
                  const exp = Number(shift?.expected ?? 0);
                  const cnt = Number(modal.payload.counted || 0);
                  const diff = (cnt - exp);
                  return diff.toFixed(2);
                })()}</div>
              </div>
            </div>

            <label className="block text-sm text-gray-300">Notes</label>
            <textarea className="pos-input w-full" rows={3} value={modal.payload.notes}
              onChange={e=>setModal(m=>({...m,payload:{...m.payload,notes:e.target.value}}))} />

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={()=>setModal(null)} className="pos-button-secondary">Cancel</button>
              <button onClick={()=>submitClose(modal.payload)} className="pos-button bg-red-600 hover:bg-red-700">Close</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
