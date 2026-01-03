const mongoose = require("mongoose");

const pricingSchema = new mongoose.Schema({
    duration: {
        type: Number,
        required: true,
        unique: true
    },
    price: {
        type: Number,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

module.exports = mongoose.model("Pricing", pricingSchema);
