const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  description: { type: String, default: '' },
  assignedTo:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  startDate:   { type: Date, required: true },
  endDate:     { type: Date, required: true },
  startTime:   { type: String, default: '09:30' },
  endTime:     { type: String, default: '18:30' },
  priority:    { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  status:      { type: String, enum: ['pending', 'in_progress', 'completed', 'overdue'], default: 'pending' },
  category:    { type: String, default: '' },
  completedAt: { type: Date },
  notes:       { type: String, default: '' },
}, { timestamps: true });

taskSchema.index({ assignedTo: 1 });
taskSchema.index({ assignedBy: 1 });
taskSchema.index({ status: 1 });
taskSchema.index({ endDate: 1 });

module.exports = mongoose.model('Task', taskSchema);
