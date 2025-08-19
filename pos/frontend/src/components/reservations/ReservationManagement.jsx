/**
 * Reservation Management Component
 * Phase 8 Track A: Advanced POS Features
 */

import React, { useState, useEffect } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import api from '../../services/api';

const ReservationManagement = () => {
  const { checkAccess } = useSettings();
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedTable, setSelectedTable] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [availability, setAvailability] = useState(null);
  const [stats, setStats] = useState(null);

  // Check access permissions
  useEffect(() => {
    if (!checkAccess('reservations', 'read')) {
      window.toast?.error('Access denied: Reservation management requires permission');
      return;
    }
    fetchReservations();
  }, [selectedDate, selectedTable, selectedStatus]);

  // Fetch stats summary for the selected date
  useEffect(() => {
    if (!checkAccess('reservations', 'read')) return;
    fetchStats();
  }, [selectedDate]);

  const fetchReservations = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        date: selectedDate,
        ...(selectedTable && { table_id: selectedTable }),
        ...(selectedStatus && { status: selectedStatus })
      });

      const data = await api.request(`/api/reservations?${params}`);

      if (data.reservations) {
        setReservations(data.reservations);
      } else {
        window.toast?.error(data.error || 'Failed to fetch reservations');
      }
    } catch (error) {
      console.error('Error fetching reservations:', error);
      window.toast?.error('Failed to fetch reservations');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateReservation = async (reservationId, updates) => {
    if (!checkAccess('reservations', 'update')) {
      window.toast?.error('Access denied: Cannot update reservations');
      return { ok: false };
    }
    try {
      const data = await api.request(`/api/reservations/${reservationId}`, {
        method: 'PUT',
        body: JSON.stringify({ ...updates, changed_by: 'Staff' })
      });
      if (data && !data.error) {
        window.toast?.success('Reservation updated');
        await fetchReservations();
        await fetchStats();
        return { ok: true, data };
      } else {
        window.toast?.error(data.error || 'Failed to update reservation');
        return { ok: false };
      }
    } catch (error) {
      console.error('Error updating reservation:', error);
      window.toast?.error('Failed to update reservation');
      return { ok: false };
    }
  };

  const handleCancelReservation = async (reservationId, reason = '') => {
    if (!checkAccess('reservations', 'update')) {
      window.toast?.error('Access denied: Cannot cancel reservations');
      return { ok: false };
    }
    try {
      const data = await api.request(`/api/reservations/${reservationId}`, {
        method: 'DELETE',
        body: JSON.stringify({ changed_by: 'Staff', reason })
      });
      if (data && data.success) {
        window.toast?.success('Reservation cancelled');
        await fetchReservations();
        await fetchStats();
        return { ok: true };
      } else {
        window.toast?.error(data.error || 'Failed to cancel reservation');
        return { ok: false };
      }
    } catch (error) {
      console.error('Error cancelling reservation:', error);
      window.toast?.error('Failed to cancel reservation');
      return { ok: false };
    }
  };

  const checkAvailability = async (tableId, date, duration = 120) => {
    try {
      const params = new URLSearchParams({ date, duration });
      const data = await api.request(`/api/reservations/availability/${tableId}?${params}`);
      
      if (data && !data.error) {
        setAvailability(data);
      } else {
        window.toast?.error(data.error || 'Failed to check availability');
      }
    } catch (error) {
      console.error('Error checking availability:', error);
      window.toast?.error('Failed to check availability');
    }
  };

  const fetchStats = async () => {
    try {
      const params = new URLSearchParams({ start_date: selectedDate, end_date: selectedDate });
      const data = await api.request(`/api/reservations/stats/summary?${params}`);
      if (data && !data.error) {
        setStats(data);
      } else {
        setStats(null);
      }
    } catch (e) {
      setStats(null);
    }
  };

  const handleReservationClick = async (reservation) => {
    try {
      const data = await api.request(`/api/reservations/${reservation.id}`);
      
      if (data && !data.error) {
        setSelectedReservation(data);
        setShowDetailModal(true);
      } else {
        window.toast?.error(data.error || 'Failed to fetch reservation details');
      }
    } catch (error) {
      console.error('Error fetching reservation details:', error);
      window.toast?.error('Failed to fetch reservation details');
    }
  };

  const handleAddReservation = async (reservationData) => {
    if (!checkAccess('reservations', 'create')) {
      window.toast?.error('Access denied: Cannot create reservations');
      return;
    }

    try {
      const data = await api.request('/api/reservations', {
        method: 'POST',
        body: JSON.stringify({ ...reservationData, created_by: 'Staff' })
      });

      if (data && !data.error) {
        window.toast?.success('Reservation created successfully');
        setShowAddModal(false);
        fetchReservations();
        fetchStats();
      } else {
        window.toast?.error(data.error || 'Failed to create reservation');
      }
    } catch (error) {
      console.error('Error creating reservation:', error);
      window.toast?.error('Failed to create reservation');
    }
  };

  const handleCheckIn = async (reservationId) => {
    if (!checkAccess('reservations', 'update')) {
      window.toast?.error('Access denied: Cannot check in reservations');
      return;
    }

    try {
      const data = await api.request(`/api/reservations/${reservationId}/check-in`, {
        method: 'POST',
        body: JSON.stringify({ checked_in_by: 'Staff' })
      });

      if (data && !data.error) {
        window.toast?.success('Customer checked in successfully');
        fetchReservations();
      } else {
        window.toast?.error(data.error || 'Failed to check in customer');
      }
    } catch (error) {
      console.error('Error checking in customer:', error);
      window.toast?.error('Failed to check in customer');
    }
  };

  const getStatusBadgeColor = (status) => {
    const colors = {
      confirmed: 'bg-blue-100 text-blue-800',
      checked_in: 'bg-green-100 text-green-800',
      seated: 'bg-purple-100 text-purple-800',
      completed: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800',
      no_show: 'bg-orange-100 text-orange-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const tables = ['B1', 'B2', 'B3', 'B4', 'B5', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10'];

  return (
    <div className="pos-container p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Reservation Management</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="pos-button"
          disabled={!checkAccess('reservations', 'create')}
        >
          📅 New Reservation
        </button>
      </div>

      {/* Filters */}
      <div className="pos-card mb-6">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-gray-400 mb-2">Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="pos-input"
            />
          </div>
          <div>
            <label className="block text-gray-400 mb-2">Table</label>
            <select
              value={selectedTable}
              onChange={(e) => setSelectedTable(e.target.value)}
              className="pos-input"
            >
              <option value="">All Tables</option>
              {tables.map(table => (
                <option key={table} value={table}>{table}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-gray-400 mb-2">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="pos-input"
            >
              <option value="">All Status</option>
              <option value="confirmed">Confirmed</option>
              <option value="checked_in">Checked In</option>
              <option value="seated">Seated</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="no_show">No Show</option>
            </select>
          </div>
        </div>
        {stats?.summary && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-6 gap-2 text-sm">
            <div className="bg-gray-700 p-3 rounded">Total: <span className="font-semibold">{stats.summary.total_reservations || 0}</span></div>
            <div className="bg-blue-900/40 p-3 rounded">Confirmed: <span className="font-semibold">{stats.summary.confirmed || 0}</span></div>
            <div className="bg-green-900/40 p-3 rounded">Checked In: <span className="font-semibold">{stats.summary.checked_in || 0}</span></div>
            <div className="bg-purple-900/40 p-3 rounded">Seated: <span className="font-semibold">{stats.summary.seated || 0}</span></div>
            <div className="bg-gray-900/40 p-3 rounded">Completed: <span className="font-semibold">{stats.summary.completed || 0}</span></div>
            <div className="bg-red-900/40 p-3 rounded">Cancelled: <span className="font-semibold">{stats.summary.cancelled || 0}</span></div>
          </div>
        )}
      </div>

      {/* Reservations List */}
      <div className="pos-card">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-2 text-gray-400">Loading reservations...</p>
          </div>
        ) : reservations.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400">No reservations found for {selectedDate}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="pos-table">
              <thead>
                <tr>
                  <th>Reservation #</th>
                  <th>Time</th>
                  <th>Customer</th>
                  <th>Table</th>
                  <th>Party Size</th>
                  <th>Status</th>
                  <th>Special Requests</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((reservation) => (
                  <tr key={reservation.id} className="hover:bg-gray-700">
                    <td className="font-mono">{reservation.reservation_number}</td>
                    <td>
                      {reservation.start_time.slice(0, 5)} - {reservation.end_time.slice(0, 5)}
                    </td>
                    <td className="font-medium">
                      {reservation.customer_name}
                      {reservation.customer_phone && (
                        <div className="text-sm text-gray-400">{reservation.customer_phone}</div>
                      )}
                    </td>
                    <td className="text-center font-bold">{reservation.table_id}</td>
                    <td className="text-center">{reservation.party_size}</td>
                    <td>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(reservation.status)}`}>
                        {reservation.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="max-w-32 truncate">{reservation.special_requests || '-'}</td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReservationClick(reservation)}
                          className="pos-button-secondary text-sm"
                        >
                          Details
                        </button>
                        {reservation.status === 'confirmed' && (
                          <button
                            onClick={() => handleCheckIn(reservation.id)}
                            className="pos-button text-sm"
                            disabled={!checkAccess('reservations', 'update')}
                          >
                            Check In
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Reservation Modal */}
      {showAddModal && (
        <AddReservationModal
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddReservation}
          onCheckAvailability={checkAvailability}
          availability={availability}
          selectedDate={selectedDate}
        />
      )}

      {/* Reservation Detail Modal */}
      {showDetailModal && selectedReservation && (
        <ReservationDetailModal
          reservation={selectedReservation}
          onClose={() => setShowDetailModal(false)}
          onSave={handleUpdateReservation}
          onCancel={handleCancelReservation}
        />
      )}
    </div>
  );
};

// Add Reservation Modal Component
const AddReservationModal = ({ onClose, onSubmit, onCheckAvailability, availability, selectedDate }) => {
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    table_id: '',
    party_size: 2,
    reservation_date: selectedDate,
    start_time: '',
    end_time: '',
    special_requests: '',
    deposit_amount: 0
  });

  const tables = ['B1', 'B2', 'B3', 'B4', 'B5', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10'];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.customer_name || !formData.table_id || !formData.start_time || !formData.end_time) {
      window.toast?.error('Please fill in all required fields');
      return;
    }
    onSubmit(formData);
  };

  const handleCheckAvailability = () => {
    if (formData.table_id && formData.reservation_date) {
      onCheckAvailability(formData.table_id, formData.reservation_date);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="pos-card max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">New Reservation</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Customer Name *"
              value={formData.customer_name}
              onChange={(e) => setFormData(prev => ({ ...prev, customer_name: e.target.value }))}
              className="pos-input"
              required
            />
            <input
              type="tel"
              placeholder="Phone Number"
              value={formData.customer_phone}
              onChange={(e) => setFormData(prev => ({ ...prev, customer_phone: e.target.value }))}
              className="pos-input"
            />
          </div>

          <input
            type="email"
            placeholder="Email"
            value={formData.customer_email}
            onChange={(e) => setFormData(prev => ({ ...prev, customer_email: e.target.value }))}
            className="pos-input w-full"
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-gray-400 mb-2">Table *</label>
              <select
                value={formData.table_id}
                onChange={(e) => setFormData(prev => ({ ...prev, table_id: e.target.value }))}
                className="pos-input w-full"
                required
              >
                <option value="">Select Table</option>
                {tables.map(table => (
                  <option key={table} value={table}>{table}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-gray-400 mb-2">Party Size *</label>
              <input
                type="number"
                min="1"
                max="20"
                value={formData.party_size}
                onChange={(e) => setFormData(prev => ({ ...prev, party_size: parseInt(e.target.value) }))}
                className="pos-input w-full"
                required
              />
            </div>
            <div>
              <label className="block text-gray-400 mb-2">Date *</label>
              <input
                type="date"
                value={formData.reservation_date}
                onChange={(e) => setFormData(prev => ({ ...prev, reservation_date: e.target.value }))}
                className="pos-input w-full"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-400 mb-2">Start Time *</label>
              <input
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                className="pos-input w-full"
                required
              />
            </div>
            <div>
              <label className="block text-gray-400 mb-2">End Time *</label>
              <input
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                className="pos-input w-full"
                required
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCheckAvailability}
              className="pos-button-secondary"
              disabled={!formData.table_id || !formData.reservation_date}
            >
              Check Availability
            </button>
          </div>

          {availability && (
            <div className="bg-gray-700 p-4 rounded">
              <h4 className="font-medium text-white mb-2">Available Time Slots for {availability.table_id}:</h4>
              {availability.available_slots.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {availability.available_slots.slice(0, 12).map((slot, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setFormData(prev => ({ 
                        ...prev, 
                        start_time: slot.start_time.slice(0, 5),
                        end_time: slot.end_time.slice(0, 5)
                      }))}
                      className="pos-button-secondary text-sm"
                    >
                      {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-red-400">No available slots for this date</p>
              )}
            </div>
          )}

          <textarea
            placeholder="Special Requests"
            value={formData.special_requests}
            onChange={(e) => setFormData(prev => ({ ...prev, special_requests: e.target.value }))}
            className="pos-input w-full h-20"
          />

          <div>
            <label className="block text-gray-400 mb-2">Deposit Amount</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.deposit_amount}
              onChange={(e) => setFormData(prev => ({ ...prev, deposit_amount: parseFloat(e.target.value) || 0 }))}
              className="pos-input w-full"
            />
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="pos-button-secondary flex-1">
              Cancel
            </button>
            <button type="submit" className="pos-button flex-1">
              Create Reservation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Reservation Detail Modal Component
const ReservationDetailModal = ({ reservation, onClose, onSave, onCancel }) => {
  const { checkAccess } = useSettings();
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    table_id: reservation.table_id,
    party_size: reservation.party_size,
    reservation_date: reservation.reservation_date,
    start_time: reservation.start_time.slice(0,5),
    end_time: reservation.end_time.slice(0,5),
    special_requests: reservation.special_requests || '',
    status: reservation.status
  });
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [avail, setAvail] = useState(null);

  const tables = ['B1', 'B2', 'B3', 'B4', 'B5', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10'];

  const doCheckAvailability = async () => {
    try {
      const params = new URLSearchParams({ date: form.reservation_date, duration: String(Math.max(30, (form.party_size ? 120 : 120))) });
      const data = await api.request(`/api/reservations/availability/${form.table_id}?${params}`);
      if (!data.error) setAvail(data); else setAvail(null);
    } catch { setAvail(null); }
  };

  const handleSave = async () => {
    setSaving(true);
    const res = await onSave(reservation.id, {
      table_id: form.table_id,
      party_size: form.party_size,
      reservation_date: form.reservation_date,
      start_time: form.start_time,
      end_time: form.end_time,
      special_requests: form.special_requests,
      status: form.status
    });
    setSaving(false);
    if (res?.ok) {
      setIsEditing(false);
      onClose();
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Cancel this reservation?')) return;
    setCancelling(true);
    const res = await onCancel(reservation.id, reason);
    setCancelling(false);
    if (res?.ok) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="pos-card max-w-2xl w-full mx-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">
            Reservation {reservation.reservation_number}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Reservation Details</h3>
            {!isEditing ? (
              <div className="space-y-3">
                <div><span className="text-gray-400">Customer:</span> {reservation.customer_name}</div>
                <div><span className="text-gray-400">Phone:</span> {reservation.customer_phone || 'Not provided'}</div>
                <div><span className="text-gray-400">Email:</span> {reservation.customer_email || 'Not provided'}</div>
                <div><span className="text-gray-400">Table:</span> {reservation.table_id}</div>
                <div><span className="text-gray-400">Party Size:</span> {reservation.party_size}</div>
                <div><span className="text-gray-400">Date:</span> {reservation.reservation_date}</div>
                <div><span className="text-gray-400">Time:</span> {reservation.start_time.slice(0, 5)} - {reservation.end_time.slice(0, 5)}</div>
                <div><span className="text-gray-400">Duration:</span> {reservation.duration_minutes} minutes</div>
                <div><span className="text-gray-400">Status:</span> 
                  <span className={`ml-2 px-2 py-1 rounded text-xs ${reservation.status === 'confirmed' ? 'bg-blue-100 text-blue-800' : reservation.status === 'checked_in' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {reservation.status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
                {reservation.deposit_amount > 0 && (
                  <div><span className="text-gray-400">Deposit:</span> ${reservation.deposit_amount} {reservation.deposit_paid ? '(Paid)' : '(Pending)'}</div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-gray-400 mb-1">Table</label>
                  <select value={form.table_id} onChange={e=>setForm(p=>({...p, table_id: e.target.value}))} className="pos-input w-full">
                    {tables.map(t=>(<option key={t} value={t}>{t}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">Party Size</label>
                  <input type="number" min="1" max="20" value={form.party_size} onChange={e=>setForm(p=>({...p, party_size: parseInt(e.target.value)||1}))} className="pos-input w-full" />
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">Date</label>
                  <input type="date" value={form.reservation_date} onChange={e=>setForm(p=>({...p, reservation_date: e.target.value}))} className="pos-input w-full" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-gray-400 mb-1">Start</label>
                    <input type="time" value={form.start_time} onChange={e=>setForm(p=>({...p, start_time: e.target.value}))} className="pos-input w-full" />
                  </div>
                  <div>
                    <label className="block text-gray-400 mb-1">End</label>
                    <input type="time" value={form.end_time} onChange={e=>setForm(p=>({...p, end_time: e.target.value}))} className="pos-input w-full" />
                  </div>
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">Status</label>
                  <select value={form.status} onChange={e=>setForm(p=>({...p, status: e.target.value}))} className="pos-input w-full">
                    <option value="confirmed">Confirmed</option>
                    <option value="checked_in">Checked In</option>
                    <option value="seated">Seated</option>
                    <option value="completed">Completed</option>
                    <option value="no_show">No Show</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">Special Requests</label>
                  <textarea value={form.special_requests} onChange={e=>setForm(p=>({...p, special_requests: e.target.value}))} className="pos-input w-full h-20" />
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={doCheckAvailability} className="pos-button-secondary">Check Availability</button>
                </div>
                {avail && (
                  <div className="bg-gray-700 p-3 rounded">
                    <div className="text-sm font-medium mb-2">Available Slots</div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {avail.available_slots.slice(0, 12).map((s, i) => (
                        <button key={i} type="button" onClick={()=>setForm(p=>({...p, start_time: s.start_time.slice(0,5), end_time: s.end_time.slice(0,5)}))} className="pos-button-secondary text-xs">
                          {s.start_time.slice(0,5)} - {s.end_time.slice(0,5)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Additional Information</h3>
            <div className="space-y-3">
              {reservation.special_requests && !isEditing && (
                <div>
                  <span className="text-gray-400">Special Requests:</span>
                  <p className="mt-1 text-white">{reservation.special_requests}</p>
                </div>
              )}
              <div><span className="text-gray-400">Created By:</span> {reservation.created_by}</div>
              <div><span className="text-gray-400">Created:</span> {new Date(reservation.created_at).toLocaleString()}</div>
            </div>

            {reservation.history && reservation.history.length > 0 && (
              <div className="mt-6">
                <h4 className="text-md font-medium text-gray-300 mb-2">History</h4>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {reservation.history.map((entry, index) => (
                    <div key={index} className="text-sm bg-gray-700 p-2 rounded">
                      <div className="flex justify-between">
                        <span className="capitalize">{entry.change_type.replace('_', ' ')}</span>
                        <span className="text-gray-400">{new Date(entry.changed_at).toLocaleDateString()}</span>
                      </div>
                      {entry.changed_by && <div className="text-gray-400">By: {entry.changed_by}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 flex flex-col gap-2">
              {!isEditing ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsEditing(true)}
                    className="pos-button-secondary"
                    disabled={!checkAccess('reservations', 'update')}
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleCancel}
                    className="pos-button-danger"
                    disabled={!checkAccess('reservations', 'update') || cancelling}
                  >
                    {cancelling ? 'Cancelling...' : 'Cancel Reservation'}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div>
                    <label className="block text-gray-400 mb-1">Cancellation Reason (optional)</label>
                    <input
                      type="text"
                      value={reason}
                      onChange={(e)=>setReason(e.target.value)}
                      className="pos-input w-full"
                      placeholder="Reason if you plan to cancel instead"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={()=>setIsEditing(false)} className="pos-button-secondary">Discard</button>
                    <button onClick={handleSave} className="pos-button" disabled={saving || !checkAccess('reservations','update')}>
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button onClick={handleCancel} className="pos-button-danger" disabled={cancelling || !checkAccess('reservations','update')}>
                      {cancelling ? 'Cancelling...' : 'Cancel Reservation'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReservationManagement;
