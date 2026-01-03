const mongoose = require("mongoose");

const cartSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true
        },
        products: [
            {
                product: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Product",
                    required: true
                },
                quantity: {
                    type: Number,
                    required: true,
                    min: 1,
                    default: 1
                },
                unitPrice: Number,
                finalPrice: Number,
                appliedTier: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "BulkPricingTier"
                },
                discountAmount: Number
            }
        ]
    },
    { timestamps: true }
);

module.exports = mongoose.model('Cart', cartSchema);
