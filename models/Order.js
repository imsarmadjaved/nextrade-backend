const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        items: [
            {
                product: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Product",
                    required: true
                },
                quantity: {
                    type: Number,
                    required: true,
                    min: 1
                },
                unitPrice: Number,
                finalPrice: Number,
                appliedTier: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "BulkPricingTier"
                },
                discountAmount: Number
            }
        ],
        totalAmount: {
            type: Number,
            required: true
        },
        status: {
            type: String,
            enum: ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"],
            default: "Pending"
        },
        shippingAddress: {
            fullName: {
                type: String,
                required: true
            },
            email: {
                type: String,
                required: true
            },
            phone: {
                type: String,
                required: true
            },
            address: {
                type: String,
                required: true
            },
            city: {
                type: String,
                required: true
            },
            postalCode: {
                type: String
            }
        },
        paymentMethod: {
            type: String,
            enum: ["Cash on Delivery", "Card Payment"],
            default: "Cash on Delivery"
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
