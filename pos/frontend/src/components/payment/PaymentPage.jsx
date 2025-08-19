import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSettings } from '../../contexts/SettingsContext';
import api from '../../services/api';

const PaymentPage = () => {
  // Get settings from context
  const {
    taxes: taxesCfg,
    tips: tipsCfg,
    store: storeSettings,
    printing: printingCfg,
    isPinRequired,
    formatCurrency,
    calculateTax,
    updateSetting,
  } = useSettings();

  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [tip, setTip] = useState(0);
  const [paid, setPaid] = useState(false);
  const { tableId } = useParams();
  const navigate = useNavigate();
  const [receiptSize, setReceiptSize] = useState(printingCfg?.receiptWidthMM <= 58 ? '58mm' : '80mm');
  const [storeOpen, setStoreOpen] = useState(false);
  const [discounts, setDiscounts] = useState([]);
  const [discountsLoading, setDiscountsLoading] = useState(true);
  const [discountsError, setDiscountsError] = useState('');
  const [applyIds, setApplyIds] = useState([]); // selected discount ids
  const [manageOpen, setManageOpen] = useState(false);

  const [pendingBills, setPendingBills] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [splitOpen, setSplitOpen] = useState(false);
  const [splitPct, setSplitPct] = useState(50);
  const [lineItems, setLineItems] = useState([]);
  const [polling, setPolling] = useState(true);
  const [cash, setCash] = useState('');
  const [card, setCard] = useState('');
  const [lastBill, setLastBill] = useState(null);
  const [memberId, setMemberId] = useState('');
  const getCashier = () => { try { return localStorage.getItem('pos_cashier_name') || ''; } catch { return ''; } };
  const [cashierName, setCashierName] = useState(getCashier());

  // Load pending bills and preselect from route param if present
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await api.getPendingBills();
        const bills = Array.isArray(res?.bills) ? res.bills : [];
        const mapped = bills.map(b => ({
          id: b.table_id,
          customer: `Table ${b.table_id}`,
          createdAt: b.createdAt ? new Date(b.createdAt).getTime() : Date.now(),
          itemSubtotal: Number(b.itemSubtotal || 0),
          timeCharge: Number(b.timeCharge || 0),
          servicesCharge: Number(b.servicesCharge || 0),
          itemsCount: b.items ? b.items.length : 0,
          status: b.status || 'pending'
        }));
        
        if (active) {
          setPendingBills(mapped);
          // If tableId is provided in URL, select it
          if (tableId) {
            setSelectedId(tableId);
          } else if (mapped.length === 1 && !selectedId) {
            // If there's only one pending bill, auto-select it
            setSelectedId(mapped[0].id);
          }
        }
      } catch (e) {
        console.error('Failed to load pending bills', e);
      }
    };
    
    load();
    // Polling for pending bills while on page
    const iv = setInterval(() => {
      if (!polling) return;
      load();
    }, 10000);
    
    return () => { 
      active = false;
      clearInterval(iv);
    };
  }, [tableId, polling]);

  // Update receipt size when printing config changes
  useEffect(() => {
    if (printingCfg?.receiptWidthMM) {
      setReceiptSize(printingCfg.receiptWidthMM <= 58 ? '58mm' : '80mm');
    }
  }, [printingCfg]);

  // Load active discounts from backend
  useEffect(() => {
    let active = true;
    (async () => {
      setDiscountsLoading(true);
      setDiscountsError('');
      try {
        const rows = await api.getDiscounts();
        const mapped = Array.isArray(rows)
          ? rows.filter(r => r.active !== 0 && r.active !== false)
                .map(r => ({
                  id: r.id,
                  name: r.name,
                  type: r.kind || r.type || 'percent',
                  scope: r.scope || 'total',
                  value: Number(r.value || 0),
                  active: !!r.active,
                }))
          : [];
        if (active) setDiscounts(mapped);
      } catch (e) {
        if (active) setDiscountsError(String(e.message || e));
      } finally {
        if (active) setDiscountsLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const selectedBill = pendingBills.find(b => b.id === selectedId) || null;

  // Handle bill selection
  const handleBillSelect = (billId) => {
    setSelectedId(billId);
    navigate(`/payment/${billId}`, { replace: true });
  };

  // Fetch line items for selected bill
  useEffect(() => {
    let mounted = true;
    const fetchLines = async () => {
      if (!selectedBill) { setLineItems([]); return; }
      try {
        const agg = await api.getOpenItemsByTable(selectedBill.id);
        const list = Array.isArray(agg?.items) ? agg.items : [];
        if (mounted) setLineItems(list);
      } catch (e) {
        console.warn('Failed to load line items', e);
        if (mounted) setLineItems([]);
      }
    };
    fetchLines();
    const iv = setInterval(fetchLines, 8000);
    return () => { mounted = false; clearInterval(iv); };
  }, [selectedBill?.id]);

  // Use backend subtotal if provided; otherwise fallback to sum of current line items
  const lineItemsTotal = Array.isArray(lineItems) ? lineItems.reduce((s, it) => s + Number(it.total || 0), 0) : 0;
  const effectiveItemSubtotal = (() => {
    const fromApi = Number(selectedBill?.itemSubtotal ?? 0);
    return fromApi > 0 ? fromApi : lineItemsTotal;
  })();
  const billData = {
    itemSubtotal: effectiveItemSubtotal,
    timeCharge: selectedBill?.timeCharge ?? 0,
    servicesCharge: selectedBill?.servicesCharge ?? 0,
  };

  // Discounts are managed via Admin -> Discounts; no local editing here

  const computeTotals = () => {
    const baseItems = billData.itemSubtotal;
    const baseTime = billData.timeCharge;
    const baseServices = billData.servicesCharge;
    let baseSubtotal = baseItems + baseTime + baseServices;

    let discItems = 0, discTime = 0, discTotal = 0;
    const selected = discounts.filter(d => applyIds.includes(d.id));
    for (const d of selected) {
      if (d.scope === 'items') {
        discItems += (d.type === 'percent') ? (baseItems * d.value / 100) : d.value;
      } else if (d.scope === 'time') {
        discTime += (d.type === 'percent') ? (baseTime * d.value / 100) : d.value;
      } else if (d.scope === 'total') {
        discTotal += (d.type === 'percent') ? (baseSubtotal * d.value / 100) : d.value;
      }
    }
    // Cap discounts
    discItems = Math.min(discItems, baseItems);
    discTime = Math.min(discTime, baseTime);
    const subtotalAfterItemTime = Math.max(0, baseSubtotal - discItems - discTime);
    discTotal = Math.min(discTotal, subtotalAfterItemTime);

    // Apply percentage service charge from settings (in addition to any bill services)
    const svcPct = Number(taxesCfg?.serviceChargePercent || 0);
    const serviceChargeAuto = +(Math.max(0, baseSubtotal) * (svcPct/100)).toFixed(2);
    baseSubtotal += serviceChargeAuto;

    const discountedSubtotal = Math.max(0, subtotalAfterItemTime - discTotal + serviceChargeAuto);
    const rate = Number(taxesCfg?.defaultTaxRate || 0.08);
    const mode = String(taxesCfg?.taxMode || 'exclusive');
    let tax = 0;
    if (mode === 'inclusive') {
      tax = +(discountedSubtotal - discountedSubtotal / (1 + rate)).toFixed(2);
    } else {
      tax = +(discountedSubtotal * rate).toFixed(2);
    }
    const total = +(discountedSubtotal + tax + Number(tip||0)).toFixed(2);
    return { baseItems, baseTime, baseServices, serviceChargeAuto, baseSubtotal, discItems: +discItems.toFixed(2), discTime: +discTime.toFixed(2), discTotal: +discTotal.toFixed(2), discountedSubtotal: +discountedSubtotal.toFixed(2), tax, grandTotal: total };
  };
  const totals = computeTotals();
  const cashNum = +Number(cash || 0);
  const cardNum = +Number(card || 0);
  const tenderTotal = +(cashNum + cardNum).toFixed(2);
  const changeDue = Math.max(0, +(cashNum - Math.max(0, totals.grandTotal - cardNum)).toFixed(2));

  // Auto-detect payment method from tender inputs
  useEffect(() => {
    if (cash === '' && card === '') return; // don't override initial selection
    if (cashNum > 0 && cardNum > 0) {
      setPaymentMethod('split');
    } else if (cashNum > 0) {
      setPaymentMethod('cash');
    } else if (cardNum > 0) {
      setPaymentMethod('card');
    }
  }, [cash, card]);

  const getStoreConfig = () => {
    try { const raw = localStorage.getItem('pos_store_config'); if (raw) return JSON.parse(raw); } catch {}
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
  const [storeCfg, setStoreCfg] = useState(getStoreConfig());
  const saveStoreCfg = (cfg) => { try { localStorage.setItem('pos_store_config', JSON.stringify(cfg)); } catch {} setStoreCfg(cfg); };
  const [tempCfg, setTempCfg] = useState(storeCfg);
  useEffect(() => { if (storeOpen) setTempCfg(storeCfg); }, [storeOpen]);

  // Build printable receipt HTML with itemization
  const buildReceiptHtml = (opts = { includePayment: false }) => {
    const includePayment = !!opts.includePayment;
    const sym = storeCfg.currencySymbol || '$';
    let fmt;
    try {
      if (storeCfg.currencyCode && storeCfg.locale) {
        const nf = new Intl.NumberFormat(storeCfg.locale, { style: 'currency', currency: storeCfg.currencyCode, currencyDisplay: 'symbol' });
        fmt = (n) => nf.format(Number(n||0));
      } else {
        fmt = (n) => `${sym}${Number(n||0).toFixed(2)}`;
      }
    } catch { fmt = (n) => `${sym}${Number(n||0).toFixed(2)}`; }
    const billId = lastBill?.bill_id || '';
    const when = new Date();
    let whenStr;
    try { whenStr = new Intl.DateTimeFormat(storeCfg.locale || undefined, { dateStyle: 'short', timeStyle: 'short' }).format(when); }
    catch { whenStr = when.toLocaleString(); }
    const effectiveRate = (() => { try { return Math.round(((Number(taxesCfg?.defaultTaxRate||0))*100)); } catch { return 0; }})();
    const taxLabel = totals.discountedSubtotal > 0 ? `Tax (${effectiveRate}%)` : 'Tax';
    const style = `
      <style>
        @page { size: auto; margin: 0; }
        html, body { margin: 0; padding: 0; background: #fff; }
        .receipt { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 12px; line-height: 1.25; color: #000; }
        .receipt.receipt-58 { width: 58mm; }
        .receipt.receipt-80 { width: 80mm; }
        .divider { border-top: 1px dashed #000; margin: 6px 0; }
        .row { display: flex; justify-content: space-between; }
        .hdr { text-align: center; margin-bottom: 6px; }
        .muted { color: #000; opacity: 0.65; }
        .items { margin-bottom: 6px; }
        .items .head { font-weight: 700; }
        .items .line { display: grid; grid-template-columns: 1fr auto auto; gap: 6px; }
        .right { text-align: right; }
      </style>`;
    const wrapStart = `<div class="receipt ${receiptSize==='58mm' ? 'receipt-58' : 'receipt-80'}">`;
    const wrapEnd = `</div>`;

    const header = `
      <div class="hdr">
        <div style="font-weight:800; font-size:14px;">${storeCfg.name}</div>
        <div class="muted" style="font-size:11px;">${storeCfg.address || ''}</div>
        ${storeCfg.phone ? `<div class="muted" style="font-size:11px;">${storeCfg.phone}</div>` : ''}
        ${storeCfg.taxId ? `<div class="muted" style="font-size:11px;">Tax ID: ${storeCfg.taxId}</div>` : ''}
        <div class="muted" style="font-size:11px;">${includePayment ? 'Official Receipt' : 'Official Receipt (Pre-Bill)'} • Table ${selectedBill?.id || ''}</div>
        <div class="muted" style="font-size:11px;">${whenStr} • Cashier: ${cashierName}${billId ? ` • ID: ${billId}` : ''}</div>
      </div>`;

    const lines = Array.isArray(lineItems) ? lineItems : [];
    const itemsHtml = lines.length ? `
      <div class="items">
        <div class="head">Items</div>
        ${lines.map((it)=>{
          const qty = Number(it.qty || it.quantity || 1);
          const total = Number(it.total || it.item_total || 0);
          const unit = qty>0 ? total/qty : total;
          const name = String(it.name || it.id || 'Item');
          const maxLen = receiptSize==='58mm' ? 20 : 24;
          const short = name.length>maxLen? name.slice(0,maxLen)+'…' : name;
          return `<div class="line"><div>${qty} x ${short}</div><div>@ ${fmt(unit)}</div><div class="right">${fmt(total)}</div></div>`;
        }).join('')}
      </div>` : '';

    const summary = `
      <div class="divider"></div>
      <div class="row"><span>Items</span><span>${fmt(totals.baseItems)}</span></div>
      <div class="row"><span>Billiard Time</span><span>${fmt(totals.baseTime)}</span></div>
      ${totals.baseServices>0 ? `<div class="row"><span>Services</span><span>${fmt(totals.baseServices)}</span></div>` : ''}
      ${totals.serviceChargeAuto>0 ? `<div class="row"><span>Service Charge</span><span>${fmt(totals.serviceChargeAuto)}</span></div>` : ''}
      ${totals.discItems>0 ? `<div class="row"><span>− Discount (Items)</span><span>−${fmt(totals.discItems)}</span></div>` : ''}
      ${totals.discTime>0 ? `<div class="row"><span>− Discount (Time)</span><span>−${fmt(totals.discTime)}</span></div>` : ''}
      ${totals.discTotal>0 ? `<div class="row"><span>− Discount (Total)</span><span>−${fmt(totals.discTotal)}</span></div>` : ''}
      <div class="row" style="font-weight:700; border-top:1px solid #000; padding-top:4px;"><span>Subtotal</span><span>${fmt(totals.discountedSubtotal)}</span></div>
      <div class="row"><span>${taxLabel}</span><span>${fmt(totals.tax)}</span></div>
      <div class="row"><span>Tip</span><span>${fmt(Number(tip||0))}</span></div>
      <div class="row" style="font-weight:800; font-size:14px; border-top:1px solid #000; padding-top:4px;"><span>Total</span><span>${fmt(totals.grandTotal)}</span></div>`;

    const pay = includePayment ? `
      <div class="divider"></div>
      <div class="row"><span>Payment</span><span>${(cashNum>0 && cardNum>0)?'SPLIT':paymentMethod.toUpperCase()}</span></div>
      <div class="row"><span>Tendered</span><span>${fmt(tenderTotal)} (Cash ${fmt(cashNum)} / Card ${fmt(cardNum)})</span></div>
      <div class="row"><span>Change Due</span><span>${fmt(changeDue)}</span></div>
      ${memberId ? `<div class="row"><span>Member</span><span>${String(memberId)}</span></div>` : ''}` : '';

    // Optional QR for bill id (only on final receipt)
    const showQr = includePayment && (printingCfg?.showQrOnFinal !== false);
    const qr = showQr && billId ? `<div class="hdr" style="margin-top:6px;"><img alt="qr" style="margin:0 auto; width:120px; height:120px;" src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(billId)}"/></div>` : '';

    const footer = `<div class="hdr muted" style="margin-top:8px;">${storeCfg.footer || ''}</div>`;

    const html = `<html><head><title>${includePayment?'Receipt':'Pre-Bill'}</title>${style}</head><body>${wrapStart}${header}${itemsHtml}${summary}${pay}${qr}${footer}${wrapEnd}</body></html>`;
    return html;
  };

  const handleProcessPayment = async () => {
    if (!selectedBill) return;
    if (tenderTotal + 1e-9 < totals.grandTotal) {
      alert(`Insufficient tendered amount. Total is $${totals.grandTotal.toFixed(2)}, tendered is $${tenderTotal.toFixed(2)}.`);
      return;
    }
    try {
      // Compute total discount applied
      const discount_total = +(totals.discItems + totals.discTime + totals.discTotal).toFixed(2);
      const resp = await api.payByTable({
        table_id: selectedBill.id,
        payment_method: (cashNum>0 && cardNum>0) ? 'split' : paymentMethod,
        tip: +Number(tip || 0).toFixed(2),
        discount_total,
        tender_cash: cashNum,
        tender_card: cardNum,
        member_id: memberId || null,
      });
      setLastBill(resp);
      setPaid(true);
      // Refresh pending list
      try {
        const res = await api.getPendingBills();
        const bills = Array.isArray(res?.bills) ? res.bills : [];
        const mapped = bills.map(b => ({
          id: b.table_id,
          customer: `Table ${b.table_id}`,
          createdAt: b.createdAt ? new Date(b.createdAt).getTime() : Date.now(),
          itemSubtotal: Number(b.itemSubtotal || 0),
          timeCharge: Number(b.timeCharge || 0),
          servicesCharge: Number(b.servicesCharge || 0),
        }));
        setPendingBills(mapped);
      } catch {}
      alert(`Payment processed${resp?.bill_id ? ` (Bill: ${resp.bill_id})` : ''}`);
    } catch (e) {
      console.error(e);
      alert('Failed to process payment');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent mb-8">💳 Cashier • Pending Bills</h1>
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 h-fit lg:sticky lg:top-6 self-start">
          <div className="text-slate-100 font-semibold mb-3">Pending Bills</div>
          {pendingBills.length === 0 ? (
            <div className="text-slate-400 text-sm">No pending bills.</div>
          ) : (
            <div className="space-y-2">
              {pendingBills.map(b => (
                <button
                  key={b.id}
                  onClick={() => { setSelectedId(b.id); setPaid(false); }}
                  className={`w-full text-left p-3 rounded-lg border ${selectedId===b.id ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-900/60 text-slate-200 hover:bg-slate-800 border-slate-700'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">Table {b.id}</div>
                    <div className="text-xs opacity-80">{Math.round((Date.now()-b.createdAt)/60000)} min</div>
                  </div>
                  <div className="text-xs opacity-80">{b.customer}</div>
                  <div className="text-emerald-300 font-bold mt-1">${(b.itemSubtotal + b.timeCharge + (b.servicesCharge||0)).toFixed(2)}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {!selectedBill ? (
          <div className="lg:col-span-3 bg-slate-900/40 border border-slate-800 rounded-xl p-10 text-center text-slate-300">
            <div className="text-5xl mb-3">🧾</div>
            <div className="text-xl font-semibold">Select a pending bill to process</div>
            <div className="text-sm text-slate-400 mt-2">Choose a bill from the left panel to view receipt, apply discounts and accept payment.</div>
          </div>
        ) : (
          <>
            <div className="lg:col-span-2 bg-gray-900 rounded-xl shadow-lg p-6 mb-6 text-gray-100 border border-gray-800">
              <h2 className="text-2xl font-bold mb-4">Bill Summary</h2>
              <div id="payment-prebill" className="bg-white border rounded-lg p-5 text-gray-800">
                <div className="text-center mb-4">
                  <div className="text-xl font-extrabold">{storeCfg.name}</div>
                  <div className="text-xs text-gray-500">{storeCfg.address}<br/>Official Receipt (Pre-Bill)</div>
                </div>
                {lineItems.length > 0 && (
                  <div className="mb-3">
                    <div className="text-sm font-semibold mb-1">Items</div>
                    <div className="text-xs font-mono">
                      {lineItems.map((it, idx) => {
                        const qty = Number(it.qty || it.quantity || 1);
                        const total = Number(it.total || it.item_total || 0);
                        const unit = qty > 0 ? total / qty : total;
                        const name = String(it.name || it.id || 'Item');
                        const nameShort = name.length > 20 ? name.slice(0,20)+'…' : name;
                        return (
                          <div key={idx} className="flex justify-between">
                            <span>{qty} x {nameShort} @ ${unit.toFixed(2)}</span>
                            <span>${total.toFixed(2)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="text-sm mb-3 flex justify-between">
                  <div>
                    <div><span className="font-semibold">Table:</span> {selectedBill?.id || '—'}</div>
                    <div><span className="font-semibold">Customer:</span> —</div>
                    <div><span className="font-semibold">Bill:</span> {lastBill?.bill_id || '—'}</div>
                  </div>
                  <div className="text-right">
                    <div><span className="font-semibold">Date:</span> {(() => { try { return new Intl.DateTimeFormat(storeCfg.locale || undefined, { dateStyle: 'short' }).format(new Date()); } catch { return new Date().toLocaleDateString(); } })()}</div>
                    <div><span className="font-semibold">Time:</span> {(() => { try { return new Intl.DateTimeFormat(storeCfg.locale || undefined, { timeStyle: 'short' }).format(new Date()); } catch { return new Date().toLocaleTimeString(); } })()}</div>
                  </div>
                </div>
                <hr className="my-2"/>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>Items:</span><span>{(() => { try { const nf = new Intl.NumberFormat(storeCfg.locale || undefined, { style: 'currency', currency: storeCfg.currencyCode || 'USD' }); return nf.format(totals.baseItems); } catch { return `$${totals.baseItems.toFixed(2)}`; } })()}</span></div>
                  <div className="flex justify-between"><span>Billiard Time:</span><span>{(() => { try { const nf = new Intl.NumberFormat(storeCfg.locale || undefined, { style: 'currency', currency: storeCfg.currencyCode || 'USD' }); return nf.format(totals.baseTime); } catch { return `$${totals.baseTime.toFixed(2)}`; } })()}</span></div>
                  {totals.baseServices > 0 && (
                    <div className="flex justify-between"><span>Services:</span><span>{(() => { try { const nf = new Intl.NumberFormat(storeCfg.locale || undefined, { style: 'currency', currency: storeCfg.currencyCode || 'USD' }); return nf.format(totals.baseServices); } catch { return `$${totals.baseServices.toFixed(2)}`; } })()}</span></div>
                  )}
                  {totals.discItems > 0 && (
                    <div className="flex justify-between text-red-600"><span>− Discount (Items)</span><span>{(() => { try { const nf = new Intl.NumberFormat(storeCfg.locale || undefined, { style: 'currency', currency: storeCfg.currencyCode || 'USD' }); return '−' + nf.format(totals.discItems); } catch { return `−$${totals.discItems.toFixed(2)}`; } })()}</span></div>
                  )}
                  {totals.discTime > 0 && (
                    <div className="flex justify-between text-red-600"><span>− Discount (Time)</span><span>{(() => { try { const nf = new Intl.NumberFormat(storeCfg.locale || undefined, { style: 'currency', currency: storeCfg.currencyCode || 'USD' }); return '−' + nf.format(totals.discTime); } catch { return `−$${totals.discTime.toFixed(2)}`; } })()}</span></div>
                  )}
                  {totals.discTotal > 0 && (
                    <div className="flex justify-between text-red-600"><span>− Discount (Total)</span><span>{(() => { try { const nf = new Intl.NumberFormat(storeCfg.locale || undefined, { style: 'currency', currency: storeCfg.currencyCode || 'USD' }); return '−' + nf.format(totals.discTotal); } catch { return `−$${totals.discTotal.toFixed(2)}`; } })()}</span></div>
                  )}
                  <div className="flex justify-between font-semibold border-t pt-2"><span>Subtotal:</span><span>{(() => { try { const nf = new Intl.NumberFormat(storeCfg.locale || undefined, { style: 'currency', currency: storeCfg.currencyCode || 'USD' }); return nf.format(totals.discountedSubtotal); } catch { return `$${totals.discountedSubtotal.toFixed(2)}`; } })()}</span></div>
                  <div className="flex justify-between"><span>{`Tax (${Math.round((totals.tax / Math.max(0.01, totals.discountedSubtotal)) * 100)}%)`}:</span><span>{(() => { try { const nf = new Intl.NumberFormat(storeCfg.locale || undefined, { style: 'currency', currency: storeCfg.currencyCode || 'USD' }); return nf.format(totals.tax); } catch { return `$${totals.tax.toFixed(2)}`; } })()}</span></div>
                  <div className="flex justify-between"><span>Tip:</span><span>{(() => { try { const nf = new Intl.NumberFormat(storeCfg.locale || undefined, { style: 'currency', currency: storeCfg.currencyCode || 'USD' }); return nf.format(Number(tip || 0)); } catch { return `$${Number(tip || 0).toFixed(2)}`; } })()}</span></div>
                  <div className="flex justify-between font-bold text-lg border-t pt-2"><span>Total:</span><span>{(() => { try { const nf = new Intl.NumberFormat(storeCfg.locale || undefined, { style: 'currency', currency: storeCfg.currencyCode || 'USD' }); return nf.format(totals.grandTotal); } catch { return `$${totals.grandTotal.toFixed(2)}`; } })()}</span></div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 bg-gray-900 rounded-xl shadow-lg p-6 mb-6 text-gray-100 border border-gray-800">
              <h3 className="text-lg font-bold mb-4">Add Tip</h3>
              <div className="mb-4">
                <label className="block text-sm font-semibold mb-1">Cashier</label>
                <input
                  value={cashierName}
                  onChange={(e)=>{ setCashierName(e.target.value); try{ localStorage.setItem('pos_cashier_name', e.target.value); }catch{} }}
                  placeholder="Enter cashier name"
                  className="w-full border border-gray-700 bg-gray-800 text-gray-100 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                />
              </div>
              <div className="grid grid-cols-4 gap-2">
                {(tipsCfg?.suggestedPercents || [15,18,20,25]).map(percent => {
                  const tipBase = tipsCfg?.tipOnPreTax ? totals.discountedSubtotal : (totals.discountedSubtotal + totals.tax);
                  const tipAmount = tipBase * (percent / 100);
                  return (
                    <button
                      key={percent}
                      onClick={() => setTip(tipAmount)}
                      className="p-2 border border-gray-700 bg-gray-800 text-gray-100 rounded-lg hover:bg-gray-700"
                    >
                      {percent}%<br/>${tipAmount.toFixed(2)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-slate-900 rounded-xl border border-slate-700 shadow-lg p-6">
              <h3 className="text-lg font-bold text-slate-100 mb-4">Actions</h3>
              <div className="grid grid-cols-1 gap-3 mb-6">
                <div className="flex items-center justify-between gap-3 bg-slate-800 text-slate-200 rounded-lg p-3">
                  <div className="text-sm font-semibold">Receipt Width</div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-sm"><input type="radio" name="rsize" checked={receiptSize==='58mm'} onChange={()=>setReceiptSize('58mm')} /> 58mm</label>
                    <label className="flex items-center gap-1 text-sm"><input type="radio" name="rsize" checked={receiptSize==='80mm'} onChange={()=>setReceiptSize('80mm')} /> 80mm</label>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 bg-slate-800 rounded-lg p-3 text-slate-200">
                  <div className="col-span-2">
                    <label className="block text-sm mb-1">Member ID (optional)</label>
                    <input value={memberId} onChange={e=>setMemberId(e.target.value)} type="text" className="w-full bg-slate-900 text-white rounded px-3 py-2 border border-slate-700" placeholder="Scan or enter member ID" />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Cash</label>
                    <input value={cash} onChange={e=>setCash(e.target.value)} type="number" step="0.01" className="w-full bg-slate-900 text-white rounded px-3 py-2 border border-slate-700" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Card</label>
                    <input value={card} onChange={e=>setCard(e.target.value)} type="number" step="0.01" className="w-full bg-slate-900 text-white rounded px-3 py-2 border border-slate-700" placeholder="0.00" />
                  </div>
                  <div className="col-span-2 text-xs text-slate-400">Tendered: ${tenderTotal.toFixed(2)} • Change Due: ${changeDue.toFixed(2)}</div>
                </div>
                <button
                  onClick={() => setSplitOpen(true)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg"
                >
                  ✂️ Split Bill
                </button>
                <button
                  onClick={() => setManageOpen(true)}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg"
                >
                  🏷️ Manage Discounts
                </button>
                <button
                  onClick={() => setStoreOpen(true)}
                  className="w-full bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg"
                >
                  🏪 Store Receipt Settings
                </button>
                <button
                  onClick={() => {
                    const html = buildReceiptHtml({ includePayment: false });
                    const win = window.open('', '_blank');
                    if (win) { win.document.write(html); win.document.close(); win.focus(); win.print(); win.close(); }
                  }}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-lg"
                >
                  🖨️ Print Pre-Bill
                </button>
              </div>
              <h3 className="text-sm font-semibold text-slate-300 mb-2">Process Payment</h3>
              <div className="grid grid-cols-2 gap-4 mb-6">
                {[
                  { id: 'cash', name: 'Cash', emoji: '💵' },
                  { id: 'card', name: 'Card', emoji: '💳' },
                ].map(method => (
                  <button
                    key={method.id}
                    onClick={() => setPaymentMethod(method.id)}
                    className={`p-4 rounded-lg border text-center ${
                      paymentMethod === method.id
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-800 text-gray-100 border border-gray-700 hover:bg-gray-700' 
                    }`}
                  >
                    <div className="text-2xl mb-2">{method.emoji}</div>
                    <div>{method.name}</div>
                  </button>
                ))}
              </div>
              <div className="mb-4 bg-slate-800 rounded-lg p-3 text-slate-200">
                <div className="text-sm font-semibold mb-2">Applied Discounts</div>
                {discountsLoading && <div className="text-xs text-slate-400">Loading discounts…</div>}
                {!discountsLoading && discountsError && <div className="text-xs text-red-400">{discountsError}</div>}
                {!discountsLoading && !discountsError && discounts.length === 0 && (
                  <div className="text-xs text-slate-400">No active discounts. Manage in Admin → Discounts.</div>
                )}
                {!discountsLoading && !discountsError && discounts.length > 0 && (
                  <div className="space-y-2">
                    {discounts.map(d => (
                      <label key={d.id} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <input type="checkbox" checked={applyIds.includes(d.id)} onChange={(e)=>{
                            setApplyIds(prev => e.target.checked ? [...prev, d.id] : prev.filter(id => id!==d.id));
                          }} />
                          <span>{d.name}</span>
                        </div>
                        <span className="text-xs text-slate-400">{d.scope} • {d.type === 'percent' ? `${d.value}%` : `$${d.value}`}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <button disabled={!selectedBill || (tenderTotal + 1e-9 < totals.grandTotal)} onClick={handleProcessPayment} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-3 rounded-lg text-lg font-bold">
                ✅ Process Payment
              </button>
              {paid && (
                <button
                  onClick={() => {
                    const html = buildReceiptHtml({ includePayment: true });
                    const win = window.open('', '_blank');
                    if (win) { win.document.write(html); win.document.close(); win.focus(); win.print(); win.close(); }
                  }}
                  className="mt-3 w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg text-lg font-bold"
                >
                  🧾 Print Final Receipt
                </button>
              )}
              <button
                disabled={!paid || !selectedBill}
                onClick={async () => {
                  if (!selectedBill) return;
                  // Backend already freed table on pay; just update UI
                  setPendingBills(prev => prev.filter(b => b.id !== selectedBill.id));
                  setSelectedId(null);
                  setPaid(false);
                }}
                className="mt-3 w-full bg-gradient-to-r from-amber-500 to-orange-600 disabled:opacity-50 text-white py-3 rounded-lg text-lg font-bold"
              >
                🟢 Close Bill & Free Table
              </button>
            </div>
          </>
        )}
      </div>

      {/* Manage Discounts Modal (placeholder to preserve behavior; full editor remains in main file if needed) */}
      {manageOpen && (
        <div className="fixed inset-0 z-[120]">
          <div className="absolute inset-0 bg-black/60" onClick={() => setManageOpen(false)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
                <div className="text-white font-bold text-xl">Manage Discounts</div>
                <button className="text-slate-300 hover:text-white text-xl" onClick={() => setManageOpen(false)}>✕</button>
              </div>
              <div className="p-6 space-y-6">
                <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4">
                  <div className="text-slate-200 font-semibold mb-3">Existing Discounts</div>
                  {discounts.length===0 ? (
                    <div className="text-slate-400 text-sm">No discounts yet.</div>
                  ) : (
                    <div className="space-y-2">
                      {discounts.map(d => (
                        <div key={d.id} className="flex items-center justify-between bg-slate-800 rounded-lg p-3 border border-slate-700">
                          <div>
                            <div className="text-slate-100 font-medium">{d.name}</div>
                            <div className="text-slate-400 text-xs">{d.scope} • {d.type === 'percent' ? `${d.value}%` : `$${d.value}`}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Split Tender Modal */}
      {splitOpen && (
        <div className="fixed inset-0 z-[125]">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSplitOpen(false)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-xl bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
                <div className="text-white font-bold text-xl">Split Payment</div>
                <button className="text-slate-300 hover:text-white text-xl" onClick={() => setSplitOpen(false)}>✕</button>
              </div>
              <div className="p-6 space-y-6 text-slate-200">
                <div className="text-sm">Allocate total between Cash and Card using the slider or quick buttons.</div>
                <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span>Total</span>
                    <span className="font-semibold">${totals.grandTotal.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={splitPct}
                    onChange={(e)=>setSplitPct(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex items-center justify-between text-xs text-slate-400 mt-1">
                    <span>0% Cash</span>
                    <span>{splitPct}%</span>
                    <span>100% Cash</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    {[25,50,75].map(p => (
                      <button key={p} onClick={()=>setSplitPct(p)} className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700">{p}%</button>
                    ))}
                  </div>
                </div>
                {(() => {
                  const total = totals.grandTotal;
                  const cashPart = +(total * (splitPct/100)).toFixed(2);
                  const cardPart = +(total - cashPart).toFixed(2);
                  return (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4">
                        <div className="text-sm mb-1">Cash</div>
                        <div className="text-2xl font-bold text-emerald-300">${cashPart.toFixed(2)}</div>
                      </div>
                      <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4">
                        <div className="text-sm mb-1">Card</div>
                        <div className="text-2xl font-bold text-indigo-300">${cardPart.toFixed(2)}</div>
                      </div>
                    </div>
                  );
                })()}
                <div className="flex justify-end gap-3">
                  <button className="px-4 py-2 rounded bg-slate-700 text-white" onClick={()=>setSplitOpen(false)}>Cancel</button>
                  <button
                    className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold"
                    onClick={() => {
                      const total = totals.grandTotal;
                      const cashPart = +(total * (splitPct/100)).toFixed(2);
                      const cardPart = +(total - cashPart).toFixed(2);
                      setCash(cashPart.toFixed(2));
                      setCard(cardPart.toFixed(2));
                      setSplitOpen(false);
                    }}
                  >Apply Split</button>
                </div>
                <div className="flex justify-between pt-2 text-xs text-slate-400">
                  <button
                    className="underline hover:text-slate-200"
                    onClick={() => {
                      // Exact cash, no card
                      setCash(totals.grandTotal.toFixed(2));
                      setCard('0.00');
                      setSplitOpen(false);
                    }}
                  >Use Exact Cash</button>
                  <button
                    className="underline hover:text-slate-200"
                    onClick={() => {
                      // All card
                      setCash('0.00');
                      setCard(totals.grandTotal.toFixed(2));
                      setSplitOpen(false);
                    }}
                  >All Card</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Store Receipt Settings Modal */}
      {storeOpen && (
        <div className="fixed inset-0 z-[130]">
          <div className="absolute inset-0 bg-black/60" onClick={() => setStoreOpen(false)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
                <div className="text-white font-bold text-xl">Store Receipt Settings</div>
                <button className="text-slate-300 hover:text-white text-xl" onClick={() => setStoreOpen(false)}>✕</button>
              </div>
              <div className="p-6 space-y-4 text-slate-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm mb-1">Store Name</label>
                    <input className="w-full bg-slate-900 text-white rounded px-3 py-2 border border-slate-700" value={tempCfg.name||''} onChange={e=>setTempCfg({...tempCfg, name:e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Phone</label>
                    <input className="w-full bg-slate-900 text-white rounded px-3 py-2 border border-slate-700" value={tempCfg.phone||''} onChange={e=>setTempCfg({...tempCfg, phone:e.target.value})} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm mb-1">Address</label>
                    <input className="w-full bg-slate-900 text-white rounded px-3 py-2 border border-slate-700" value={tempCfg.address||''} onChange={e=>setTempCfg({...tempCfg, address:e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Tax ID</label>
                    <input className="w-full bg-slate-900 text-white rounded px-3 py-2 border border-slate-700" value={tempCfg.taxId||''} onChange={e=>setTempCfg({...tempCfg, taxId:e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Currency Symbol</label>
                    <input className="w-full bg-slate-900 text-white rounded px-3 py-2 border border-slate-700" value={tempCfg.currencySymbol||''} onChange={e=>setTempCfg({...tempCfg, currencySymbol:e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Locale</label>
                    <input placeholder="e.g. en-US, es-MX" className="w-full bg-slate-900 text-white rounded px-3 py-2 border border-slate-700" value={tempCfg.locale||''} onChange={e=>setTempCfg({...tempCfg, locale:e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Currency Code</label>
                    <input placeholder="e.g. USD, MXN" className="w-full bg-slate-900 text-white rounded px-3 py-2 border border-slate-700" value={tempCfg.currencyCode||''} onChange={e=>setTempCfg({...tempCfg, currencyCode:e.target.value})} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm mb-1">Footer</label>
                    <textarea rows={3} className="w-full bg-slate-900 text-white rounded px-3 py-2 border border-slate-700" value={tempCfg.footer||''} onChange={e=>setTempCfg({...tempCfg, footer:e.target.value})} />
                  </div>
                </div>
                <div className="text-xs text-slate-400">
                  Preview: {(() => { try { const nf=new Intl.NumberFormat(tempCfg.locale||'en-US',{style:'currency',currency:tempCfg.currencyCode||'USD'}); return `${new Intl.DateTimeFormat(tempCfg.locale||'en-US',{dateStyle:'short',timeStyle:'short'}).format(new Date())} • ${nf.format(1234.56)}`; } catch { return `${new Date().toLocaleString()} • ${tempCfg.currencySymbol||'$'}1234.56`; } })()}
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button className="px-4 py-2 rounded bg-slate-700 text-white" onClick={()=>setStoreOpen(false)}>Cancel</button>
                  <button
                    className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                    onClick={()=>{
                      let next = { ...storeCfg, ...tempCfg };
                      // Basic validation/fallbacks
                      if (!next.locale) next.locale = 'en-US';
                      if (!next.currencyCode) next.currencyCode = 'USD';
                      saveStoreCfg(next);
                      setStoreOpen(false);
                    }}
                  >Save</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentPage;
