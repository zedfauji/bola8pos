/**
 * Customer Management Component
 * Phase 8 Track A: Advanced POS Features
 */

import React, { useState, useEffect } from 'react';
import { useSettings } from '../../contexts/SettingsContext';

const CustomerManagement = () => {
  const { checkAccess } = useSettings();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTier, setFilterTier] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });

  // Check access permissions
  useEffect(() => {
    if (!checkAccess('customers', 'read')) {
      window.toast?.error('Access denied: Customer management requires permission');
      return;
    }
    fetchCustomers();
  }, [searchTerm, filterTier, pagination.page]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        search: searchTerm,
        tier: filterTier,
        active: 'true'
      });

      const response = await fetch(`/api/customers?${params}`);
      const data = await response.json();

      if (response.ok) {
        setCustomers(data.customers);
        setPagination(prev => ({ ...prev, total: data.pagination.total }));
      } else {
        window.toast?.error(data.error || 'Failed to fetch customers');
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
      window.toast?.error('Failed to fetch customers');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerClick = async (customer) => {
    try {
      const response = await fetch(`/api/customers/${customer.id}`);
      const data = await response.json();

      if (response.ok) {
        setSelectedCustomer(data);
        setShowDetailModal(true);
      } else {
        window.toast?.error(data.error || 'Failed to fetch customer details');
      }
    } catch (error) {
      console.error('Error fetching customer details:', error);
      window.toast?.error('Failed to fetch customer details');
    }
  };

  const handleAddCustomer = async (customerData) => {
    if (!checkAccess('customers', 'create')) {
      window.toast?.error('Access denied: Cannot create customers');
      return;
    }

    try {
      const response = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customerData)
      });

      const data = await response.json();

      if (response.ok) {
        window.toast?.success('Customer created successfully');
        setShowAddModal(false);
        fetchCustomers();
      } else {
        window.toast?.error(data.error || 'Failed to create customer');
      }
    } catch (error) {
      console.error('Error creating customer:', error);
      window.toast?.error('Failed to create customer');
    }
  };

  const handleRedeemPoints = async (customerId, points, description) => {
    if (!checkAccess('customers', 'update')) {
      window.toast?.error('Access denied: Cannot redeem points');
      return;
    }

    try {
      const response = await fetch(`/api/customers/${customerId}/loyalty/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points, description })
      });

      const data = await response.json();

      if (response.ok) {
        window.toast?.success(`${points} points redeemed successfully`);
        // Refresh customer details
        handleCustomerClick({ id: customerId });
      } else {
        window.toast?.error(data.error || 'Failed to redeem points');
      }
    } catch (error) {
      console.error('Error redeeming points:', error);
      window.toast?.error('Failed to redeem points');
    }
  };

  const getTierBadgeColor = (tier) => {
    const colors = {
      bronze: 'bg-amber-100 text-amber-800',
      silver: 'bg-gray-100 text-gray-800',
      gold: 'bg-yellow-100 text-yellow-800',
      platinum: 'bg-purple-100 text-purple-800'
    };
    return colors[tier] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="pos-container p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Customer Management</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="pos-button"
          disabled={!checkAccess('customers', 'create')}
        >
          ➕ Add Customer
        </button>
      </div>

      {/* Search and Filters */}
      <div className="pos-card mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-64">
            <input
              type="text"
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pos-input w-full"
            />
          </div>
          <select
            value={filterTier}
            onChange={(e) => setFilterTier(e.target.value)}
            className="pos-input"
          >
            <option value="">All Tiers</option>
            <option value="bronze">Bronze</option>
            <option value="silver">Silver</option>
            <option value="gold">Gold</option>
            <option value="platinum">Platinum</option>
          </select>
        </div>
      </div>

      {/* Customer List */}
      <div className="pos-card">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-2 text-gray-400">Loading customers...</p>
          </div>
        ) : customers.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400">No customers found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="pos-table">
              <thead>
                <tr>
                  <th>Customer #</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Tier</th>
                  <th>Points</th>
                  <th>Visits</th>
                  <th>Total Spent</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-700">
                    <td className="font-mono">{customer.customer_number}</td>
                    <td className="font-medium">
                      {customer.first_name} {customer.last_name}
                    </td>
                    <td>{customer.email || '-'}</td>
                    <td>{customer.phone || '-'}</td>
                    <td>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTierBadgeColor(customer.membership_tier)}`}>
                        {customer.membership_tier.toUpperCase()}
                      </span>
                    </td>
                    <td className="text-center">{customer.loyalty_points}</td>
                    <td className="text-center">{customer.total_visits}</td>
                    <td className="text-right">${customer.total_spent}</td>
                    <td>
                      <button
                        onClick={() => handleCustomerClick(customer)}
                        className="pos-button-secondary text-sm"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.total > pagination.limit && (
          <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-600">
            <span className="text-sm text-gray-400">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} customers
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page === 1}
                className="pos-button-secondary disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page * pagination.limit >= pagination.total}
                className="pos-button-secondary disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Customer Modal */}
      {showAddModal && (
        <AddCustomerModal
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddCustomer}
        />
      )}

      {/* Customer Detail Modal */}
      {showDetailModal && selectedCustomer && (
        <CustomerDetailModal
          customer={selectedCustomer}
          onClose={() => setShowDetailModal(false)}
          onRedeemPoints={handleRedeemPoints}
        />
      )}
    </div>
  );
};

// Add Customer Modal Component
const AddCustomerModal = ({ onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    date_of_birth: '',
    membership_tier: 'bronze',
    notes: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.first_name || !formData.last_name) {
      window.toast?.error('First name and last name are required');
      return;
    }
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="pos-card max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Add New Customer</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="First Name *"
              value={formData.first_name}
              onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
              className="pos-input"
              required
            />
            <input
              type="text"
              placeholder="Last Name *"
              value={formData.last_name}
              onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
              className="pos-input"
              required
            />
          </div>

          <input
            type="email"
            placeholder="Email"
            value={formData.email}
            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
            className="pos-input w-full"
          />

          <input
            type="tel"
            placeholder="Phone"
            value={formData.phone}
            onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
            className="pos-input w-full"
          />

          <input
            type="date"
            placeholder="Date of Birth"
            value={formData.date_of_birth}
            onChange={(e) => setFormData(prev => ({ ...prev, date_of_birth: e.target.value }))}
            className="pos-input w-full"
          />

          <select
            value={formData.membership_tier}
            onChange={(e) => setFormData(prev => ({ ...prev, membership_tier: e.target.value }))}
            className="pos-input w-full"
          >
            <option value="bronze">Bronze</option>
            <option value="silver">Silver</option>
            <option value="gold">Gold</option>
            <option value="platinum">Platinum</option>
          </select>

          <textarea
            placeholder="Notes"
            value={formData.notes}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            className="pos-input w-full h-20"
          />

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="pos-button-secondary flex-1">
              Cancel
            </button>
            <button type="submit" className="pos-button flex-1">
              Add Customer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Customer Detail Modal Component
const CustomerDetailModal = ({ customer, onClose, onRedeemPoints }) => {
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [redeemAmount, setRedeemAmount] = useState('');
  const [redeemDescription, setRedeemDescription] = useState('');

  const handleRedeem = () => {
    const points = parseInt(redeemAmount);
    if (!points || points <= 0) {
      window.toast?.error('Please enter a valid points amount');
      return;
    }
    if (points > customer.loyalty_points) {
      window.toast?.error('Insufficient loyalty points');
      return;
    }
    onRedeemPoints(customer.id, points, redeemDescription);
    setShowRedeemModal(false);
    setRedeemAmount('');
    setRedeemDescription('');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="pos-card max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">
            {customer.first_name} {customer.last_name}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Customer Info */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Customer Information</h3>
            <div className="space-y-3">
              <div><span className="text-gray-400">Customer #:</span> {customer.customer_number}</div>
              <div><span className="text-gray-400">Email:</span> {customer.email || 'Not provided'}</div>
              <div><span className="text-gray-400">Phone:</span> {customer.phone || 'Not provided'}</div>
              <div><span className="text-gray-400">Membership:</span> 
                <span className={`ml-2 px-2 py-1 rounded text-xs ${customer.membership_tier === 'platinum' ? 'bg-purple-100 text-purple-800' : customer.membership_tier === 'gold' ? 'bg-yellow-100 text-yellow-800' : customer.membership_tier === 'silver' ? 'bg-gray-100 text-gray-800' : 'bg-amber-100 text-amber-800'}`}>
                  {customer.membership_tier.toUpperCase()}
                </span>
              </div>
              <div><span className="text-gray-400">Total Visits:</span> {customer.total_visits}</div>
              <div><span className="text-gray-400">Total Spent:</span> ${customer.total_spent}</div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Loyalty Points:</span>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-green-400">{customer.loyalty_points}</span>
                  <button
                    onClick={() => setShowRedeemModal(true)}
                    className="pos-button-secondary text-sm"
                    disabled={customer.loyalty_points === 0}
                  >
                    Redeem
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Recent Activity</h3>
            
            {/* Recent Visits */}
            <div className="mb-4">
              <h4 className="text-md font-medium text-gray-300 mb-2">Recent Visits</h4>
              {customer.recent_visits?.length > 0 ? (
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {customer.recent_visits.slice(0, 5).map((visit, index) => (
                    <div key={index} className="text-sm bg-gray-700 p-2 rounded">
                      <div className="flex justify-between">
                        <span>{new Date(visit.visit_date).toLocaleDateString()}</span>
                        <span>${visit.amount_spent}</span>
                      </div>
                      {visit.table_id && <div className="text-gray-400">Table: {visit.table_id}</div>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-sm">No recent visits</p>
              )}
            </div>

            {/* Loyalty Transactions */}
            <div>
              <h4 className="text-md font-medium text-gray-300 mb-2">Loyalty History</h4>
              {customer.loyalty_transactions?.length > 0 ? (
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {customer.loyalty_transactions.slice(0, 5).map((transaction, index) => (
                    <div key={index} className="text-sm bg-gray-700 p-2 rounded">
                      <div className="flex justify-between">
                        <span className={transaction.transaction_type === 'earned' ? 'text-green-400' : 'text-red-400'}>
                          {transaction.transaction_type === 'earned' ? '+' : '-'}{Math.abs(transaction.points)} pts
                        </span>
                        <span className="text-gray-400">{new Date(transaction.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="text-gray-400">{transaction.description}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-sm">No loyalty history</p>
              )}
            </div>
          </div>
        </div>

        {/* Redeem Points Modal */}
        {showRedeemModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
            <div className="pos-card max-w-md w-full mx-4">
              <h3 className="text-lg font-bold text-white mb-4">Redeem Loyalty Points</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-400 mb-2">Available Points: {customer.loyalty_points}</label>
                  <input
                    type="number"
                    placeholder="Points to redeem"
                    value={redeemAmount}
                    onChange={(e) => setRedeemAmount(e.target.value)}
                    max={customer.loyalty_points}
                    className="pos-input w-full"
                  />
                </div>
                <textarea
                  placeholder="Description (optional)"
                  value={redeemDescription}
                  onChange={(e) => setRedeemDescription(e.target.value)}
                  className="pos-input w-full h-20"
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowRedeemModal(false)}
                    className="pos-button-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRedeem}
                    className="pos-button flex-1"
                  >
                    Redeem Points
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerManagement;
