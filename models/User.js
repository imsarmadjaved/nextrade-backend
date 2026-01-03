const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
        },
        password: {
            type: String,
            required: true,
            minlength: 6,
        },
        role: {
            type: String,
            enum: ["buyer", "seller_pending", "seller_approved", "admin"],
            default: "buyer",
        },
        approvalStatus: {
            type: String,
            enum: ["pending", "approved", "rejected"],
            default: "pending"
        },
        approvalDate: Date,
        rejectedReason: String,
        submittedAt: Date,
        isBlocked: {
            type: Boolean,
            default: false,
        },
        resetPasswordToken: {
            type: String
        },
        resetPasswordExpire: {
            type: Date
        },
        lastLogoutAt: {
            type: Date,
            default: null
        },
        storeName: {
            type: String,
            sparse: true
        },
        storeDescription: {
            type: String
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
