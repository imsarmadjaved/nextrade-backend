const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
    {
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
        images: {
            type: [String],
            default: []
        },
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
    },
    { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);