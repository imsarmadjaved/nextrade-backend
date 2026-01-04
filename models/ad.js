const mongoose = require("mongoose");

const adSchema = new mongoose.Schema(
    {
        seller: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        title: {
            type: String,
            required: true,
        },
        description: {
            type: String,
            required: true,
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
        link: {
            type: String,
            required: true,
        },
        targetCategory: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Category",
            required: true,
        },
        payment: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Payment"
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        startDate: {
            type: Date,
            required: true,
        },
        endDate: {
            type: Date,
            required: true,
        },
        status: {
            type: String,
            enum: ["pending", "approved", "rejected"],
            default: "pending"
        },
        isActive: {
            type: Boolean,
            default: false,
        },
        duration: {
            type: Number,
            required: true
        },
        totalCost: {
            type: Number,
            required: true
        },
        isDeleted: {
            type: Boolean,
            default: false
        },
        deletedAt: {
            type: Date
        },
        deletedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        deletionReason: {
            type: String
        },
        impressions: {
            type: Number,
            default: 0
        },
        clicks: {
            type: Number,
            default: 0
        },
        ctr: {
            type: Number,
            default: 0
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Ad", adSchema);
