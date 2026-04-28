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
    const {
      name,
      email,
      phone,
      state,
      district,
      industry,
      address,
      employmentType,
      password,
      probationEndDate,
      basicSalary,
      employeeId,
      reportingTo,
      aadhaarNumber,
      panNumber,
      dateOfJoining,
      documents = []
    } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    const newExecutive = new User({
      name,
      email,
      phone,
      password: password || 'RoadMateUser2026!',
      role: 'executive',
      reportingTo: reportingTo || req.user._id,
      state: state || req.user.state,
      district: district || '',
      industry: industry || req.user.industry,
      address: address || '',
      employmentType: employmentType || 'Full Time',
      probationEndDate: probationEndDate ? new Date(probationEndDate) : null,
      basicSalary: basicSalary || 0,
      employeeId: employeeId || `EXEC-${Date.now().toString().slice(-6)}`,
      aadhaarNumber,
      panNumber,
      dateOfJoining: dateOfJoining ? new Date(dateOfJoining) : null,
      documents
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
    const { role, search } = req.query;

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (req.user.role === 'industry_manager') {
      query.reportingTo = req.user._id;
    } else if (req.user.role === 'state_manager') {
      query.state = req.user.state;
    }

    if (role) {
      query.role = role;
    }

    const users = await User.find(query).select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * GET /api/users/hierarchy - Get hierarchy members related to the user
 */
router.get('/hierarchy', async (req, res) => {
  try {
    const { role, state, industry, reportingTo } = req.user;
    const hierarchy = {
      executives: [],
      industryManagers: [],
      stateManagers: []
    };

    if (role === 'executive') {
      // 1. Fellow Executives in the same state and industry
      hierarchy.executives = await User.find({
        role: 'executive',
        state,
        industry
      }).select('name role state industry avatar');

      // 2. Reporting Industry Manager
      if (reportingTo) {
        const im = await User.findById(reportingTo).select('name role state industry avatar reportingTo');
        if (im) {
          hierarchy.industryManagers = [im];
          
          // 3. State Manager (Manager of the Industry Manager)
          if (im.reportingTo) {
            const sm = await User.findById(im.reportingTo).select('name role state industry avatar');
            if (sm) hierarchy.stateManagers = [sm];
          }
        }
      }
    } else if (role === 'industry_manager') {
       // Similar logic for IM
       hierarchy.executives = await User.find({ reportingTo: req.user._id }).select('name role state industry avatar');
       hierarchy.industryManagers = [req.user];
       if (reportingTo) {
         const sm = await User.findById(reportingTo).select('name role state industry avatar');
         if (sm) hierarchy.stateManagers = [sm];
       }
    }

    res.json(hierarchy);
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
    const { name, url, fileKey, size, contentType } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.documents.push({ 
      name, 
      url, 
      fileKey,
      size,
      contentType,
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

    const {
      name,
      email,
      phone,
      industry,
      district,
      address,
      employmentType,
      workingHours,
      basicSalary,
      employeeId,
      reportingTo,
      state,
      aadhaarNumber,
      panNumber,
      dateOfJoining,
      documents = []
    } = req.body;
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
      district: district || '',
      industry,
      address: address || '',
      employmentType: employmentType || 'Full Time',
      workingHours: workingHours || { start: '09:30', end: '18:30' },
      basicSalary: basicSalary || 0,
      employeeId: employeeId || `IM-${Date.now().toString().slice(-6)}`,
      aadhaarNumber,
      panNumber,
      dateOfJoining: dateOfJoining ? new Date(dateOfJoining) : null,
      documents
    });

    await newIM.save();
    const userResponse = newIM.toObject();
    delete userResponse.password;
    res.status(201).json(userResponse);
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
    const { id } = req.params;
    const targetUser = await User.findById(id);
    if (!targetUser) return res.status(404).json({ message: 'User not found' });

    // Permissions check
    if (req.user.role === 'state_manager' && targetUser.state !== req.user.state) {
      return res.status(403).json({ message: 'Forbidden: You can only edit users in your state' });
    }
    
    if (req.user.role === 'industry_manager' && targetUser.reportingTo?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Forbidden: You can only edit your direct reports' });
    }

    // Prevent security sensitive field changes
    const updateData = { ...req.body };
    delete updateData.role;
    delete updateData.password;
    delete updateData.email; // Usually email should be immutable or handled via specific flow

    const user = await User.findByIdAndUpdate(id, updateData, { new: true }).select('-password');
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

    const {
      name,
      email,
      phone,
      state,
      district,
      address,
      employmentType,
      workingHours,
      basicSalary,
      employeeId,
      documents = []
    } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    const newSM = new User({
      name,
      email,
      phone,
      password: 'RoadMateSM2026!',
      role: 'state_manager',
      state,
      district: district || '',
      address: address || '',
      employmentType: employmentType || 'Full Time',
      workingHours: workingHours || { start: '09:30', end: '18:30' },
      basicSalary: basicSalary || 0,
      employeeId: employeeId || `SM-${Date.now().toString().slice(-6)}`,
      documents
    });

    await newSM.save();
    const userResponse = newSM.toObject();
    delete userResponse.password;
    res.status(201).json(userResponse);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/**
 * DELETE /api/users/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Only Founder and State Manager can delete
    if (req.user.role !== 'founder' && req.user.role !== 'state_manager') {
      return res.status(403).json({ message: 'Forbidden: Only Founder or State Manager can delete accounts' });
    }

    const targetUser = await User.findById(id);
    if (!targetUser) return res.status(404).json({ message: 'User not found' });

    // Rule: Must verify the target user is an executive
    if (targetUser.role !== 'executive') {
      return res.status(400).json({ message: 'Only Executive accounts can be deleted via this flow' });
    }

    // State Manager restriction
    if (req.user.role === 'state_manager' && targetUser.state !== req.user.state) {
      return res.status(403).json({ message: 'Forbidden: You can only delete executives in your state' });
    }

    // Check for assigned leads (Warning only, deletion proceeds)
    const leadCount = await Lead.countDocuments({ owner: id });
    
    await User.findByIdAndDelete(id);
    
    res.json({ 
      message: 'Executive deleted successfully',
      leadCount: leadCount,
      warning: leadCount > 0 ? `${leadCount} leads are now unassigned.` : null
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


module.exports = router;
