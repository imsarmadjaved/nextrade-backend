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
                }
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
            type: String,
            required: true
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
