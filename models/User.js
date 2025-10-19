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
            enum: ["buyer", "seller", "admin"],
            default: "buyer",
        },
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

    },
    { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
