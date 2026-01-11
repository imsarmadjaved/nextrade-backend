const express = require("express");
const Profile = require("../models/Profile");
const User = require("../models/User");
const { uploadSingle } = require("../middleware/upload");
const verifyToken = require("../middleware/authMiddleware");
const cloudinary = require("cloudinary").v2;

const router = express.Router();

// Get current user's profile
router.get("/me", verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;

        const user = await User.findById(userId).select(
            "role name email storeName storeDescription createdAt"
        );

        const profile = await Profile.findOne({ user: userId });

        if (!profile) {
            const baseProfile = {
                name: user.name,
                email: user.email,
                phone: "",
                city: "",
                address: "",
                profileImage: "",
                shopName: user.storeName || "",
                shopDescription: user.storeDescription || "",
                userRole: user.role,
                isProfileComplete: false
            };

            if (["seller_pending", "seller_approved"].includes(user.role)) {
                Object.assign(baseProfile, {
                    businessType: "",
                    businessAddress: "",
                    cnicNumber: "",
                    businessPhone: "",
                    yearsInBusiness: 0,
                    mainProducts: [],
                    businessDescription: ""
                });
            }

            return res.status(200).json(baseProfile);
        }

        const response = {
            name: user.name,
            email: user.email,
            phone: profile.phone || "",
            city: profile.city || "",
            address: profile.address || "",
            profileImage: profile.profileImage
                ? typeof profile.profileImage === "string"
                    ? profile.profileImage
                    : profile.profileImage.url || ""
                : "",
            shopName: profile.shopName || user.storeName || "",
            shopDescription: profile.shopDescription || user.storeDescription || "",
            userRole: user.role,
            isProfileComplete: profile.isProfileComplete || false
        };

        if (["seller_pending", "seller_approved"].includes(user.role)) {
            Object.assign(response, {
                businessType: profile.businessType || "",
                businessAddress: profile.businessAddress || "",
                cnicNumber: profile.cnicNumber || "",
                businessPhone: profile.businessPhone || "",
                yearsInBusiness: profile.yearsInBusiness || 0,
                mainProducts: profile.mainProducts || [],
                businessDescription: profile.businessDescription || ""
            });
        }

        res.status(200).json(response);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Get profile by user ID (Admin only) 
router.get("/:userId", verifyToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const requestingUser = await User.findById(req.user.id);

        // Check if requesting user is admin
        if (requestingUser.role !== "admin") {
            return res.status(403).json({
                message: "Only admins can view other users' profiles"
            });
        }

        const user = await User.findById(userId).select(
            "role name email storeName storeDescription createdAt"
        );

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const profile = await Profile.findOne({ user: userId });

        if (!profile) {
            return res.status(404).json({ message: "Profile not found for this user" });
        }

        const response = {
            name: user.name,
            email: user.email,
            phone: profile.phone || "",
            city: profile.city || "",
            address: profile.address || "",
            profileImage: profile.profileImage
                ? typeof profile.profileImage === "string"
                    ? profile.profileImage
                    : profile.profileImage.url || ""
                : "",
            shopName: profile.shopName || user.storeName || "",
            shopDescription: profile.shopDescription || user.storeDescription || "",
            userRole: user.role,
            isProfileComplete: profile.isProfileComplete || false
        };

        if (["seller_pending", "seller_approved"].includes(user.role)) {
            Object.assign(response, {
                businessType: profile.businessType || "",
                businessAddress: profile.businessAddress || "",
                cnicNumber: profile.cnicNumber || "",
                businessPhone: profile.businessPhone || "",
                yearsInBusiness: profile.yearsInBusiness || 0,
                mainProducts: profile.mainProducts || [],
                businessDescription: profile.businessDescription || ""
            });
        }

        res.status(200).json(response);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});



// Update profile (non-image fields) 
router.put("/me", verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId).select("role");

        let updateData = { ...req.body };

        // Handle profileImage field properly
        if (updateData.profileImage) {
            // If profileImage is provided, ensure it's stored as an object
            if (typeof updateData.profileImage === 'string') {
                updateData.profileImage = {
                    url: updateData.profileImage,
                    // If you have publicId from somewhere, include it, otherwise generate or leave empty
                    publicId: `profile-${userId}-${Date.now()}`
                };
            }
        }

        if (!["seller_pending", "seller_approved"].includes(user.role)) {
            const allowedFields = [
                "phone",
                "city",
                "address",
                "shopName",
                "shopDescription",
                "profileImage"
            ];

            updateData = Object.fromEntries(
                Object.entries(updateData).filter(([key]) =>
                    allowedFields.includes(key)
                )
            );
        } else {
            if (
                updateData.businessType &&
                updateData.cnicNumber &&
                updateData.city
            ) {
                updateData.isProfileComplete = true;
            }
        }

        let profile = await Profile.findOne({ user: userId });

        if (profile) {
            profile = await Profile.findOneAndUpdate(
                { user: userId },
                { $set: updateData },
                { new: true, runValidators: true }
            );
        } else {
            profile = await Profile.create({ user: userId, ...updateData });
        }

        if (
            updateData.shopName &&
            ["seller_pending", "seller_approved"].includes(user.role)
        ) {
            await User.findByIdAndUpdate(userId, {
                storeName: updateData.shopName,
                storeDescription: updateData.shopDescription || ""
            });
        }

        const userUpdated = await User.findById(userId).select(
            "name email role storeName storeDescription"
        );

        res.status(200).json({
            message: "Profile updated successfully",
            profile: {
                name: userUpdated.name,
                email: userUpdated.email,
                phone: profile.phone || "",
                city: profile.city || "",
                address: profile.address || "",
                profileImage: profile.profileImage
                    ? (typeof profile.profileImage === 'string'
                        ? profile.profileImage
                        : profile.profileImage.url || "")
                    : "",
                shopName: profile.shopName || userUpdated.storeName || "",
                shopDescription:
                    profile.shopDescription || userUpdated.storeDescription || "",
                userRole: userUpdated.role,
                isProfileComplete: profile.isProfileComplete || false
            }
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Update
router.post(
    "/image",
    verifyToken,
    uploadSingle("image", "profiles"),
    async (req, res) => {
        try {
            const userId = req.user.id;

            let profile = await Profile.findOne({ user: userId });
            if (!profile) profile = new Profile({ user: userId });

            if (profile.profileImage?.publicId) {
                await cloudinary.uploader.destroy(
                    profile.profileImage.publicId
                );
            }

            profile.profileImage = {
                url: req.file.cloudinary.url,
                publicId: req.file.cloudinary.publicId
            };

            await profile.save();

            res.json({
                message: "Profile image uploaded successfully",
                imageUrl: profile.profileImage.url
            });
        } catch (err) {
            res.status(500).json({ message: "Server error", error: err.message });
        }
    }
);

// Complete business profile (pending sellers only) 
router.post("/business-profile", verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId);

        if (user.role !== "seller_pending") {
            return res.status(400).json({
                message: "Only pending sellers can complete business profile"
            });
        }

        const {
            phone,
            address,
            businessType,
            businessAddress,
            city,
            cnicNumber,
            businessPhone,
            yearsInBusiness,
            mainProducts,
            businessDescription,
            shopName,
            shopDescription
        } = req.body;

        if (!businessType || !cnicNumber || !city) {
            return res.status(400).json({
                message: "Business type, CNIC number, and city are required"
            });
        }

        const data = {
            phone: phone || "",
            address: address || "",
            businessType,
            businessAddress: businessAddress || address,
            city,
            cnicNumber,
            businessPhone: businessPhone || phone,
            yearsInBusiness: yearsInBusiness || 0,
            mainProducts: Array.isArray(mainProducts)
                ? mainProducts
                : [mainProducts],
            businessDescription: businessDescription || "",
            shopName: shopName || "",
            shopDescription: shopDescription || "",
            isProfileComplete: true
        };

        const profile = await Profile.findOneAndUpdate(
            { user: userId },
            { $set: data },
            { new: true, upsert: true, runValidators: true }
        );

        if (shopName) {
            await User.findByIdAndUpdate(userId, {
                storeName: shopName,
                storeDescription: shopDescription || ""
            });
        }

        res.status(200).json({
            message:
                "Business profile completed successfully. Admin review pending.",
            profile
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

module.exports = router;
