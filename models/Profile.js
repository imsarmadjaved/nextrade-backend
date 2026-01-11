const mongoose = require("mongoose");

const profileSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
        },
        // Personal Information
        phone: {
            type: String

        },
        city: {
            type: String,
            trim: true
        },
        address: {
            type: String,
            trim: true
        },
        profileImage: {
            url: { type: String, default: "" },
            publicId: { type: String, default: "" }
        },

        // Business Verification Fields (for sellers)
        businessType: {
            type: String,
            enum: ["individual", "wholesaler", "retailer", "manufacturer", "distributor", ""],
            default: ""
        },
        businessAddress: String,
        cnicNumber: {
            type: String,
            validate: {
                validator: function (v) {
                    // CNIC is required only if businessType is set
                    if (this.businessType && this.businessType !== "") {
                        return v && v.trim().length > 0;
                    }
                    return true;
                },
                message: 'CNIC number is required for business profiles'
            }
        },
        businessPhone: String,
        yearsInBusiness: Number,
        mainProducts: [String],
        businessDescription: String,
        isProfileComplete: {
            type: Boolean,
            default: false
        },
        shopName: {
            type: String
        },
        shopDescription: {
            type: String
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Profile", profileSchema);
