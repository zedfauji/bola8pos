const authService = require('../services/auth.service');

const login = async (req, res) => {
  try {
    const { email, pinCode } = req.body;
    
    if (!email || !pinCode) {
      return res.status(400).json({ 
        success: false,
        message: 'Email and PIN code are required' 
      });
    }

    const result = await authService.login(email, pinCode);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(401).json({ 
      success: false,
      message: error.message || 'Login failed' 
    });
  }
};

module.exports = { login };
