const express = require("express");
const Profile = require("../models/Profile.js");
const upload = require("../middleware/upload");
const router = express.Router();

// Create and update profile
router.post("/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        const { phone, address, profileImage, shopName, shopDescription } = req.body;

        let profile = await Profile.findOne({ user: userId });

        //update
        if (profile) {
            profile.phone = phone;
            profile.address = address;
            profile.profileImage = profileImage;
            profile.shopName = shopName;
            profile.shopDescription = shopDescription;
            await profile.save();
            return res.status(200).json({ message: "Profile updated successfully", profile });
        }

        // Create
        const newProfile = new Profile({
            user: userId,
            phone,
            address,
            profileImage,
            shopName,
            shopDescription,
        });

        await newProfile.save();
        res.status(201).json({ message: "Profile created successfully", newProfile });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

//image uploading
router.post("/:userId/upload", upload.single("profileImage"), async (req, res) => {
    try {
        const profile = await Profile.findOne({ user: req.params.userId });

        if (!profile) {
            return res.status(404).json({ message: "Profile not found" });
        }

        profile.profileImage = req.file.path;
        await profile.save();

        res.json({ message: "Profile image uploaded successfully", profile });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});


// View Profile
router.get("/:userId", async (req, res) => {
    try {
        const profile = await Profile.findOne({ user: req.params.userId }).populate("user", "name email role");

        if (!profile) {
            return res.status(404).json({ message: "Profile not found" });
        }

        res.status(200).json(profile);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// View profile "Admin"
router.get("/", async (req, res) => {
    try {
        const profiles = await Profile.find().populate("user", "name email role createdAt");

        if (!profiles || profiles.length === 0) {
            return res.status(404).json({ message: "No profiles found" });
        }

        res.status(200).json(profiles);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Delete profile of user "Admin"
router.delete("/:userId", async (req, res) => {
    try {
        const { userId } = req.params;

        const profile = await Profile.findOne({ user: userId });
        if (!profile) {
            return res.status(404).json({ message: "Profile not found" });
        }

        await Profile.deleteOne({ user: userId });

        res.status(200).json({ message: "Profile deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});


module.exports = router;
