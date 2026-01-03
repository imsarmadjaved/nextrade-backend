const express = require("express");
const Pricing = require("../models/pricing");
const router = express.Router();
const verifyToken = require("../middleware/authMiddleware");
const roleCheck = require("../middleware/roleMiddleware");

// Get all pricing tiers (public)
router.get("/", async (req, res) => {
    try {
        const pricing = await Pricing.find({ isActive: true }).sort({ duration: 1 });
        res.json(pricing);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Create pricing tier (admin)
router.post("/", verifyToken, roleCheck(["admin"]), async (req, res) => {
    try {
        const { duration, price } = req.body;

        const existingPricing = await Pricing.findOne({ duration });
        if (existingPricing) {
            return res.status(400).json({ message: "Pricing for this duration already exists" });
        }

        const newPricing = new Pricing({
            duration,
            price
        });

        await newPricing.save();
        res.status(201).json({ message: "Pricing tier created", pricing: newPricing });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Update pricing tier (admin)
router.put("/:id", verifyToken, roleCheck(["admin"]), async (req, res) => {
    try {
        const { price, isActive } = req.body;

        const pricing = await Pricing.findById(req.params.id);
        if (!pricing) {
            return res.status(404).json({ message: "Pricing tier not found" });
        }

        if (price) pricing.price = price;
        if (isActive !== undefined) pricing.isActive = isActive;

        await pricing.save();
        res.json({ message: "Pricing tier updated", pricing });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

module.exports = router;
