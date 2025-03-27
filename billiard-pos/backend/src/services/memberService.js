const QRCode = require('qrcode');
const { Member } = require('../models');

async function generateQRCode(data) {
  try {
    return await QRCode.toDataURL(data);
  } catch (err) {
    console.error('QR generation error:', err);
    return null;
  }
}

async function addMemberPoints(memberId, points) {
  const member = await Member.findByPk(memberId);
  if (!member) {
    throw new Error('Member not found');
  }

  await member.increment('points_balance', { by: points });
  await checkAndUpdateTier(member);
  
  return Member.findByPk(memberId);
}

async function checkAndUpdateTier(member) {
  const points = member.points_balance;
  let newTier = 'bronze';

  if (points >= 1000) {
    newTier = 'gold';
  } else if (points >= 500) {
    newTier = 'silver';
  }

  if (newTier !== member.membership_tier) {
    await member.update({ membership_tier: newTier });
  }
}

module.exports = { generateQRCode, addMemberPoints, checkAndUpdateTier };
