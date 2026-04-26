const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { verifyToken } = require('../middleware/auth');

// Protect all routes
router.use(verifyToken);

/**
 * POST /api/users/create-executive
 * Creates a new executive user reporting to the current industry manager
 */
router.post('/create-executive', async (req, res) => {
  try {
    const { name, email, phone, state, industry, probationEndDate, basicSalary, employeeId, reportingTo } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    const defaultPassword = 'RoadMateUser2026!';

    const newExecutive = new User({
      name,
      email,
      phone,
      password: defaultPassword,
      role: 'executive',
      reportingTo: reportingTo || req.user._id,
      state: state || req.user.state,
      industry: industry || req.user.industry,
      probationEndDate: probationEndDate ? new Date(probationEndDate) : null,
      basicSalary: basicSalary || 0,
      employeeId: employeeId || `EXEC-${Date.now().toString().slice(-6)}`
    });

    await newExecutive.save();

    const userResponse = newExecutive.toObject();
    delete userResponse.password;

    res.status(201).json(userResponse);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/**
 * GET /api/users - List users with filtering
 * Industry Managers see their reporting executives
 */
router.get('/', async (req, res) => {
  try {
    const query = {};
    
    if (req.user.role === 'industry_manager') {
      query.reportingTo = req.user._id;
    } else if (req.user.role === 'state_manager') {
      query.state = req.user.state;
    }

    const users = await User.find(query).select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * GET /api/users/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * POST /api/users/:id/documents - Upload document record (metadata only)
 */
router.post('/:id/documents', async (req, res) => {
  try {
    const { name, url, fileKey, size } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.documents.push({ 
      name, 
      url, 
      fileKey, // Store R2 key
      size,
      uploadedAt: new Date() 
    });
    await user.save();

    res.json(user.documents);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/**
 * POST /api/users/create-industry-manager
 * State Manager only
 */
router.post('/create-industry-manager', async (req, res) => {
  try {
    if (req.user.role !== 'state_manager' && req.user.role !== 'founder') {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const { name, email, phone, industry, workingHours, basicSalary, employeeId, reportingTo, state } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    const newIM = new User({
      name,
      email,
      phone,
      password: 'RoadMateIM2026!', 
      role: 'industry_manager',
      reportingTo: reportingTo || req.user._id,
      state: state || req.user.state,
      industry,
      workingHours: workingHours || { start: '09:30', end: '18:30' },
      basicSalary: basicSalary || 0,
      employeeId: employeeId || `IM-${Date.now().toString().slice(-6)}`
    });

    await newIM.save();
    res.status(201).json(newIM);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/**
 * PUT /api/users/:id
 * Update user profile/settings
 */
router.put('/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/**
 * POST /api/users/create-state-manager
 * Founder only
 */
router.post('/create-state-manager', async (req, res) => {
  try {
    if (req.user.role !== 'founder') {
      return res.status(403).json({ message: 'Forbidden: Founder only' });
    }

    const { name, email, phone, state, workingHours, basicSalary, employeeId } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    const newSM = new User({
      name,
      email,
      phone,
      password: 'RoadMateSM2026!',
      role: 'state_manager',
      state,
      workingHours: workingHours || { start: '09:30', end: '18:30' },
      basicSalary: basicSalary || 0,
      employeeId: employeeId || `SM-${Date.now().toString().slice(-6)}`
    });

    await newSM.save();
    res.status(201).json(newSM);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/**
 * DELETE /api/users/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    if (req.user.role !== 'founder' && req.user.role !== 'state_manager') {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
