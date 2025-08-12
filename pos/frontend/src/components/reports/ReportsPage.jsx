import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../../contexts/SettingsContext';
import api from '../../services/api';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  TimeScale,
  Filler
} from 'chart.js';
import { Bar, Line, Pie } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  TimeScale,
  Filler
);

function toInputDateTimeLocal(d) {
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const MM = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  return `${yyyy}-${MM}-${dd}T${hh}:${mm}`;
}

function fromInputDateTimeLocal(s) {
  // Treat as local time
  const dt = new Date(s);
  return dt;
}

function asCsvRow(arr) {
  return arr
    .map((v) => {
      const s = String(v ?? '');
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    })
    .join(',');
}

function downloadCsv(name, rows) {
  const csv = rows.map(asCsvRow).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', name);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const ReportsPage = () => {
  const navigate = useNavigate();
  const { hasPermission, isPinRequired, verifyPin } = useSettings();
  const [accessDenied, setAccessDenied] = useState(false);

  // Check if user has permission to view reports
  const checkAccess = useCallback(async () => {
    try {
      // Check if PIN is required for reports
      if (isPinRequired('view_reports')) {
        const pin = prompt('Enter manager PIN to access reports:');
        if (!pin) {
          setAccessDenied(true);
          return false;
        }
        const { ok } = await verifyPin(pin);
        if (!ok) {
          alert('Invalid PIN');
          setAccessDenied(true);
          return false;
        }
      }
      
      // Check user role permissions
      if (!hasPermission('view_reports')) {
        setAccessDenied(true);
        return false;
      }
      
      return true;
    } catch (err) {
      console.error('Access check failed:', err);
      setAccessDenied(true);
      return false;
    }
  }, [hasPermission, isPinRequired, verifyPin]);
  const now = useMemo(() => new Date(), []);
  const startOfToday = useMemo(() => {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [now]);

  const [from, setFrom] = useState(toInputDateTimeLocal(startOfToday));
  const [to, setTo] = useState(toInputDateTimeLocal(now));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [printing, setPrinting] = useState(false);
  const [filters, setFilters] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('pos_reports_filters') || '{}');
      return {
        station: saved.station || 'all', // all|kitchen|bar
        methods: Array.isArray(saved.methods) ? saved.methods : [], // e.g. ['cash','card']
      };
    } catch {
      return { station: 'all', methods: [] };
    }
  });

  useEffect(() => {
    localStorage.setItem('pos_reports_filters', JSON.stringify(filters));
  }, [filters]);

  // Date preset helpers
  const applyPreset = useCallback((preset) => {
    const end = new Date();
    let start = new Date(end);
    if (preset === 'today') {
      start.setHours(0,0,0,0);
    } else if (preset === 'yesterday') {
      const y = new Date(end);
      y.setDate(y.getDate() - 1);
      y.setHours(0,0,0,0);
      start = y;
      end.setDate(end.getDate() - 1);
      end.setHours(23,59,59,999);
    } else if (preset === '7d') {
      start = new Date(end.getTime() - 7*24*60*60*1000);
    } else if (preset === '30d') {
      start = new Date(end.getTime() - 30*24*60*60*1000);
    }
    setFrom(toInputDateTimeLocal(start));
    setTo(toInputDateTimeLocal(end));
  }, []);

  const load = async () => {
    const hasAccess = await checkAccess();
    if (!hasAccess) return;
    try {
      setLoading(true);
      setError('');
      
      // Get timestamps in milliseconds
      const fromTs = fromInputDateTimeLocal(from).getTime();
      const toTs = fromInputDateTimeLocal(to).getTime();
      
      // Fetch report data
      const report = await api.getReportShift({ from: fromTs, to: toTs });
      
      // Transform data to match frontend expectations
      const transformedData = {
        ...report,
        // Ensure all required arrays exist
        payments_by_method: report.payments_by_method || [],
        station_throughput: report.station_throughput || [],
        buckets: report.buckets || [],
        payments_by_method_hourly: report.payments_by_method_hourly || []
      };
      
      setData(transformedData);
    } catch (e) {
      console.error('Failed to load report', e);
      setError(e?.response?.data?.error || e?.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Apply filters client-side to relevant datasets
  const filtered = useMemo(() => {
    if (!data) return null;
    const methodsSet = new Set((filters.methods || []).map(m => (m || '').toLowerCase()));
    const filterByMethod = (method) => {
      if (!methodsSet.size) return true; // no filter → include all
      return methodsSet.has(String(method || '').toLowerCase());
    };

    // payments_by_method
    const payments_by_method = (data.payments_by_method || []).filter(p => filterByMethod(p.method));

    // payments_by_method_hourly
    const payments_by_method_hourly = (data.payments_by_method_hourly || []).filter(p => filterByMethod(p.method));

    // station_throughput
    const station_throughput = (data.station_throughput || []).filter(s => {
      if (filters.station === 'all') return true;
      return String(s.station || '').toLowerCase() === filters.station;
    });

    return {
      ...data,
      payments_by_method,
      payments_by_method_hourly,
      station_throughput,
    };
  }, [data, filters]);

  const onPrint = useCallback(async () => {
    const hasAccess = await checkAccess();
    if (!hasAccess) return;
    try {
      setPrinting(true);
      // Give React a tick to apply print classes
      setTimeout(() => {
        window.print();
        // Revert the print mode shortly after
        setTimeout(() => setPrinting(false), 300);
      }, 50);
    } catch (e) {
      console.error('Print failed', e);
      setPrinting(false);
    }
  }, [checkAccess]);

  const exportCsv = async () => {
    const hasAccess = await checkAccess();
    if (!hasAccess) return;
    if (!filtered) return;
    const rows = [
      ['From', filtered.window?.from || ''],
      ['To', filtered.window?.to || ''],
      ['Filters', `station=${filters.station}; methods=${(filters.methods||[]).join('|') || 'all'}`],
      [],
      ['Metric', 'Value'],
      ['Orders Count', filtered.orders_count],
      ['Orders Total', filtered.orders_total],
      ['Bills Count', filtered.bills_count],
      ['Bills Total', filtered.bills_total],
      ['Void Count', filtered.void_count],
      ['Comp Count', filtered.comp_count],
    ];
    // Profitability
    rows.push(['COGS Total', filtered.cogs_total || 0]);
    rows.push(['Gross Margin', filtered.gross_margin || 0]);
    rows.push(['Gross Margin %', filtered.gross_margin_pct != null ? `${filtered.gross_margin_pct}%` : '']);
    // Payment methods
    if (Array.isArray(filtered.payments_by_method) && filtered.payments_by_method.length) {
      rows.push([], ['Payments by Method'], ['method','count','sum']);
      filtered.payments_by_method.forEach(p => rows.push([p.method, p.cnt, p.sum]));
    }
    // Station throughput
    if (Array.isArray(filtered.station_throughput) && filtered.station_throughput.length) {
      rows.push([], ['Station Throughput'], ['station','orders','items_count','items_total']);
      filtered.station_throughput.forEach(s => rows.push([s.station, s.orders, s.items_count, s.items_total]));
    }
    // Buckets
    if (Array.isArray(filtered.buckets) && filtered.buckets.length) {
      rows.push([], ['Hourly Buckets'], ['bucket','orders_total','bills_total']);
      filtered.buckets.forEach(b => rows.push([b.bucket, b.orders_total, b.bills_total]));
    }
    // Hourly payment by method
    if (Array.isArray(filtered.payments_by_method_hourly) && filtered.payments_by_method_hourly.length) {
      rows.push([], ['Hourly Payment By Method'], ['bucket','method','count','sum']);
      filtered.payments_by_method_hourly.forEach(p => rows.push([p.bucket, p.method, p.cnt, p.sum]));
    }
    // Top Items
    if (Array.isArray(filtered.top_items) && filtered.top_items.length) {
      rows.push([], ['Top Items'], ['item','qty','total']);
      filtered.top_items.forEach(t => rows.push([t.item, t.qty, t.total]));
    }
    // Top Categories
    if (Array.isArray(filtered.top_categories) && filtered.top_categories.length) {
      rows.push([], ['Top Categories'], ['category','qty','total']);
      filtered.top_categories.forEach(t => rows.push([t.category, t.qty, t.total]));
    }
    // Anomalies
    if (Array.isArray(filtered.anomalies) && filtered.anomalies.length) {
      rows.push([], ['Anomalies (bills_total z>=2)'], ['bucket','bills_total','z']);
      filtered.anomalies.forEach(a => rows.push([a.bucket, a.bills_total, a.z]));
    }
    downloadCsv('shift_report.csv', rows);
  };

  // Only block UI on first load (no prior data)
  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-300">Loading report data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-900/50 border-l-4 border-red-500 text-red-100 p-4 mb-4 rounded">
          <p className="font-bold">Error Loading Report</p>
          <p className="mt-1 text-sm font-mono">{error}</p>
        </div>
        <button
          onClick={load}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="p-6">
        <div className="bg-red-900/50 border-l-4 border-red-500 text-red-100 p-4 mb-4 rounded">
          <p className="font-bold">Access Denied</p>
          <p>You don't have permission to view reports.</p>
        </div>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  // Chart options with theme colors
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#e5e7eb',
          font: {
            size: 12
          }
        }
      },
      tooltip: {
        backgroundColor: '#1f2937',
        titleColor: '#f3f4f6',
        bodyColor: '#e5e7eb',
        borderColor: '#4b5563',
        borderWidth: 1,
        padding: 12,
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
      }
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(75, 85, 99, 0.5)'
        },
        ticks: {
          color: '#9ca3af'
        }
      },
      y: {
        grid: {
          color: 'rgba(75, 85, 99, 0.5)'
        },
        ticks: {
          color: '#9ca3af',
          callback: (value) => formatCurrency(value).replace('$', '')
        }
      }
    }
  };

  // Prepare data for charts
  const paymentMethodsData = {
    labels: filtered?.payments_by_method?.map(m => m.method.charAt(0).toUpperCase() + m.method.slice(1)) || [],
    datasets: [
      {
        label: 'Total Sales',
        data: filtered?.payments_by_method?.map(m => m.sum) || [],
        backgroundColor: [
          'rgba(59, 130, 246, 0.7)',
          'rgba(16, 185, 129, 0.7)',
          'rgba(245, 158, 11, 0.7)',
          'rgba(139, 92, 246, 0.7)'
        ],
        borderColor: [
          'rgba(59, 130, 246, 1)',
          'rgba(16, 185, 129, 1)',
          'rgba(245, 158, 11, 1)',
          'rgba(139, 92, 246, 1)'
        ],
        borderWidth: 1,
      },
    ],
  };

  const hourlySalesData = {
    labels: filtered?.buckets?.map(b => {
      const date = new Date(b.bucket);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }) || [],
    datasets: [
      {
        label: 'Orders',
        data: filtered?.buckets?.map(b => b.orders_total) || [],
        borderColor: 'rgba(59, 130, 246, 0.8)',
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        tension: 0.3,
        fill: true
      },
      {
        label: 'Bills',
        data: filtered?.buckets?.map(b => b.bills_total) || [],
        borderColor: 'rgba(16, 185, 129, 0.8)',
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        tension: 0.3,
        fill: true
      }
    ]
  };

  const stationThroughputData = {
    labels: filtered?.station_throughput?.map(s => s.station.charAt(0).toUpperCase() + s.station.slice(1)) || [],
    datasets: [
      {
        label: 'Items',
        data: data?.station_throughput?.map(s => s.items_count) || [],
        backgroundColor: [
          'rgba(59, 130, 246, 0.7)',
          'rgba(16, 185, 129, 0.7)',
          'rgba(245, 158, 11, 0.7)'
        ],
        borderColor: [
          'rgba(59, 130, 246, 1)',
          'rgba(16, 185, 129, 1)',
          'rgba(245, 158, 11, 1)'
        ],
        borderWidth: 1,
      },
    ],
  };

  return (
    <div className={`p-6 text-gray-100 max-w-7xl mx-auto ${printing ? 'print-mode' : ''}`}>
      {/* Print styles local to this page */}
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-card { break-inside: avoid; }
          .print-mode .bg-gray-900 { background: #ffffff !important; color: #000000 !important; }
          .print-mode .text-gray-100, .print-mode .text-gray-200, .print-mode .text-gray-300, .print-mode .text-gray-400 { color: #000 !important; }
          .print-mode .border-gray-800 { border-color: #ddd !important; }
        }
      `}</style>
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Sales Report</h1>
          <p className="text-gray-400 text-sm">
            {data?.window?.from ? new Date(data.window.from).toLocaleString() : ''} 
            {' '}—{' '}
            {data?.window?.to ? new Date(data.window.to).toLocaleString() : ''}
          </p>
        </div>
        <div className="flex gap-2 no-print">
          <button
            onClick={load}
            className="px-4 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 hover:bg-gray-700 transition-colors flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
            Refresh
          </button>
          <button
            onClick={onPrint}
            disabled={!data}
            className="px-4 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 hover:bg-gray-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v3h1a2 2 0 012 2v3a2 2 0 01-2 2h-1v2a2 2 0 01-2 2H7a2 2 0 01-2-2v-2H4a2 2 0 01-2-2V9a2 2 0 012-2h1V4zm2 0v3h8V4H7zm8 11H7v2h8v-2z" />
            </svg>
            Print
          </button>
          <button
            onClick={exportCsv}
            disabled={!data}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* Date Range Picker */}
      <div className="bg-gray-900 rounded-xl shadow p-4 border border-gray-800 mb-6 print-card">
        <h2 className="text-lg font-semibold text-gray-200 mb-4">Date Range</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 no-print">
          <div>
            <label className="block text-sm text-gray-300 mb-1">From</label>
            <input
              type="datetime-local"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full border border-gray-700 bg-gray-800 text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">To</label>
            <input
              type="datetime-local"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full border border-gray-700 bg-gray-800 text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={load}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 01-1-1v-5a1 1 0 011-1h1a1 1 0 011 1v5a1 1 0 01-1 1H3zm6 0a1 1 0 01-1-1V8a1 1 0 011-1h1a1 1 0 011 1v8a1 1 0 01-1 1H9zm6 0a1 1 0 01-1-1v-2a1 1 0 011-1h1a1 1 0 011 1v2a1 1 0 01-1 1h-1z" clipRule="evenodd" />
              </svg>
              Apply Filter
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 no-print">
          <button onClick={() => applyPreset('today')} className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded">Today</button>
          <button onClick={() => applyPreset('yesterday')} className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded">Yesterday</button>
          <button onClick={() => applyPreset('7d')} className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded">Last 7 Days</button>
          <button onClick={() => applyPreset('30d')} className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded">Last 30 Days</button>
          <button onClick={load} className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 rounded text-white">Apply</button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-900 rounded-xl shadow p-4 border border-gray-800 mb-6 print-card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-200">Filters</h2>
          <p className="text-xs text-gray-400">Note: Some filters may not affect all widgets if data lacks granularity.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 no-print">
          <div>
            <label className="block text-sm text-gray-300 mb-1">Station</label>
            <select
              value={filters.station}
              onChange={(e) => setFilters(f => ({ ...f, station: e.target.value }))}
              className="w-full border border-gray-700 bg-gray-800 text-gray-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
            >
              <option value="all">All</option>
              <option value="kitchen">Kitchen</option>
              <option value="bar">Bar</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Payment Methods</label>
            <div className="flex flex-wrap gap-2">
              {['cash','card','other'].map(m => {
                const active = filters.methods.includes(m);
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setFilters(f => ({
                      ...f,
                      methods: active ? f.methods.filter(x => x !== m) : [...f.methods, m]
                    }))}
                    className={`px-3 py-1.5 text-sm rounded border ${active ? 'bg-blue-600 border-blue-600 text-white' : 'bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700'}`}
                  >{m.charAt(0).toUpperCase() + m.slice(1)}</button>
                );
              })}
              <button
                type="button"
                onClick={() => setFilters(f => ({ ...f, methods: [] }))}
                className="px-3 py-1.5 text-sm rounded border bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700"
              >Clear</button>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <h3 className="text-gray-400 text-sm font-medium">Total Sales</h3>
              <p className="text-2xl font-bold text-white mt-1">
                {formatCurrency(data.bills_total || 0)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {data.bills_count} transactions
              </p>
            </div>
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <h3 className="text-gray-400 text-sm font-medium">Total Orders</h3>
              <p className="text-2xl font-bold text-white mt-1">{data.orders_count || 0}</p>
              <p className="text-xs text-gray-500 mt-1">
                {data.void_count || 0} voided, {data.comp_count || 0} comped
              </p>
            </div>
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <h3 className="text-gray-400 text-sm font-medium">Average Order</h3>
              <p className="text-2xl font-bold text-white mt-1">
                {data.orders_count > 0 ? formatCurrency((data.bills_total || 0) / data.orders_count) : '$0.00'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                per order
              </p>
            </div>
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <h3 className="text-gray-400 text-sm font-medium">COGS</h3>
              <p className="text-2xl font-bold text-white mt-1">{formatCurrency(data.cogs_total || 0)}</p>
              <p className="text-xs text-gray-500 mt-1">Cost of goods sold</p>
            </div>
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <h3 className="text-gray-400 text-sm font-medium">Gross Margin</h3>
              <p className="text-2xl font-bold text-white mt-1">{formatCurrency(data.gross_margin || 0)}</p>
              <p className="text-xs text-gray-500 mt-1">{data.gross_margin_pct != null ? `${data.gross_margin_pct}%` : 'N/A'}</p>
            </div>
          </div>

          {/* Sales Overview Chart */}
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 mb-6">
            <h3 className="text-lg font-semibold text-gray-200 mb-4">Sales Overview</h3>
            <div className="h-80">
              <Line 
                data={hourlySalesData} 
                options={{
                  ...chartOptions,
                  plugins: {
                    ...chartOptions.plugins,
                    title: {
                      display: true,
                      text: 'Hourly Sales Comparison',
                      color: '#f3f4f6',
                      font: {
                        size: 16
                      }
                    }
                  }
                }} 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Payment Methods Chart */}
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <h3 className="text-lg font-semibold text-gray-200 mb-4">Payment Methods</h3>
              <div className="h-64">
                <Pie 
                  data={paymentMethodsData} 
                  options={{
                    ...chartOptions,
                    plugins: {
                      ...chartOptions.plugins,
                      tooltip: {
                        ...chartOptions.plugins.tooltip,
                        callbacks: {
                          label: (context) => {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = Math.round((value / total) * 100);
                            return `${label}: ${formatCurrency(value)} (${percentage}%)`;
                          }
                        }
                      }
                    }
                  }} 
                />
              </div>
            </div>

            {/* Station Throughput Chart */}
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <h3 className="text-lg font-semibold text-gray-200 mb-4">Station Throughput</h3>
              <div className="h-64">
                <Bar 
                  data={stationThroughputData} 
                  options={{
                    ...chartOptions,
                    plugins: {
                      ...chartOptions.plugins,
                      title: {
                        display: true,
                        text: 'Items Processed by Station',
                        color: '#f3f4f6',
                        font: {
                          size: 16
                        }
                      }
                    },
                    scales: {
                      ...chartOptions.scales,
                      y: {
                        ...chartOptions.scales.y,
                        ticks: {
                          ...chartOptions.scales.y.ticks,
                          callback: (value) => value
                        }
                      }
                    }
                  }} 
                />
              </div>
            </div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Sales by Payment Method */}
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <h3 className="text-lg font-semibold text-gray-200 mb-4">Sales by Payment Method</h3>
              {data.payments_by_method?.length > 0 ? (
                <div className="space-y-2">
                  {data.payments_by_method.map((method) => (
                    <div key={method.method} className="mb-2">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="capitalize">{method.method}</span>
                        <span className="font-medium">{formatCurrency(method.sum || 0)}</span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-2.5">
                        <div 
                          className="bg-blue-600 h-2.5 rounded-full" 
                          style={{ width: `${(method.sum / data.bills_total) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No payment data available</p>
              )}
            </div>

            {/* Station Throughput */}
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <h3 className="text-lg font-semibold text-gray-200 mb-4">Station Throughput</h3>
              {data.station_throughput?.length > 0 ? (
                <div className="space-y-4">
                  {data.station_throughput.map((station) => (
                    <div key={station.station}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="capitalize">{station.station}</span>
                        <span className="font-medium">{station.orders} orders</span>
                      </div>
                      <div className="text-xs text-gray-400">
                        {station.items_count} items • {formatCurrency(station.items_total)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No station data available</p>
              )}
            </div>
          </div>

          {/* Hourly Sales */}
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 mb-6">
            <h3 className="text-lg font-semibold text-gray-200 mb-4">Hourly Sales</h3>
            {data.buckets?.length > 0 ? (
              <div className="h-64">
                <div className="flex items-end h-48 gap-1 border-b border-gray-800 pb-4">
                  {data.buckets.map((bucket, i) => {
                    const maxValue = Math.max(...data.buckets.map(b => Math.max(b.orders_total, b.bills_total)));
                    const height1 = maxValue > 0 ? (bucket.orders_total / maxValue) * 100 : 0;
                    const height2 = maxValue > 0 ? (bucket.bills_total / maxValue) * 100 : 0;
                    
                    return (
                      <div key={i} className="flex-1 flex items-end gap-px">
                        <div 
                          className="w-1/2 bg-blue-600/70 hover:bg-blue-500/80 transition-colors"
                          style={{ height: `${height1}%` }}
                          title={`Orders: ${formatCurrency(bucket.orders_total)}`}
                        ></div>
                        <div 
                          className="w-1/2 bg-green-600/70 hover:bg-green-500/80 transition-colors"
                          style={{ height: `${height2}%` }}
                          title={`Bills: ${formatCurrency(bucket.bills_total)}`}
                        ></div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-2 px-1">
                  {data.buckets.map((bucket, i) => (
                    <div key={i} className="text-center" style={{ flex: 1 }}>
                      {new Date(bucket.bucket).getHours()}:00
                    </div>
                  )).filter((_, i) => i % 2 === 0)}
                </div>
                <div className="flex justify-center gap-4 mt-4 text-xs">
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-blue-600/70 mr-1"></div>
                    <span>Orders</span>
                  </div>
                  <div className="flex items-center">
                    <div className="w-3 h-3 bg-green-600/70 mr-1"></div>
                    <span>Bills</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No hourly data available</p>
            )}
          </div>

          {/* Top Items / Categories */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <h3 className="text-lg font-semibold text-gray-200 mb-3">Top Items</h3>
              {Array.isArray(data.top_items) && data.top_items.length ? (
                <div className="space-y-2">
                  {data.top_items.map((t, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <div className="truncate pr-2">{t.item || 'Unknown'}</div>
                      <div className="flex items-center gap-4">
                        <span className="text-gray-400">×{t.qty}</span>
                        <span className="font-medium">{formatCurrency(t.total)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No items data</p>
              )}
            </div>
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <h3 className="text-lg font-semibold text-gray-200 mb-3">Top Categories</h3>
              {Array.isArray(data.top_categories) && data.top_categories.length ? (
                <div className="space-y-2">
                  {data.top_categories.map((t, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <div className="truncate pr-2 capitalize">{t.category || 'uncategorized'}</div>
                      <div className="flex items-center gap-4">
                        <span className="text-gray-400">×{t.qty}</span>
                        <span className="font-medium">{formatCurrency(t.total)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No categories data</p>
              )}
            </div>
          </div>

          {/* Anomaly Highlights */}
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 mb-6">
            <h3 className="text-lg font-semibold text-gray-200 mb-3">Anomaly Highlights</h3>
            {Array.isArray(data.anomalies) && data.anomalies.length ? (
              <div className="space-y-2">
                {data.anomalies.map((a, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <div className="text-gray-300">{new Date(a.bucket).toLocaleString()}</div>
                    <div className="flex items-center gap-4">
                      <span className="text-gray-400">z={a.z?.toFixed ? a.z.toFixed(2) : a.z}</span>
                      <span className="font-medium">{formatCurrency(a.bills_total)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No anomalies detected</p>
            )}
          </div>
        </>
      )}

      {loading && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-900">Loading…</div>
      )}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-900">{error}</div>
      )}

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { label: 'Orders Count', value: data.orders_count },
            { label: 'Orders Total', value: `$${Number(data.orders_total || 0).toFixed(2)}` },
            { label: 'Bills Total', value: `$${Number(data.bills_total || 0).toFixed(2)}` },
            { label: 'Bills Count', value: data.bills_count },
            { label: 'Void Count', value: data.void_count },
            { label: 'Comp Count', value: data.comp_count },
          ].map((card, idx) => (
            <div key={idx} className="bg-gray-900 rounded-xl shadow p-6 border border-gray-800">
              <div className="text-sm text-gray-400 mb-1">{card.label}</div>
              <div className="text-3xl font-bold text-gray-100">{card.value}</div>
            </div>
          ))}
        </div>
      )}

      {data && Array.isArray(data.payments_by_method) && (
        <div className="mt-6 bg-gray-900 rounded-xl shadow p-6 border border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-100">Payment Methods</h2>
          </div>
          {data.payments_by_method.length === 0 ? (
            <div className="text-gray-400 text-sm">No payments in this window.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {data.payments_by_method.map((p, idx) => (
                <div key={idx} className="border border-gray-800 rounded-lg p-4 bg-gray-800">
                  <div className="text-sm text-gray-300">{p.method}</div>
                  <div className="text-2xl font-bold text-gray-100">${Number(p.sum||0).toFixed(2)}</div>
                  <div className="text-xs text-gray-400">{p.cnt} payments</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {data && Array.isArray(data.station_throughput) && (
        <div className="mt-6 bg-gray-900 rounded-xl shadow p-6 border border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-100">Station Throughput</h2>
          </div>
          {data.station_throughput.length === 0 ? (
            <div className="text-gray-400 text-sm">No items/orders in this window.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {data.station_throughput.map((s, idx) => (
                <div key={idx} className="border border-gray-800 rounded-lg p-4 bg-gray-800">
                  <div className="text-sm text-gray-300 capitalize">{s.station}</div>
                  <div className="text-2xl font-bold text-gray-100">{s.items_count} items</div>
                  <div className="text-xs text-gray-400">{s.orders} orders • ${Number(s.items_total||0).toFixed(2)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {data && Array.isArray(data.buckets) && (
        <div className="mt-6 bg-gray-900 rounded-xl shadow p-6 border border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-100">Hourly Trend</h2>
          </div>
          {data.buckets.length === 0 ? (
            <div className="text-gray-400 text-sm">No activity in this window.</div>
          ) : (
            <ChartBuckets buckets={data.buckets} />
          )}
        </div>
      )}

      {data && Array.isArray(data.payments_by_method_hourly) && (
        <div className="mt-6 bg-gray-900 rounded-xl shadow p-6 border border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-100">Hourly Payment Breakdown</h2>
          </div>
          {data.payments_by_method_hourly.length === 0 ? (
            <div className="text-gray-400 text-sm">No payments in this window.</div>
          ) : (
            <HourlyPayments data={data.payments_by_method_hourly} />
          )}
        </div>
      )}
    </div>
  );
};

function ChartBuckets({ buckets }) {
  const w = 720, h = 220, pad = 30;
  const xs = buckets.map(b => new Date(b.bucket).getTime());
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const maxY = Math.max(
    1,
    ...buckets.map(b => Number(b.orders_total||0)),
    ...buckets.map(b => Number(b.bills_total||0))
  );
  const xscale = (t) => pad + ((t - minX) / Math.max(1, (maxX - minX))) * (w - 2*pad);
  const yscale = (v) => h - pad - (v / maxY) * (h - 2*pad);

  const pathFor = (key, color) => {
    const pts = buckets.map(b => `${xscale(new Date(b.bucket).getTime())},${yscale(Number(b[key]||0))}`);
    return <polyline fill="none" stroke={color} strokeWidth="2" points={pts.join(' ')} />;
  };

  return (
    <div className="overflow-x-auto">
      <svg width={w} height={h} className="min-w-full">
        {/* axes */}
        <line x1={pad} y1={h-pad} x2={w-pad} y2={h-pad} stroke="#e5e7eb" />
        <line x1={pad} y1={pad} x2={pad} y2={h-pad} stroke="#e5e7eb" />
        {/* lines */}
        {pathFor('orders_total', '#3b82f6')}
        {pathFor('bills_total', '#10b981')}
        {/* legend */}
        <g>
          <rect x={pad} y={5} width="10" height="10" fill="#3b82f6" />
          <text x={pad+16} y={14} fontSize="12" fill="#374151">Orders Total</text>
          <rect x={pad+120} y={5} width="10" height="10" fill="#10b981" />
          <text x={pad+136} y={14} fontSize="12" fill="#374151">Bills Total</text>
        </g>
      </svg>
    </div>
  );
}

export default ReportsPage;
function HourlyPayments({ data }) {
  // Group by bucket
  const buckets = [...new Set(data.map(r => r.bucket))].sort();
  const rowFor = (bucket, method) => data.find(r => r.bucket === bucket && r.method === method) || { sum: 0, cnt: 0 };
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500">
            <th className="py-2 pr-4">Hour</th>
            <th className="py-2 pr-4">Cash Sum</th>
            <th className="py-2 pr-4">Cash Cnt</th>
            <th className="py-2 pr-4">Card Sum</th>
            <th className="py-2 pr-4">Card Cnt</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((b, i) => {
            const c = rowFor(b, 'cash');
            const k = rowFor(b, 'card');
            return (
              <tr key={i} className="border-t">
                <td className="py-2 pr-4 text-gray-700">{new Date(b).toLocaleString()}</td>
                <td className="py-2 pr-4 text-emerald-700">${Number(c.sum||0).toFixed(2)}</td>
                <td className="py-2 pr-4 text-gray-600">{c.cnt||0}</td>
                <td className="py-2 pr-4 text-blue-700">${Number(k.sum||0).toFixed(2)}</td>
                <td className="py-2 pr-4 text-gray-600">{k.cnt||0}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
