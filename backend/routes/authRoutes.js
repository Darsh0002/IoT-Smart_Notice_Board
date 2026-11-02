const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { protect } = require('../middleware/auth');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'supersecret_ble_notice_board_jwt_key_2026', {
    expiresIn: '30d',
  });
};

// @route   POST /api/auth/register
// @desc    Register a new admin user
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, fullName } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields' });
    }

    const userExists = await User.findOne({ $or: [{ email }, { username }] });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User with this email or username already exists' });
    }

    const user = await User.create({
      username,
      email,
      password,
      fullName: fullName || 'Notice Administrator',
      role: 'admin',
    });

    await AuditLog.create({
      action: 'ADMIN_LOGIN',
      user: user.username,
      details: `New admin account registered: ${user.username}`,
    });

    res.status(201).json({
      success: true,
      data: {
        _id: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        token: generateToken(user._id),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/auth/login
// @desc    Authenticate admin & return token
router.post('/login', async (req, res) => {
  try {
    const { usernameOrEmail, password } = req.body;

    if (!usernameOrEmail || !password) {
      return res.status(400).json({ success: false, message: 'Please provide username/email and password' });
    }

    const user = await User.findOne({
      $or: [{ email: usernameOrEmail.toLowerCase() }, { username: usernameOrEmail.toLowerCase() }],
    });

    if (user && (await user.matchPassword(password))) {
      await AuditLog.create({
        action: 'ADMIN_LOGIN',
        user: user.username,
        details: `Admin ${user.username} successfully logged in`,
      });

      res.json({
        success: true,
        data: {
          _id: user._id,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          token: generateToken(user._id),
        },
      });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials. Please check your username and password.' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/auth/demo-login
// @desc    Quick demo login for easy testing
router.post('/demo-login', async (req, res) => {
  try {
    let user = await User.findOne({ username: 'admin' });
    if (!user) {
      user = await User.create({
        username: 'admin',
        email: 'admin@noticeboard.iot',
        password: 'adminpassword123',
        fullName: 'BLE Board Admin',
        role: 'admin',
      });
    }

    res.json({
      success: true,
      data: {
        _id: user._id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        token: generateToken(user._id),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user profile
router.get('/me', protect, async (req, res) => {
  res.json({
    success: true,
    data: req.user,
  });
});

module.exports = router;
