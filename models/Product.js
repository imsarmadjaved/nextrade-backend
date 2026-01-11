const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
    {
        seller: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        name: {
            type: String,
            required: true,
            trim: true
        },
        description: {
            type: String,
            required: true
        },
        price: {
            type: Number,
            required: true,
            min: 0
        },
        stock: {
            type: Number,
            required: true,
            min: 0
        },
        category: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Category",
            required: true
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
        tags: [
            { type: String }
        ],
        averageRating: {
            type: Number,
            default: 0
        },
        numReviews: {
            type: Number, default: 0
        },
        salePrice: {
            type: Number,
            min: 0
        },
        bulkPricingEnabled: {
            type: Boolean,
            default: false
        },
        bulkTiers: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "BulkPricingTier"
        }],
        status: {
            type: String,
            enum: ["active", "inactive", "out-of-stock"],
            default: "active"
        },
        featured: {
            type: Boolean,
            default: false
        },
        sales: {
            type: Number,
            default: 0
        }
    },
    { timestamps: true }
);

productSchema.index({ category: 1 });

module.exports = mongoose.model("Product", productSchema);
