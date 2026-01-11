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
        image: {
            url: {
                type: String,
                default: ""
            },
            publicId: {
                type: String,
                default: null
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