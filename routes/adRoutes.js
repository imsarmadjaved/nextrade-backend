const express = require("express");
const Ad = require("../models/ad");
const upload = require("../middleware/upload");
const router = express.Router();

// Create ad
router.post("/", upload.single("image"), async (req, res) => {
    try {
        const { title, description, link, targetCategory, startDate, endDate, createdBy } = req.body;

        if (!req.file) {
            return res.status(400).json({ message: "Ad image required" });
        }

        const newAd = new Ad({
            title,
            description,
            image: req.file.path,
            link,
            targetCategory,
            startDate,
            endDate,
            createdBy,
        });

        await newAd.save();
        res.status(201).json({ message: "Ad created, pending approval", ad: newAd });
    }
    catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// approve or reject (admin)
router.put("/:id/status", async (req, res) => {
    try {
        const { status } = req.body;
        const ad = await Ad.findById(req.params.id);
        if (!ad) {
            return res.status(404).json({ message: "Ad not found" });
        }

        ad.status = status;
        await ad.save();

        res.json({ message: `Ad ${status} successfully`, ad });
    }
    catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// View ads (Approved and active)
router.get("/", async (req, res) => {
    try {
        // Auto deactivate expired ads
        await Ad.updateMany(
            { endDate: { $lt: new Date() }, isActive: true },
            { $set: { isActive: false } }
        );

        const activeAds = await Ad.find({
            status: "approved",
            isActive: true,
        }).populate("seller", "name email").sort({ createdAt: -1 }).limit(5);

        res.json(activeAds);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// View all ads (admin)
router.get("/all", async (req, res) => {
    try {
        const ads = await Ad.find().sort({ createdAt: -1 });

        res.json(ads);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

//View ads of a seller
router.get("/seller/:sellerId", async (req, res) => {
    try {
        const ads = await Ad.find({ createdBy: req.params.sellerId }).populate("seller", "name email");;

        if (!ads.length) {
            return res.status(404).json({ message: "No ads found for this seller" });
        }

        res.json(ads);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// View single ad data
router.get("/:id", async (req, res) => {
    try {
        const ad = await Ad.findById(req.params.id).populate("seller", "name email");;

        if (!ad) {
            return res.status(404).json({ message: "Ad not found" });
        }

        res.json(ad);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Update ads
router.put("/:id", async (req, res) => {
    try {
        const updatedAd = await Ad.findByIdAndUpdate(req.params.id, req.body, { new: true });

        if (!updatedAd) {
            return res.status(404).json({ message: "Ad not found" });
        }

        res.json({ message: "Ad updated successfully", updatedAd });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Delete ad (admin/seller)
router.delete("/:id", async (req, res) => {
    try {
        const ad = await Ad.findByIdAndDelete(req.params.id);

        if (!ad) {
            return res.status(404).json({ message: "Ad not found" });
        }

        res.json({ message: "Ad deleted successfully" });
    }
    catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

module.exports = router;
