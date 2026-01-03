const mongoose = require("mongoose");

const bulkPricingTierSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true
    },
    minQuantity: {
        type: Number,
        required: true,
        min: 2
    },
    discountType: {
        type: String,
        enum: ["percentage", "fixed"],
        required: true
    },
    discountValue: {
        type: Number,
        required: true,
        min: 0
    },
    calculatedPrice: {
        type: Number
    }
}, { timestamps: true });

bulkPricingTierSchema.index({ product: 1, minQuantity: 1 });

module.exports = mongoose.model("BulkPricingTier", bulkPricingTierSchema);
