const express = require("express");
const Profile = require("../models/Profile.js");
const User = require("../models/User");
const upload = require("../middleware/upload");
const router = express.Router();
const verifyToken = require("../middleware/authMiddleware");
const roleCheck = require("../middleware/roleMiddleware");

// Get current user's profile
router.get("/me", verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId).select("role name email storeName storeDescription createdAt");
        const profile = await Profile.findOne({ user: userId });

        if (!profile) {
            const emptyProfile = {
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
                Object.assign(emptyProfile, {
                    businessType: "",
                    businessAddress: "",
                    city: "",
                    cnicNumber: "",
                    businessPhone: "",
                    yearsInBusiness: 0,
                    mainProducts: [],
                    businessDescription: ""
                });
            }
            return res.status(200).json(emptyProfile);
        }

        const profileData = {
            name: user.name,
            email: user.email,
            phone: profile.phone || "",
            city: profile.city || "",
            address: profile.address || "",
            profileImage: profile.profileImage || "",
            shopName: profile.shopName || user.storeName || "",
            shopDescription: profile.shopDescription || user.storeDescription || "",
            userRole: user.role,
            isProfileComplete: profile.isProfileComplete || false
        };

        if (["seller_pending", "seller_approved"].includes(user.role)) {
            Object.assign(profileData, {
                businessType: profile.businessType || "",
                businessAddress: profile.businessAddress || "",
                cnicNumber: profile.cnicNumber || "",
                businessPhone: profile.businessPhone || "",
                yearsInBusiness: profile.yearsInBusiness || 0,
                mainProducts: profile.mainProducts || [],
                businessDescription: profile.businessDescription || ""
            });
        }

        res.status(200).json(profileData);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Update profile
router.put("/me", verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId).select("role");

        let updateData = { ...req.body };
        const allowedBasicFields = ["phone", "city", "address", "profileImage", "shopName", "shopDescription"];

        if (!["seller_pending", "seller_approved"].includes(user.role)) {
            const filteredData = {};
            allowedBasicFields.forEach(field => {
                if (updateData[field] !== undefined) filteredData[field] = updateData[field];
            });
            updateData = filteredData;
        } else {
            if (!updateData.city && updateData.businessAddress) {
                updateData.city = updateData.businessAddress.split(',')[0] || "";
            }
            if (updateData.businessType && updateData.cnicNumber && updateData.city) {
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
            profile = new Profile({ user: userId, ...updateData });
            await profile.save();
        }

        if (updateData.shopName && ["seller_pending", "seller_approved"].includes(user.role)) {
            await User.findByIdAndUpdate(userId, {
                storeName: updateData.shopName,
                storeDescription: updateData.shopDescription || ""
            });
        }

        const userUpdated = await User.findById(userId).select("name email role storeName storeDescription");
        const responseData = {
            message: "Profile updated successfully",
            profile: {
                name: userUpdated.name,
                email: userUpdated.email,
                phone: profile.phone || "",
                city: profile.city || "",
                address: profile.address || "",
                profileImage: profile.profileImage || "",
                shopName: profile.shopName || userUpdated.storeName || "",
                shopDescription: profile.shopDescription || userUpdated.storeDescription || "",
                userRole: userUpdated.role,
                isProfileComplete: profile.isProfileComplete || false
            }
        };

        if (["seller_pending", "seller_approved"].includes(userUpdated.role)) {
            Object.assign(responseData.profile, {
                businessType: profile.businessType || "",
                businessAddress: profile.businessAddress || "",
                cnicNumber: profile.cnicNumber || "",
                businessPhone: profile.businessPhone || "",
                yearsInBusiness: profile.yearsInBusiness || 0,
                mainProducts: profile.mainProducts || [],
                businessDescription: profile.businessDescription || ""
            });
        }

        res.status(200).json(responseData);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Upload profile image (Cloudinary via upload middleware)
router.post("/image", verifyToken, upload.single("image"), async (req, res) => {
    try {
        const userId = req.user.id;
        if (!req.file) return res.status(400).json({ message: "No image file provided" });

        let profile = await Profile.findOne({ user: userId });
        if (!profile) profile = new Profile({ user: userId });

        profile.profileImage = req.file.path;
        await profile.save();

        res.json({
            message: "Profile image uploaded successfully",
            imageUrl: req.file.path,
            profile: { profileImage: req.file.path }
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Complete business profile (pending sellers)
router.post("/business-profile", verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const {
            phone, address, businessType, businessAddress, city, cnicNumber,
            businessPhone, yearsInBusiness, mainProducts, businessDescription,
            shopName, shopDescription
        } = req.body;

        const user = await User.findById(userId);
        if (user.role !== "seller_pending") {
            return res.status(400).json({ message: "Complete business profile is only for pending sellers" });
        }

        if (!businessType || !cnicNumber || !city) {
            return res.status(400).json({
                message: "Business type, CNIC number, and city are required for verification"
            });
        }

        let profile = await Profile.findOne({ user: userId });
        const businessProfileData = {
            phone: phone || "",
            address: address || "",
            businessType,
            businessAddress: businessAddress || address,
            city,
            cnicNumber,
            businessPhone: businessPhone || phone,
            yearsInBusiness: yearsInBusiness || 0,
            mainProducts: Array.isArray(mainProducts) ? mainProducts : [mainProducts],
            businessDescription: businessDescription || "",
            shopName: shopName || "",
            shopDescription: shopDescription || "",
            isProfileComplete: true
        };

        if (profile) {
            profile = await Profile.findOneAndUpdate(
                { user: userId },
                { $set: businessProfileData },
                { new: true, runValidators: true }
            );
        } else {
            profile = new Profile({ user: userId, ...businessProfileData });
            await profile.save();
        }

        if (shopName) {
            await User.findByIdAndUpdate(userId, {
                storeName: shopName,
                storeDescription: shopDescription || ""
            });
        }

        const userUpdated = await User.findById(userId).select("name email storeName storeDescription role");

        res.status(200).json({
            message: "Business profile completed successfully! Admin will review your application.",
            profile: { ...profile.toObject(), userRole: userUpdated.role }
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

module.exports = router;
