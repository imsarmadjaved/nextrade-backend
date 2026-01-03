const mongoose = require('mongoose');

const adInteractionSchema = new mongoose.Schema({
    ad: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Ad',
        required: true
    },
    userIdentifier: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['impression', 'click'],
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Compound index for efficient queries
adInteractionSchema.index({ ad: 1, userIdentifier: 1, type: 1, date: 1 });
adInteractionSchema.index({ date: 1 });

module.exports = mongoose.model('AdInteraction', adInteractionSchema);
