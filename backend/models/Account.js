const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    type: { type: String, enum: ['رئيسي', 'فرعي'], default: 'فرعي' },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', default: null },
    notes: { type: String },
    active: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Account', accountSchema); 