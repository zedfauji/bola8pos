const { Member } = require('../models');

async function calculateTimeCharge(hourlyRate, minutes, memberId = null) {
  const hours = minutes / 60;
  let baseAmount = hourlyRate * hours;
  let discountAmount = 0;

  if (memberId) {
    const member = await Member.findByPk(memberId);
    if (member) {
      // Apply membership discount
      let discountPercentage = 0;
      switch (member.membership_tier) {
        case 'silver':
          discountPercentage = 0.10;
          break;
        case 'gold':
          discountPercentage = 0.15;
          break;
      }

      discountAmount = baseAmount * discountPercentage;
      baseAmount -= discountAmount;

      // Deduct free hours if available
      if (member.free_hours_balance > 0) {
        const freeHoursToUse = Math.min(member.free_hours_balance, hours);
        const freeAmount = freeHoursToUse * hourlyRate;
        discountAmount += freeAmount;
        baseAmount -= freeAmount;

        // Update member's free hours balance
        await member.decrement('free_hours_balance', { by: freeHoursToUse });
      }
    }
  }

  return {
    totalAmount: parseFloat(baseAmount.toFixed(2)),
    discountAmount: parseFloat(discountAmount.toFixed(2))
  };
}

module.exports = { calculateTimeCharge };
