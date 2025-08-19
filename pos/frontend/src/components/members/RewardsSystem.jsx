/**
 * Rewards System Component
 * Comprehensive loyalty program management for billiards business
 */

import React, { useState } from 'react';
import api from '../../services/api';

const RewardsSystem = ({ member, onClose, onAwardPoints, onRedeemPoints, membershipTiers }) => {
  const [selectedReward, setSelectedReward] = useState(null);
  const [customPoints, setCustomPoints] = useState('');
  const [customReason, setCustomReason] = useState('');

  // Billiards-specific rewards catalog
  const rewards = [
    { 
      id: 'free_hour', 
      name: 'Free Hour of Table Time', 
      points: 100, 
      description: '1 hour of free billiards table time',
      category: 'table_time',
      icon: '🎱'
    },
    { 
      id: 'rack_rental', 
      name: 'Free Rack Rental', 
      points: 50, 
      description: 'Free rack rental for one session',
      category: 'equipment',
      icon: '🔺'
    },
    { 
      id: 'guest_pass', 
      name: 'Guest Pass', 
      points: 200, 
      description: 'Bring a friend for free',
      category: 'social',
      icon: '👥'
    },
    { 
      id: 'tournament_entry', 
      name: 'Tournament Entry', 
      points: 300, 
      description: 'Free entry to monthly tournament',
      category: 'events',
      icon: '🏆'
    },
    { 
      id: 'merchandise', 
      name: 'Merchandise Credit', 
      points: 150, 
      description: '$15 credit towards merchandise',
      category: 'retail',
      icon: '🛍️'
    },
    { 
      id: 'food_drink', 
      name: 'Food & Drink Credit', 
      points: 120, 
      description: '$12 credit for food and beverages',
      category: 'food',
      icon: '🍻'
    },
    { 
      id: 'vip_table', 
      name: 'VIP Table Access', 
      points: 400, 
      description: '2 hours on premium VIP table',
      category: 'premium',
      icon: '⭐'
    },
    { 
      id: 'birthday_special', 
      name: 'Birthday Special', 
      points: 250, 
      description: 'Free table time + drink on birthday',
      category: 'special',
      icon: '🎂'
    }
  ];

  // Quick point awards for common activities
  const quickAwards = [
    { points: 10, reason: 'Visit bonus', icon: '🎯' },
    { points: 25, reason: 'Game completion', icon: '✅' },
    { points: 50, reason: 'Tournament participation', icon: '🎮' },
    { points: 100, reason: 'Special achievement', icon: '🌟' },
    { points: 75, reason: 'Referral bonus', icon: '🤝' },
    { points: 30, reason: 'Social media share', icon: '📱' }
  ];

  const handleRedeemReward = async (reward) => {
    if (member.loyalty_points >= reward.points) {
      try {
        await onRedeemPoints(member.id, reward.points, reward.name);
        window.toast?.success(`Redeemed: ${reward.name}`);
        onClose();
      } catch (error) {
        window.toast?.error('Failed to redeem reward');
      }
    } else {
      const pointsNeeded = reward.points - member.loyalty_points;
      window.toast?.error(`Insufficient points. Need ${pointsNeeded} more points.`);
    }
  };

  const handleCustomAward = async () => {
    const points = parseInt(customPoints);
    if (points > 0 && customReason.trim()) {
      try {
        await onAwardPoints(member.id, points, customReason);
        setCustomPoints('');
        setCustomReason('');
        window.toast?.success(`Awarded ${points} points for ${customReason}`);
      } catch (error) {
        window.toast?.error('Failed to award points');
      }
    } else {
      window.toast?.error('Please enter valid points and reason');
    }
  };

  const getTierProgress = () => {
    const currentTierIndex = membershipTiers.findIndex(t => t.id === member.membership_tier);
    const nextTier = membershipTiers[currentTierIndex + 1];
    
    if (!nextTier) return null;
    
    const progress = (member.loyalty_points / nextTier.pointsRequired) * 100;
    const pointsNeeded = nextTier.pointsRequired - member.loyalty_points;
    
    return {
      nextTier,
      progress: Math.min(progress, 100),
      pointsNeeded: Math.max(pointsNeeded, 0)
    };
  };

  const tierProgress = getTierProgress();
  const currentTier = membershipTiers.find(t => t.id === member.membership_tier) || membershipTiers[0];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="pos-card max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-white">Rewards & Loyalty Program</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-6">
          {/* Member Points Summary */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-2xl font-bold text-white">{member.first_name} {member.last_name}</h3>
                <p className="text-blue-100">Member since {new Date(member.created_at).getFullYear()}</p>
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium mt-2 ${currentTier.color} text-white`}>
                  {currentTier.name} Member
                </span>
              </div>
              <div className="text-right">
                <p className="text-4xl font-bold text-white">{member.loyalty_points}</p>
                <p className="text-blue-100">Available Points</p>
              </div>
            </div>

            {/* Tier Progress */}
            {tierProgress && (
              <div className="mt-4">
                <div className="flex justify-between text-sm text-blue-100 mb-2">
                  <span>Progress to {tierProgress.nextTier.name}</span>
                  <span>{tierProgress.pointsNeeded} points needed</span>
                </div>
                <div className="w-full bg-blue-800 rounded-full h-3">
                  <div 
                    className="bg-white rounded-full h-3 transition-all duration-300"
                    style={{ width: `${tierProgress.progress}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quick Award Points */}
            <div>
              <h3 className="text-xl font-bold text-white mb-4">Quick Award Points</h3>
              <div className="grid grid-cols-2 gap-3 mb-6">
                {quickAwards.map((award, index) => (
                  <button
                    key={index}
                    onClick={() => onAwardPoints(member.id, award.points, award.reason)}
                    className="pos-button-secondary text-center p-4 hover:bg-green-600 transition-colors"
                  >
                    <div className="text-2xl mb-1">{award.icon}</div>
                    <div className="font-bold text-lg">+{award.points}</div>
                    <div className="text-sm">{award.reason}</div>
                  </button>
                ))}
              </div>

              {/* Custom Award */}
              <div className="pos-card p-4">
                <h4 className="font-bold text-white mb-3">Custom Award</h4>
                <div className="space-y-3">
                  <input
                    type="number"
                    placeholder="Points to award"
                    value={customPoints}
                    onChange={(e) => setCustomPoints(e.target.value)}
                    className="pos-input w-full"
                    min="1"
                  />
                  <input
                    type="text"
                    placeholder="Reason for award"
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    className="pos-input w-full"
                  />
                  <button
                    onClick={handleCustomAward}
                    className="pos-button w-full"
                  >
                    Award Custom Points
                  </button>
                </div>
              </div>
            </div>

            {/* Available Rewards */}
            <div>
              <h3 className="text-xl font-bold text-white mb-4">Available Rewards</h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {rewards.map((reward) => {
                  const canRedeem = member.loyalty_points >= reward.points;
                  return (
                    <div 
                      key={reward.id} 
                      className={`p-4 rounded-lg border transition-all ${
                        canRedeem 
                          ? 'border-green-500 bg-green-500/10 hover:bg-green-500/20' 
                          : 'border-gray-600 bg-gray-800'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{reward.icon}</span>
                          <div>
                            <h4 className="font-bold text-white">{reward.name}</h4>
                            <p className="text-gray-300 text-sm">{reward.description}</p>
                            <span className="text-xs text-gray-400 bg-gray-700 px-2 py-1 rounded mt-1 inline-block">
                              {reward.category.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-xl font-bold text-blue-400">{reward.points} pts</span>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleRedeemReward(reward)}
                        disabled={!canRedeem}
                        className={`w-full py-2 px-4 rounded transition-colors ${
                          canRedeem 
                            ? 'bg-green-600 hover:bg-green-700 text-white' 
                            : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        {canRedeem ? 'Redeem Now' : `Need ${reward.points - member.loyalty_points} more points`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Membership Benefits */}
          <div className="pos-card p-6">
            <h3 className="text-xl font-bold text-white mb-4">Membership Benefits</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {membershipTiers.map((tier) => {
                const isCurrentTier = tier.id === member.membership_tier;
                const isEligible = member.loyalty_points >= tier.pointsRequired;
                
                return (
                  <div 
                    key={tier.id}
                    className={`p-4 rounded-lg border ${
                      isCurrentTier 
                        ? 'border-blue-500 bg-blue-500/10' 
                        : isEligible 
                          ? 'border-green-500 bg-green-500/10' 
                          : 'border-gray-600 bg-gray-800'
                    }`}
                  >
                    <div className="text-center mb-3">
                      <span className={`px-3 py-1 rounded-full text-white text-sm font-medium ${tier.color}`}>
                        {tier.name}
                      </span>
                      {isCurrentTier && (
                        <div className="text-xs text-blue-400 mt-1">Current Tier</div>
                      )}
                    </div>
                    
                    <div className="text-center mb-3">
                      <div className="text-lg font-bold text-white">{tier.pointsRequired} pts</div>
                      <div className="text-xs text-gray-400">Required</div>
                    </div>
                    
                    <div className="space-y-1">
                      {tier.benefits.map((benefit, index) => (
                        <div key={index} className="text-xs text-gray-300 flex items-center gap-1">
                          <span className="text-green-400">✓</span>
                          {benefit}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RewardsSystem;
