const { Member, TableSession } = require('../models');
const { generateQRCode, addMemberPoints, checkAndUpdateTier } = require('../services/memberService');

exports.createMember = async (req, res) => {
  try {
    const { name, email, phone, membership_tier } = req.body;
    
    const qrCode = await generateQRCode(email);
    
    const member = await Member.create({
      name,
      email,
      phone,
      membership_tier: membership_tier || 'bronze',
      qr_code: qrCode
    });

    res.status(201).json(member);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getMemberById = async (req, res) => {
  try {
    const member = await Member.findByPk(req.params.id, {
      include: [TableSession]
    });
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }
    res.json(member);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getMemberByQR = async (req, res) => {
  try {
    const member = await Member.findOne({ 
      where: { qr_code: req.params.qrCode },
      include: [TableSession]
    });
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }
    res.json(member);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateMemberTier = async (req, res) => {
  try {
    const member = await Member.findByPk(req.params.id);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const { membership_tier } = req.body;
    await member.update({ membership_tier });
    
    res.json(member);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.addMemberPoints = async (req, res) => {
  try {
    const member = await Member.findByPk(req.params.id);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const { points } = req.body;
    await addMemberPoints(member.id, points);
    
    res.json(await Member.findByPk(req.params.id));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getMemberSessions = async (req, res) => {
  try {
    const sessions = await TableSession.findAll({
      where: { member_id: req.params.id },
      order: [['start_time', 'DESC']]
    });
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
