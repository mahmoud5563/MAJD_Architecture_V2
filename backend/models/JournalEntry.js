const mongoose = require('mongoose');

const journalEntrySchema = new mongoose.Schema({
    date: { type: Date, required: true },
    description: { type: String, required: true },
    attachment: { type: String }, // اسم الملف أو المسار
    lines: [{ type: mongoose.Schema.Types.ObjectId, ref: 'JournalEntryLine' }]
}, { timestamps: true });

module.exports = mongoose.model('JournalEntry', journalEntrySchema); 