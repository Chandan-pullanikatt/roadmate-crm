const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const Task = require('../models/Task');

router.use(verifyToken);

// GET /api/tasks — list tasks visible to the current user
router.get('/', async (req, res) => {
  try {
    const { status, assignedTo, limit = 50, page = 1 } = req.query;
    const query = {};

    // Role scoping: executives/managers see tasks assigned to them + tasks they created
    if (req.user.role === 'executive') {
      query.assignedTo = req.user._id;
    } else {
      query.$or = [{ assignedBy: req.user._id }, { assignedTo: req.user._id }];
    }

    if (status) query.status = status;
    if (assignedTo) query.assignedTo = assignedTo;

    const tasks = await Task.find(query)
      .populate('assignedTo', 'name role state industry')
      .populate('assignedBy', 'name role')
      .sort({ endDate: 1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Task.countDocuments(query);

    // Auto-mark overdue
    const now = new Date();
    const toUpdate = tasks.filter(t => t.status === 'pending' && new Date(t.endDate) < now);
    if (toUpdate.length) {
      await Task.updateMany({ _id: { $in: toUpdate.map(t => t._id) } }, { status: 'overdue' });
      toUpdate.forEach(t => { t.status = 'overdue'; });
    }

    res.json({ tasks, total, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/tasks — create task
router.post('/', async (req, res) => {
  try {
    if (!['founder', 'state_manager', 'industry_manager'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden: Only managers can create tasks' });
    }
    const task = await Task.create({ ...req.body, assignedBy: req.user._id });
    const populated = await task.populate('assignedTo', 'name role');
    res.status(201).json(populated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT /api/tasks/:id — update task
router.put('/:id', async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    // Only creator or assignee can update
    const isCreator  = task.assignedBy.toString() === req.user._id.toString();
    const isAssignee = task.assignedTo.toString() === req.user._id.toString();
    if (!isCreator && !isAssignee) return res.status(403).json({ message: 'Forbidden' });

    Object.assign(task, req.body);
    await task.save();
    res.json(task);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PATCH /api/tasks/:id/complete — mark as completed
router.patch('/:id/complete', async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    task.status = 'completed';
    task.completedAt = new Date();
    if (req.body.notes) task.notes = req.body.notes;
    await task.save();
    res.json(task);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (task.assignedBy.toString() !== req.user._id.toString() && req.user.role !== 'founder') {
      return res.status(403).json({ message: 'Forbidden: Only the creator can delete' });
    }
    await task.deleteOne();
    res.json({ message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
