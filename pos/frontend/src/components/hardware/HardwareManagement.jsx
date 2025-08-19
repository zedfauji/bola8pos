/**
 * Hardware Management Component
 * Phase 8 Track B: Hardware Integration
 */

import React, { useState, useEffect } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import api from '../../services/api';

const HardwareManagement = () => {
  const { checkAccess } = useSettings();
  const [devices, setDevices] = useState([]);
  const [printJobs, setPrintJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('devices');
  const [showAddModal, setShowAddModal] = useState(false);

  // Check access permissions
  useEffect(() => {
    if (!checkAccess('hardware', 'read')) {
      window.toast?.error('Access denied: Hardware management requires permission');
      return;
    }
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      if (activeTab === 'devices') {
        await fetchDevices();
      } else if (activeTab === 'print-jobs') {
        await fetchPrintJobs();
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      window.toast?.error('Failed to fetch hardware data');
    } finally {
      setLoading(false);
    }
  };

  const fetchDevices = async () => {
    const data = await api.request('/api/hardware/devices');
    if (data.devices) {
      setDevices(data.devices);
    } else {
      throw new Error(data.error || 'Failed to fetch devices');
    }
  };

  const fetchPrintJobs = async () => {
    const data = await api.request('/api/hardware/print-jobs?limit=50');
    if (data.jobs) {
      setPrintJobs(data.jobs);
    } else {
      throw new Error(data.error || 'Failed to fetch print jobs');
    }
  };

  const handlePingDevice = async (deviceId) => {
    try {
      const data = await api.request(`/api/hardware/devices/${deviceId}/ping`, {
        method: 'POST'
      });

      if (data && !data.error) {
        window.toast?.success('Device ping successful');
        fetchDevices();
      } else {
        window.toast?.error(data.error || 'Device ping failed');
      }
    } catch (error) {
      console.error('Error pinging device:', error);
      window.toast?.error('Failed to ping device');
    }
  };

  const handleAddDevice = async (deviceData) => {
    if (!checkAccess('hardware', 'create')) {
      window.toast?.error('Access denied: Cannot add devices');
      return;
    }

    try {
      const data = await api.request('/api/hardware/devices', {
        method: 'POST',
        body: JSON.stringify(deviceData)
      });

      if (data && !data.error) {
        window.toast?.success('Device added successfully');
        setShowAddModal(false);
        fetchDevices();
      } else {
        window.toast?.error(data.error || 'Failed to add device');
      }
    } catch (error) {
      console.error('Error adding device:', error);
      window.toast?.error('Failed to add device');
    }
  };

  const tabs = [
    { id: 'devices', label: '🖥️ Devices', count: devices.length },
    { id: 'print-jobs', label: '🖨️ Print Jobs', count: printJobs.length }
  ];

  return (
    <div className="pos-container p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Hardware Management</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="pos-button"
          disabled={!checkAccess('hardware', 'create')}
        >
          ➕ Add Device
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {tab.label}
            <span className="ml-2 px-2 py-1 bg-gray-600 rounded-full text-xs">
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="pos-card">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-2 text-gray-400">Loading...</p>
          </div>
        ) : (
          <>
            {activeTab === 'devices' && (
              <DevicesTab
                devices={devices}
                onPing={handlePingDevice}
                onRefresh={fetchDevices}
              />
            )}
            {activeTab === 'print-jobs' && (
              <PrintJobsTab
                printJobs={printJobs}
                onRefresh={fetchPrintJobs}
              />
            )}
          </>
        )}
      </div>

      {/* Add Device Modal */}
      {showAddModal && (
        <AddDeviceModal
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddDevice}
        />
      )}
    </div>
  );
};

// Devices Tab Component
const DevicesTab = ({ devices, onPing, onRefresh }) => {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-white">Hardware Devices</h2>
        <button onClick={onRefresh} className="pos-button-secondary">
          🔄 Refresh
        </button>
      </div>

      {devices.length === 0 ? (
        <p className="text-gray-400 text-center py-8">No devices registered</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="pos-table">
            <thead>
              <tr>
                <th>Device Name</th>
                <th>Type</th>
                <th>Model</th>
                <th>Connection</th>
                <th>Status</th>
                <th>Last Ping</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((device) => (
                <tr key={device.id} className="hover:bg-gray-700">
                  <td className="font-medium">{device.device_name}</td>
                  <td className="capitalize">{device.device_type.replace('_', ' ')}</td>
                  <td>{device.device_model || '-'}</td>
                  <td>
                    <div className="text-sm">
                      <div className="capitalize">{device.connection_type}</div>
                      <div className="text-gray-400 font-mono text-xs">
                        {device.connection_string}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      device.is_enabled 
                        ? device.is_online 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {device.is_enabled ? (device.is_online ? 'ONLINE' : 'OFFLINE') : 'DISABLED'}
                    </span>
                  </td>
                  <td className="text-sm text-gray-400">
                    {device.last_ping ? new Date(device.last_ping).toLocaleString() : 'Never'}
                  </td>
                  <td>
                    <button
                      onClick={() => onPing(device.id)}
                      className="pos-button-secondary text-sm"
                      disabled={!device.is_enabled}
                    >
                      Ping
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// Print Jobs Tab Component
const PrintJobsTab = ({ printJobs, onRefresh }) => {
  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      printing: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-white">Print Jobs</h2>
        <button onClick={onRefresh} className="pos-button-secondary">
          🔄 Refresh
        </button>
      </div>

      {printJobs.length === 0 ? (
        <p className="text-gray-400 text-center py-8">No print jobs found</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="pos-table">
            <thead>
              <tr>
                <th>Job ID</th>
                <th>Printer</th>
                <th>Type</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Created</th>
                <th>Attempts</th>
              </tr>
            </thead>
            <tbody>
              {printJobs.map((job) => (
                <tr key={job.id} className="hover:bg-gray-700">
                  <td className="font-mono text-sm">{job.id.slice(0, 8)}...</td>
                  <td>{job.printer_name || 'Unknown'}</td>
                  <td className="capitalize">{job.job_type.replace('_', ' ')}</td>
                  <td className="text-center">{job.priority}</td>
                  <td>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                      {job.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="text-sm">{new Date(job.created_at).toLocaleString()}</td>
                  <td className="text-center">{job.attempts}/{job.max_attempts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// Add Device Modal Component
const AddDeviceModal = ({ onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    device_type: 'printer',
    device_name: '',
    device_model: '',
    connection_type: 'network',
    connection_string: '',
    is_enabled: true
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.device_name || !formData.connection_string) {
      window.toast?.error('Device name and connection string are required');
      return;
    }
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="pos-card max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Add Hardware Device</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-400 mb-2">Device Type</label>
            <select
              value={formData.device_type}
              onChange={(e) => setFormData(prev => ({ ...prev, device_type: e.target.value }))}
              className="pos-input w-full"
            >
              <option value="printer">Printer</option>
              <option value="payment_terminal">Payment Terminal</option>
              <option value="kds_display">KDS Display</option>
              <option value="rfid_reader">RFID Reader</option>
              <option value="scanner">Scanner</option>
            </select>
          </div>

          <input
            type="text"
            placeholder="Device Name *"
            value={formData.device_name}
            onChange={(e) => setFormData(prev => ({ ...prev, device_name: e.target.value }))}
            className="pos-input w-full"
            required
          />

          <input
            type="text"
            placeholder="Device Model"
            value={formData.device_model}
            onChange={(e) => setFormData(prev => ({ ...prev, device_model: e.target.value }))}
            className="pos-input w-full"
          />

          <div>
            <label className="block text-gray-400 mb-2">Connection Type</label>
            <select
              value={formData.connection_type}
              onChange={(e) => setFormData(prev => ({ ...prev, connection_type: e.target.value }))}
              className="pos-input w-full"
            >
              <option value="network">Network</option>
              <option value="usb">USB</option>
              <option value="bluetooth">Bluetooth</option>
              <option value="serial">Serial</option>
            </select>
          </div>

          <input
            type="text"
            placeholder="Connection String *"
            value={formData.connection_string}
            onChange={(e) => setFormData(prev => ({ ...prev, connection_string: e.target.value }))}
            className="pos-input w-full"
            required
          />

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enabled"
              checked={formData.is_enabled}
              onChange={(e) => setFormData(prev => ({ ...prev, is_enabled: e.target.checked }))}
              className="rounded"
            />
            <label htmlFor="enabled" className="text-gray-400">Enable device</label>
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="pos-button-secondary flex-1">
              Cancel
            </button>
            <button type="submit" className="pos-button flex-1">
              Add Device
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default HardwareManagement;
