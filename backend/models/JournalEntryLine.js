const mongoose = require('mongoose');

const journalEntryLineSchema = new mongoose.Schema({
    entry: { type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntry', required: true },
    account: { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
    debit: { type: Number, default: 0 },
    credit: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    taxType: { type: String, enum: ['percent', 'fixed'], default: 'percent' }
}, { timestamps: true });

module.exports = mongoose.model('JournalEntryLine', journalEntryLineSchema); 