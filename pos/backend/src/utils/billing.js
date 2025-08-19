/**
 * Calculate the cost of a table session
 * @param {Object} session - The table session object
 * @param {Date} endTime - Optional end time (defaults to now for active sessions)
 * @returns {Object} Object containing totalMinutes, cost, and freeMinutesUsed
 */
function calculateSessionCost(session, endTime = new Date()) {
  // If session is already ended, use its stored values
  if (session.status === 'ended' && session.endTime) {
    return {
      totalMinutes: Math.round((new Date(session.endTime) - new Date(session.startTime)) / (1000 * 60)),
      cost: session.totalAmount,
      freeMinutesUsed: session.freeMinutesUsed || 0,
    };
  }

  // Calculate total session duration in minutes (excluding paused time)
  const startTime = new Date(session.startTime);
  const pausedDuration = session.totalPausedTime || 0; // in ms
  
  // Adjust end time if session is paused
  const effectiveEndTime = session.status === 'paused' && session.pauseStartTime
    ? new Date(session.pauseStartTime)
    : new Date(endTime);
  
  const totalMs = effectiveEndTime - startTime - pausedDuration;
  let totalMinutes = Math.max(0, Math.ceil(totalMs / (1000 * 60)));
  
  // Apply minimum duration if specified in tariff
  const minDuration = session.tariff?.minDuration || 0;
  if (minDuration > 0 && totalMinutes < minDuration) {
    totalMinutes = minDuration;
  }
  
  // Apply maximum duration if specified in tariff
  const maxDuration = session.tariff?.maxDuration;
  if (maxDuration && totalMinutes > maxDuration) {
    totalMinutes = maxDuration;
  }
  
  // Calculate free minutes
  const freeMinutes = Math.min(
    session.tariff?.freeMinutes || 0,
    totalMinutes
  );
  
  // Calculate billable minutes
  const billableMinutes = Math.max(0, totalMinutes - freeMinutes);
  
  // Calculate cost based on rate type
  let cost = 0;
  const rate = parseFloat(session.tariff?.rate || 0);
  
  switch (session.tariff?.rateType) {
    case 'fixed':
      // Fixed rate for the entire session
      cost = rate;
      break;
      
    case 'session':
      // Rate per session (regardless of duration)
      cost = rate * Math.ceil(billableMinutes / (60 * 24)); // Assuming 1 day per session
      break;
      
    case 'hourly':
    default:
      // Default to hourly rate
      const hours = Math.ceil(billableMinutes / 60);
      cost = rate * hours;
      
      // Apply tiered rates if available
      if (Array.isArray(session.tariff?.tieredRates) && session.tariff.tieredRates.length > 0) {
        cost = applyTieredRates(billableMinutes, session.tariff.tieredRates);
      }
      break;
  }
  
  // Apply any additional services
  const servicesTotal = calculateServicesTotal(session);
  cost += servicesTotal;
  
  // Apply any discounts
  const discountTotal = calculateDiscountsTotal(session);
  cost = Math.max(0, cost - discountTotal);
  
  return {
    totalMinutes,
    cost: parseFloat(cost.toFixed(2)),
    freeMinutesUsed: freeMinutes,
  };
}

/**
 * Apply tiered rates to calculate cost
 * @param {number} totalMinutes - Total billable minutes
 * @param {Array} tiers - Array of tiered rate objects
 * @returns {number} Calculated cost
 */
function applyTieredRates(totalMinutes, tiers) {
  // Sort tiers by fromMinute (just in case)
  const sortedTiers = [...tiers].sort((a, b) => a.fromMinute - b.fromMinute);
  
  let remainingMinutes = totalMinutes;
  let totalCost = 0;
  
  for (let i = 0; i < sortedTiers.length; i++) {
    const tier = sortedTiers[i];
    const nextTier = sortedTiers[i + 1];
    
    // If this is the last tier or no more minutes, use this tier's rate for all remaining minutes
    if (!nextTier || remainingMinutes <= 0) {
      totalCost += (remainingMinutes / 60) * tier.rate;
      break;
    }
    
    // Calculate minutes in this tier
    const minutesInTier = Math.min(
      nextTier.fromMinute - tier.fromMinute,
      remainingMinutes
    );
    
    if (minutesInTier > 0) {
      totalCost += (minutesInTier / 60) * tier.rate;
      remainingMinutes -= minutesInTier;
    }
  }
  
  return totalCost;
}

/**
 * Calculate total cost of additional services
 * @param {Object} session - The table session object
 * @returns {number} Total cost of services
 */
function calculateServicesTotal(session) {
  if (!session.metadata?.services || !Array.isArray(session.metadata.services)) {
    return 0;
  }
  
  return session.metadata.services.reduce((total, service) => {
    const price = parseFloat(service.price || 0);
    const quantity = parseInt(service.quantity || 1, 10);
    return total + (price * quantity);
  }, 0);
}

/**
 * Calculate total discount amount
 * @param {Object} session - The table session object
 * @returns {number} Total discount amount
 */
function calculateDiscountsTotal(session) {
  if (!session.metadata?.discounts || !Array.isArray(session.metadata.discounts)) {
    return 0;
  }
  
  return session.metadata.discounts.reduce((total, discount) => {
    if (discount.amount) {
      return total + parseFloat(discount.amount);
    }
    return total;
  }, 0);
}

module.exports = {
  calculateSessionCost,
  applyTieredRates,
  calculateServicesTotal,
  calculateDiscountsTotal,
};
