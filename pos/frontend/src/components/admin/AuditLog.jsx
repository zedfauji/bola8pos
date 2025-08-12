import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../../contexts/SettingsContext';
import api from '../../services/api';

export default function AuditLog() {
  const navigate = useNavigate();
  const { hasPermission, isPinRequired, verifyPin } = useSettings();
  const [accessDenied, setAccessDenied] = useState(false);
  const [pinVerified, setPinVerified] = useState(false);
  const [pinError, setPinError] = useState('');
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Check if user has permission to view audit logs
  const checkAccess = useCallback(async () => {
    try {
      // Check if PIN is required for viewing audit logs
      if (isPinRequired('view_audit_logs') && !pinVerified) {
        const pin = prompt('Enter manager PIN to view audit logs:');
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
      if (!hasPermission('view_audit_logs')) {
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

  // Check access and load logs on component mount
  useEffect(() => {
    checkAccess().then(hasAccess => {
      if (hasAccess) {
        load();
      }
    });
  }, [checkAccess]);

  if (accessDenied) {
    return (
      <div className="p-6">
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
          <p className="font-bold">Access Denied</p>
          <p>{pinError || 'You do not have permission to view audit logs.'}</p>
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAuditLogs(200);
      setLogs(data || []);
    } catch (e) {
      console.error(e);
      setError('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, []);



  return (
    <div className="p-6 text-slate-100">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Audit Log</h1>
        <button onClick={load} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg">Refresh</button>
      </div>
      {loading && <div className="text-slate-400">Loading…</div>}
      {error && <div className="text-red-400">{error}</div>}
      {!loading && !error && (
        <div className="bg-slate-900 rounded-xl shadow border border-slate-700 overflow-hidden">
          <div className="grid grid-cols-5 gap-0 px-4 py-2 bg-slate-800 border-b border-slate-700 text-xs font-semibold text-slate-200">
            <div>Time</div>
            <div>Action</div>
            <div>Entity</div>
            <div>Table</div>
            <div>Details</div>
          </div>
          <div className="divide-y divide-slate-800">
            {logs.map((row) => (
              <div key={row.id} className="grid grid-cols-5 gap-0 px-4 py-3 text-sm">
                <div className="text-slate-300">{row.ts}</div>
                <div className="font-medium">{row.action}</div>
                <div className="text-slate-300">{row.entity_type}{row.entity_id ? `:${row.entity_id}` : ''}</div>
                <div className="text-slate-300">{row.table_id || '-'}</div>
                <div className="text-slate-400 truncate">
                  {row.details ? JSON.stringify(row.details) : '-'}
                </div>
              </div>
            ))}
            {logs.length === 0 && (
              <div className="px-4 py-6 text-slate-400 text-sm">No audit entries yet.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
