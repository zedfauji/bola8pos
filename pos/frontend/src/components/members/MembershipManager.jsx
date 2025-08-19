/**
 * Member/Loyalty Program Manager
 * Enhanced customer management for billiards business
 */

import React, { useState, useEffect } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import api from '../../services/api';
import RewardsSystem from './RewardsSystem';

const MembershipManager = () => {
  const { checkAccess } = useSettings();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTier, setFilterTier] = useState('');
  const [selectedMember, setSelectedMember] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRewardsModal, setShowRewardsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [stats, setStats] = useState({
    totalMembers: 0,
    activeMembers: 0,
    totalPointsIssued: 0,
    totalPointsRedeemed: 0
  });

  // Membership tiers for billiards business
  const membershipTiers = [
    { id: 'bronze', name: 'Bronze', color: 'bg-amber-600', pointsRequired: 0, benefits: ['5% discount on table time'] },
    { id: 'silver', name: 'Silver', color: 'bg-gray-400', pointsRequired: 500, benefits: ['10% discount', 'Priority booking'] },
    { id: 'gold', name: 'Gold', color: 'bg-yellow-500', pointsRequired: 1000, benefits: ['15% discount', 'Free rack rental', 'Birthday bonus'] },
    { id: 'platinum', name: 'Platinum', color: 'bg-purple-600', pointsRequired: 2500, benefits: ['20% discount', 'VIP table access', 'Guest passes'] }
  ];

  // Check access permissions
  useEffect(() => {
    if (!checkAccess('customers', 'read')) {
      window.toast?.error('Access denied: Member management requires permission');
      return;
    }
    fetchMembers();
    fetchStats();
  }, [searchTerm, filterTier, pagination.page]);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        search: searchTerm,
        tier: filterTier,
        active: 'true'
      });

      const data = await api.request(`/api/customers?${params}`);
      
      if (data.customers) {
        setMembers(data.customers);
        setPagination(prev => ({ ...prev, total: data.pagination?.total || 0 }));
      } else {
        window.toast?.error(data.error || 'Failed to fetch members');
      }
    } catch (error) {
      console.error('Error fetching members:', error);
      window.toast?.error('Failed to fetch members');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const data = await api.request('/api/customers/stats');
      if (data && !data.error) {
        // Normalize backend snake_case to frontend camelCase
        setStats({
          totalMembers: data.total_members ?? data.totalCustomers ?? data.totalMembers ?? 0,
          activeMembers: data.active_members ?? data.activeCustomers ?? data.activeMembers ?? 0,
          totalPointsIssued: data.points_issued ?? data.total_points_issued ?? data.totalPointsIssued ?? 0,
          totalPointsRedeemed: data.points_redeemed ?? data.total_points_redeemed ?? data.totalPointsRedeemed ?? 0,
        });
      }
    } catch (error) {
      console.error('Error fetching member stats:', error);
    }
  };

  const handleMemberClick = async (member) => {
    try {
      const data = await api.request(`/api/customers/${member.id}`);
      
      if (data && !data.error) {
        setSelectedMember(data);
        setShowDetailModal(true);
      } else {
        window.toast?.error(data.error || 'Failed to fetch member details');
      }
    } catch (error) {
      console.error('Error fetching member details:', error);
      window.toast?.error('Failed to fetch member details');
    }
  };

  const handleAddMember = async (memberData) => {
    if (!checkAccess('customers', 'create')) {
      window.toast?.error('Access denied: Cannot create members');
      return;
    }

    try {
      const data = await api.request('/api/customers', {
        method: 'POST',
        body: JSON.stringify({
          ...memberData,
          membership_tier: 'bronze',
          loyalty_points: 0,
          total_visits: 0,
          total_spent: 0
        })
      });

      if (data && !data.error) {
        window.toast?.success('Member created successfully');
        setShowAddModal(false);
        fetchMembers();
        fetchStats();
      } else {
        window.toast?.error(data.error || 'Failed to create member');
      }
    } catch (error) {
      console.error('Error creating member:', error);
      window.toast?.error('Failed to create member');
    }
  };

  const handleEditMember = async (memberData) => {
    if (!checkAccess('customers', 'update')) {
      window.toast?.error('Access denied: Cannot edit members');
      return;
    }

    try {
      const data = await api.request(`/api/customers/${selectedMember.id}`, {
        method: 'PUT',
        body: JSON.stringify(memberData)
      });

      if (data && !data.error) {
        window.toast?.success('Member updated successfully');
        setShowEditModal(false);
        fetchMembers();
        if (selectedMember) {
          handleMemberClick({ id: selectedMember.id });
        }
      } else {
        window.toast?.error(data.error || 'Failed to update member');
      }
    } catch (error) {
      console.error('Error updating member:', error);
      window.toast?.error('Failed to update member');
    }
  };

  const handleAwardPoints = async (memberId, points, reason) => {
    if (!checkAccess('customers', 'update')) {
      window.toast?.error('Access denied: Cannot award points');
      return;
    }

    try {
      const data = await api.request(`/api/customers/${memberId}/points`, {
        method: 'POST',
        body: JSON.stringify({ points, reason, type: 'award' })
      });

      if (data && !data.error) {
        window.toast?.success(`Awarded ${points} points successfully`);
        fetchMembers();
        fetchStats();
        if (selectedMember && selectedMember.id === memberId) {
          handleMemberClick({ id: memberId });
        }
      } else {
        window.toast?.error(data.error || 'Failed to award points');
      }
    } catch (error) {
      console.error('Error awarding points:', error);
      window.toast?.error('Failed to award points');
    }
  };

  const handleRedeemPoints = async (memberId, points, reward) => {
    if (!checkAccess('customers', 'update')) {
      window.toast?.error('Access denied: Cannot redeem points');
      return;
    }

    try {
      const data = await api.request(`/api/customers/${memberId}/points`, {
        method: 'POST',
        body: JSON.stringify({ points: -points, reason: reward, type: 'redeem' })
      });

      if (data && !data.error) {
        window.toast?.success(`Redeemed ${points} points for ${reward}`);
        fetchMembers();
        fetchStats();
        if (selectedMember && selectedMember.id === memberId) {
          handleMemberClick({ id: memberId });
        }
      } else {
        window.toast?.error(data.error || 'Failed to redeem points');
      }
    } catch (error) {
      console.error('Error redeeming points:', error);
      window.toast?.error('Failed to redeem points');
    }
  };

  const getTierInfo = (tier) => {
    return membershipTiers.find(t => t.id === tier) || membershipTiers[0];
  };

  const getNextTier = (currentTier, points) => {
    const currentTierIndex = membershipTiers.findIndex(t => t.id === currentTier);
    const nextTier = membershipTiers[currentTierIndex + 1];
    if (nextTier && points < nextTier.pointsRequired) {
      return {
        tier: nextTier,
        pointsNeeded: nextTier.pointsRequired - points
      };
    }
    return null;
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Member & Loyalty Program</h1>
          <p className="text-gray-300">Manage members, track loyalty points, and reward frequent players</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="pos-button"
        >
          + Add New Member
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="pos-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-300 mb-1">Total Members</p>
              <p className="text-3xl font-bold text-white">{stats.totalMembers}</p>
            </div>
            <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center text-2xl">
              👥
            </div>
          </div>
        </div>

        <div className="pos-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-300 mb-1">Active Members</p>
              <p className="text-3xl font-bold text-white">{stats.activeMembers}</p>
            </div>
            <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center text-2xl">
              ⭐
            </div>
          </div>
        </div>

        <div className="pos-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-300 mb-1">Points Issued</p>
              <p className="text-3xl font-bold text-white">{stats.totalPointsIssued?.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center text-2xl">
              🎁
            </div>
          </div>
        </div>

        <div className="pos-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-300 mb-1">Points Redeemed</p>
              <p className="text-3xl font-bold text-white">{stats.totalPointsRedeemed?.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center text-2xl">
              🏆
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="pos-card p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            type="text"
            placeholder="Search members..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pos-input"
          />
          <select
            value={filterTier}
            onChange={(e) => setFilterTier(e.target.value)}
            className="pos-input"
          >
            <option value="">All Tiers</option>
            {membershipTiers.map(tier => (
              <option key={tier.id} value={tier.id}>{tier.name}</option>
            ))}
          </select>
          <button
            onClick={() => {
              setSearchTerm('');
              setFilterTier('');
            }}
            className="pos-button-secondary"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Members List */}
      <div className="pos-card">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Members</h2>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
            <p className="text-gray-300 mt-4">Loading members...</p>
          </div>
        ) : members.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-300">No members found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-gray-300">Member</th>
                  <th className="px-4 py-3 text-left text-gray-300">Tier</th>
                  <th className="px-4 py-3 text-left text-gray-300">Points</th>
                  <th className="px-4 py-3 text-left text-gray-300">Visits</th>
                  <th className="px-4 py-3 text-left text-gray-300">Total Spent</th>
                  <th className="px-4 py-3 text-left text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const tierInfo = getTierInfo(member.membership_tier);
                  const nextTier = getNextTier(member.membership_tier, member.loyalty_points);
                  
                  return (
                    <tr key={member.id} className="border-b border-gray-700 hover:bg-gray-800">
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-medium text-white">
                            {member.first_name} {member.last_name}
                          </div>
                          <div className="text-sm text-gray-400">{member.email}</div>
                          <div className="text-sm text-gray-400">{member.customer_number}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-white text-sm ${tierInfo.color}`}>
                          {tierInfo.name}
                        </span>
                        {nextTier && (
                          <div className="text-xs text-gray-400 mt-1">
                            {nextTier.pointsNeeded} pts to {nextTier.tier.name}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-white">{member.loyalty_points}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-white">{member.total_visits}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-white">${Number(member.total_spent ?? 0).toFixed(2)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleMemberClick(member)}
                            className="text-blue-400 hover:text-blue-300 text-sm"
                          >
                            View
                          </button>
                          <button
                            onClick={() => {
                              setSelectedMember(member);
                              setShowEditModal(true);
                            }}
                            className="text-yellow-400 hover:text-yellow-300 text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              setSelectedMember(member);
                              setShowRewardsModal(true);
                            }}
                            className="text-green-400 hover:text-green-300 text-sm"
                          >
                            Rewards
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddModal && (
        <AddMemberModal
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddMember}
        />
      )}

      {showDetailModal && selectedMember && (
        <MemberDetailModal
          member={selectedMember}
          onClose={() => setShowDetailModal(false)}
        />
      )}

      {showEditModal && selectedMember && (
        <EditMemberModal
          member={selectedMember}
          onClose={() => setShowEditModal(false)}
          onSubmit={handleEditMember}
        />
      )}

      {showRewardsModal && selectedMember && (
        <RewardsSystem
          member={selectedMember}
          onClose={() => setShowRewardsModal(false)}
          onAwardPoints={handleAwardPoints}
          onRedeemPoints={handleRedeemPoints}
          membershipTiers={membershipTiers}
        />
      )}
    </div>
  );
};

// Add Member Modal Component
const AddMemberModal = ({ onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    date_of_birth: '',
    address: '',
    emergency_contact: '',
    notes: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.first_name || !formData.last_name) {
      window.toast?.error('Please fill in required fields');
      return;
    }
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="pos-card max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Add New Member</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="email"
              placeholder="Email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className="pos-input"
            />
            <input
              type="tel"
              placeholder="Phone"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              className="pos-input"
            />
          </div>

          <input
            type="date"
            placeholder="Date of Birth"
            value={formData.date_of_birth}
            onChange={(e) => setFormData(prev => ({ ...prev, date_of_birth: e.target.value }))}
            className="pos-input w-full"
          />

          <input
            type="text"
            placeholder="Address"
            value={formData.address}
            onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
            className="pos-input w-full"
          />

          <input
            type="text"
            placeholder="Emergency Contact"
            value={formData.emergency_contact}
            onChange={(e) => setFormData(prev => ({ ...prev, emergency_contact: e.target.value }))}
            className="pos-input w-full"
          />

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
              Add Member
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Edit Member Modal Component
const EditMemberModal = ({ member, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    first_name: member.first_name || '',
    last_name: member.last_name || '',
    email: member.email || '',
    phone: member.phone || '',
    date_of_birth: member.date_of_birth || '',
    address: member.address || '',
    emergency_contact: member.emergency_contact || '',
    notes: member.notes || '',
    membership_tier: member.membership_tier || 'bronze',
    is_active: member.is_active !== false
  });

  const membershipTiers = [
    { id: 'bronze', name: 'Bronze' },
    { id: 'silver', name: 'Silver' },
    { id: 'gold', name: 'Gold' },
    { id: 'platinum', name: 'Platinum' }
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.first_name || !formData.last_name) {
      window.toast?.error('Please fill in required fields');
      return;
    }
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="pos-card max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Edit Member</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="email"
              placeholder="Email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className="pos-input"
            />
            <input
              type="tel"
              placeholder="Phone"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              className="pos-input"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="date"
              placeholder="Date of Birth"
              value={formData.date_of_birth}
              onChange={(e) => setFormData(prev => ({ ...prev, date_of_birth: e.target.value }))}
              className="pos-input"
            />
            <select
              value={formData.membership_tier}
              onChange={(e) => setFormData(prev => ({ ...prev, membership_tier: e.target.value }))}
              className="pos-input"
            >
              {membershipTiers.map(tier => (
                <option key={tier.id} value={tier.id}>{tier.name}</option>
              ))}
            </select>
          </div>

          <input
            type="text"
            placeholder="Address"
            value={formData.address}
            onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
            className="pos-input w-full"
          />

          <input
            type="text"
            placeholder="Emergency Contact"
            value={formData.emergency_contact}
            onChange={(e) => setFormData(prev => ({ ...prev, emergency_contact: e.target.value }))}
            className="pos-input w-full"
          />

          <textarea
            placeholder="Notes"
            value={formData.notes}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            className="pos-input w-full h-20"
          />

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
              className="w-4 h-4"
            />
            <label htmlFor="is_active" className="text-white">Active Member</label>
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="pos-button-secondary flex-1">
              Cancel
            </button>
            <button type="submit" className="pos-button flex-1">
              Update Member
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Member Detail Modal Component
const MemberDetailModal = ({ member, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="pos-card max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Member Details</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-bold text-white mb-3">Personal Information</h3>
              <div className="space-y-2">
                <p className="text-gray-300"><span className="font-medium">Name:</span> {member.first_name} {member.last_name}</p>
                <p className="text-gray-300"><span className="font-medium">Email:</span> {member.email || 'Not provided'}</p>
                <p className="text-gray-300"><span className="font-medium">Phone:</span> {member.phone || 'Not provided'}</p>
                <p className="text-gray-300"><span className="font-medium">Member #:</span> {member.customer_number}</p>
                <p className="text-gray-300"><span className="font-medium">Joined:</span> {new Date(member.created_at).toLocaleDateString()}</p>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold text-white mb-3">Membership Status</h3>
              <div className="space-y-2">
                <p className="text-gray-300"><span className="font-medium">Tier:</span> {member.membership_tier}</p>
                <p className="text-gray-300"><span className="font-medium">Points:</span> {member.loyalty_points}</p>
                <p className="text-gray-300"><span className="font-medium">Total Visits:</span> {member.total_visits}</p>
                <p className="text-gray-300"><span className="font-medium">Total Spent:</span> ${member.total_spent?.toFixed(2) || '0.00'}</p>
                <p className="text-gray-300"><span className="font-medium">Status:</span> {member.is_active ? 'Active' : 'Inactive'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MembershipManager;
