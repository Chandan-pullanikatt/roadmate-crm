const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    lowercase: true,
    trim: true 
  },
  phone: { type: String, trim: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['founder', 'state_manager', 'industry_manager', 'executive'], 
    required: true 
  },
  employeeId: { type: String, unique: true },
  basicSalary: { type: Number, default: 0 },
  reportingTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  state: { type: String },
  district: { type: String },
  industry: { type: String },
  address: { type: String },
  employmentType: { type: String },
  isActive: { type: Boolean, default: true },
  workingHours: { 
    start: { type: String, default: '09:30' }, 
    end: { type: String, default: '18:30' } 
  },
  documents: [{ 
    name: String, 
    url: String, 
    fileKey: String,
    size: Number,
    contentType: String,
    uploadedAt: { type: Date, default: Date.now } 
  }],
  probationEndDate: { type: Date, default: null },
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  } catch (err) {
    throw err;
  }
});


// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Performance Indexes
userSchema.index({ role: 1 });
userSchema.index({ state: 1 });
userSchema.index({ industry: 1 });
userSchema.index({ isActive: 1 });

module.exports = mongoose.model('User', userSchema);
