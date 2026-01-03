const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },
        description: {
            type: String,
            default: ""
        },
        // Better structure for Cloudinary
        image: {
            url: {
                type: String,
                default: ""
            },
            publicId: {
                type: String,
                default: ""
            },
            width: {
                type: Number
            },
            height: {
                type: Number
            },
            format: {
                type: String
            }
        },
        icon: {
            type: String
        },
        isFeatured: {
            type: Boolean,
            default: false
        },
        productCount: {
            type: Number,
            default: 0
        }
    },
    { timestamps: true }
);

categorySchema.index({ isFeatured: 1 });
categorySchema.index({ isFeatured: 1, createdAt: -1 });

module.exports = mongoose.model("Category", categorySchema);