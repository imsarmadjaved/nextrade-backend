const express = require("express");
const Profile = require("../models/Profile.js");
const User = require("../models/User");
const upload = require("../middleware/upload");
const router = express.Router();
const verifyToken = require("../middleware/authMiddleware");
const roleCheck = require("../middleware/roleMiddleware");

// Get current user's profile (role-based)
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
                city: profile.city || "",
                cnicNumber: profile.cnicNumber || "",
                businessPhone: profile.businessPhone || "",
                yearsInBusiness: profile.yearsInBusiness || 0,
                mainProducts: profile.mainProducts || [],
                businessDescription: profile.businessDescription || ""
            });
        }

        res.status(200).json(profileData);
    } catch (err) {
        console.error("Get profile error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// update Profile
router.put("/me", verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId).select("role");

        let updateData = { ...req.body };
        const allowedBasicFields = ["phone", "city", "address", "profileImage", "shopName", "shopDescription"];

        if (!["seller_pending", "seller_approved"].includes(user.role)) {
            // For non-sellers, only allow basic fields
            const filteredData = {};
            allowedBasicFields.forEach(field => {
                if (updateData[field] !== undefined) {
                    filteredData[field] = updateData[field];
                }
            });
            updateData = filteredData;
        } else {
            // For sellers, allow all fields
            if (!updateData.city && updateData.businessAddress) {
                // Extract city from business address if city not provided
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
            profile = new Profile({
                user: userId,
                ...updateData
            });
            await profile.save();
        }

        // Update User store info if applicable
        if (updateData.shopName && ["seller_pending", "seller_approved"].includes(user.role)) {
            await User.findByIdAndUpdate(userId, {
                storeName: updateData.shopName,
                storeDescription: updateData.shopDescription || ""
            });
        }

        // Prepare response
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

        console.log("Response data:", responseData); // Debug log
        res.status(200).json(responseData);
    } catch (err) {
        console.error("Update profile error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Upload profile image
router.post("/image", verifyToken, upload.single("image"), async (req, res) => {
    try {
        const userId = req.user.id;

        if (!req.file) {
            return res.status(400).json({ message: "No image file provided" });
        }

        const imageUrl = `/uploads/profiles/${req.file.filename}`.replace(/\\/g, '/');

        let profile = await Profile.findOne({ user: userId });
        if (!profile) {
            profile = new Profile({ user: userId });
        }

        profile.profileImage = imageUrl;
        await profile.save();

        res.json({
            message: "Profile image uploaded successfully",
            imageUrl: imageUrl,
            profile: {
                profileImage: imageUrl
            }
        });
    } catch (err) {
        console.error("Image upload error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Complete business profile (for pending sellers)
router.post("/business-profile", verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
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

        const user = await User.findById(userId);
        if (user.role !== "seller_pending") {
            return res.status(400).json({
                message: "Complete business profile is only for pending sellers"
            });
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
            profile = new Profile({
                user: userId,
                ...businessProfileData
            });
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
            profile: {
                name: userUpdated.name,
                email: userUpdated.email,
                phone: profile.phone,
                address: profile.address,
                profileImage: profile.profileImage,
                businessType: profile.businessType,
                businessAddress: profile.businessAddress,
                city: profile.city,
                cnicNumber: profile.cnicNumber,
                businessPhone: profile.businessPhone,
                yearsInBusiness: profile.yearsInBusiness,
                mainProducts: profile.mainProducts,
                businessDescription: profile.businessDescription,
                shopName: profile.shopName || userUpdated.storeName,
                shopDescription: profile.shopDescription || userUpdated.storeDescription,
                isProfileComplete: true,
                userRole: userUpdated.role
            }
        });

    } catch (err) {
        console.error("Business Profile Error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Get business profile (seller)
router.get("/business-profile", verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;

        const profile = await Profile.findOne({ user: userId });
        if (!profile) {
            return res.status(404).json({ message: "Profile not found" });
        }

        const user = await User.findById(userId).select("role approvalStatus storeName storeDescription name email");

        if (!["seller_pending", "seller_approved"].includes(user.role)) {
            return res.status(403).json({ message: "Access denied. Seller role required." });
        }

        res.status(200).json({
            profile: {
                name: user.name,
                email: user.email,
                phone: profile.phone,
                address: profile.address,
                profileImage: profile.profileImage,
                businessType: profile.businessType,
                businessAddress: profile.businessAddress,
                city: profile.city,
                cnicNumber: profile.cnicNumber,
                businessPhone: profile.businessPhone,
                yearsInBusiness: profile.yearsInBusiness,
                mainProducts: profile.mainProducts,
                businessDescription: profile.businessDescription,
                shopName: profile.shopName || user.storeName,
                shopDescription: profile.shopDescription || user.storeDescription,
                isProfileComplete: profile.isProfileComplete,
                userRole: user.role
            },
            approvalStatus: user.approvalStatus
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Get Seller Profile (for buyers to view approved sellers)
router.get("/seller/:userId", async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId).select("name storeName storeDescription role approvalStatus");
        if (!user || user.role !== "seller_approved") {
            return res.status(404).json({ message: "Seller not found or not approved" });
        }

        const profile = await Profile.findOne({ user: userId }).select(
            "businessType city yearsInBusiness mainProducts businessDescription profileImage phone address"
        );

        res.status(200).json({
            seller: {
                id: user._id,
                name: user.name,
                storeName: user.storeName,
                storeDescription: user.storeDescription,
                businessType: profile?.businessType,
                city: profile?.city,
                yearsInBusiness: profile?.yearsInBusiness,
                mainProducts: profile?.mainProducts,
                businessDescription: profile?.businessDescription,
                profileImage: profile?.profileImage,
                phone: profile?.phone,
                address: profile?.address
            }
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Admin: View any user's profile
router.get("/:userId", verifyToken, roleCheck(["admin"]), async (req, res) => {
    try {
        const profile = await Profile.findOne({ user: req.params.userId })
            .populate("user", "name email role approvalStatus storeName storeDescription");

        if (!profile) {
            return res.status(404).json({ message: "Profile not found" });
        }

        res.status(200).json(profile);
    } catch (err) {
        console.error("Admin get profile error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Admin: View all profiles
router.get("/", verifyToken, roleCheck(["admin"]), async (req, res) => {
    try {
        const profiles = await Profile.find()
            .populate("user", "name email role approvalStatus createdAt storeName storeDescription");

        if (!profiles || profiles.length === 0) {
            return res.status(404).json({ message: "No profiles found" });
        }

        res.status(200).json(profiles);
    } catch (err) {
        console.error("Admin get all profiles error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Admin: Delete profile
router.delete("/:userId", verifyToken, roleCheck(["admin"]), async (req, res) => {
    try {
        const { userId } = req.params;

        const profile = await Profile.findOne({ user: userId });
        if (!profile) {
            return res.status(404).json({ message: "Profile not found" });
        }

        await Profile.deleteOne({ user: userId });

        res.status(200).json({ message: "Profile deleted successfully" });
    } catch (err) {
        console.error("Admin delete profile error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

module.exports = router;