const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
    payer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    paymentFor: {
        type: String,
        enum: ["ad", "order", "subscription"],
        required: true
    },
    itemId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        default: "PKR"
    },
    method: {
        type: String,
        enum: ["pending", "bank_transfer", "jazzcash", "easypaisa", "cash_on_delivery"],
        required: true
    },
    status: {
        type: String,
        enum: ["pending", "processing", "completed", "failed", "refunded"],
        default: "pending"
    },
    images: [{
        url: {
            type: String,
            required: true
        },
        publicId: {
            type: String
        }
    }],
    transactionId: String,
    paidAt: Date,
    verifiedAt: Date,
    verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }
}, { timestamps: true });

module.exports = mongoose.model("Payment", paymentSchema);
