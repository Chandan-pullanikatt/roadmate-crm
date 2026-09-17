const mongoose = require('mongoose');

// Named atomic sequences, e.g. { _id: 'leadId:RMFOL', seq: 12 }.
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
}, { versionKey: false });

module.exports = mongoose.model('Counter', counterSchema);
