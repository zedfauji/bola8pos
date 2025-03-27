const authService = require('../services/auth.service');

exports.login = async (req, res, next) => {
  try {
    const { email, pin } = req.body;
    if (!email || !pin) {
      return res.status(400).json({ error: 'Email and PIN are required' });
    }
    
    const result = await authService.login(email, pin);
    res.json(result);
  } catch (error) {
    next(error);
  }
};
