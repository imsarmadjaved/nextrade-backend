const mongoose = require("mongoose");

const profileSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
        },
        phone: {
            type: String
        },
        address: {
            type: String
        },
        profileImage: {
            type: String,
            default: ""
        },
        //for seller
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
