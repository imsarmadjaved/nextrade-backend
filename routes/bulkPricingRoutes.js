const express = require("express");
const router = express.Router();
const BulkPricingTier = require("../models/BulkPricingTier");
const Product = require("../models/Product");
const auth = require("../middleware/authMiddleware");

// Add bulk tier to product
router.post("/bulk-pricing/products/:id", auth, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ message: "Product not found" });

        // Check if user owns the product or is admin
        if (product.seller.toString() !== req.user.id && req.user.role !== "admin") {
            return res.status(403).json({ message: "Not authorized" });
        }

        const bulkTier = new BulkPricingTier({
            ...req.body,
            product: req.params.id
        });

        await bulkTier.save();

        // Add tier to product's bulkTiers array
        product.bulkTiers.push(bulkTier._id);
        await product.save();

        res.status(201).json(bulkTier);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Get all bulk tiers for a product
router.get("/bulk-pricing/products/:id", async (req, res) => {
    try {
        const tiers = await BulkPricingTier.find({ product: req.params.id })
            .sort({ minQuantity: 1 });
        res.json(tiers);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Update bulk tier
router.put("/bulk-pricing/:tierId", auth, async (req, res) => {
    try {
        const tier = await BulkPricingTier.findById(req.params.tierId);
        if (!tier) return res.status(404).json({ message: "Tier not found" });

        const product = await Product.findById(tier.product);
        // Check authorization
        if (product.seller.toString() !== req.user.id && req.user.role !== "admin") {
            return res.status(403).json({ message: "Not authorized" });
        }

        const updatedTier = await BulkPricingTier.findByIdAndUpdate(
            req.params.tierId,
            req.body,
            { new: true }
        );

        res.json(updatedTier);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Delete bulk tier
router.delete("/bulk-pricing/:tierId", auth, async (req, res) => {
    try {
        const tier = await BulkPricingTier.findById(req.params.tierId);
        if (!tier) return res.status(404).json({ message: "Tier not found" });

        const product = await Product.findById(tier.product);
        // Check authorization
        if (product.seller.toString() !== req.user.id && req.user.role !== "admin") {
            return res.status(403).json({ message: "Not authorized" });
        }

        // Remove tier from product's bulkTiers array
        await Product.findByIdAndUpdate(tier.product, {
            $pull: { bulkTiers: req.params.tierId }
        });

        await BulkPricingTier.findByIdAndDelete(req.params.tierId);
        res.json({ message: "Tier deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Toggle bulk pricing enabled/disabled
router.patch("/bulk-pricing/products/:id/toggle", auth, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ message: "Product not found" });

        // Check authorization
        if (product.seller.toString() !== req.user.id && req.user.role !== "admin") {
            return res.status(403).json({ message: "Not authorized" });
        }

        product.bulkPricingEnabled = req.body.enabled;
        await product.save();

        res.json({
            message: `Bulk pricing ${req.body.enabled ? 'enabled' : 'disabled'}`,
            bulkPricingEnabled: product.bulkPricingEnabled
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Calculate price for specific quantity
router.post("/pricing/calculate-bulk", async (req, res) => {
    try {
        const { productId, quantity } = req.body;

        const product = await Product.findById(productId)
            .populate("bulkTiers");

        if (!product) return res.status(404).json({ message: "Product not found" });

        const result = calculateBulkPrice(product, quantity);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get available pricing tiers for product
router.get("/products/:id/pricing-tiers", async (req, res) => {
    try {
        const product = await Product.findById(req.params.id)
            .populate("bulkTiers")
            .select("bulkPricingEnabled bulkTiers price");

        if (!product) return res.status(404).json({ message: "Product not found" });

        res.json({
            bulkPricingEnabled: product.bulkPricingEnabled,
            regularPrice: product.price,
            tiers: product.bulkTiers.sort((a, b) => a.minQuantity - b.minQuantity)
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Pricing calculation function
function calculateBulkPrice(product, quantity) {
    // Use sale price if available, otherwise regular price
    const basePrice = product.salePrice && product.salePrice < product.price
        ? product.salePrice
        : product.price;

    if (!product.bulkPricingEnabled || !product.bulkTiers || product.bulkTiers.length === 0) {
        return {
            unitPrice: basePrice,
            finalPrice: basePrice * quantity,
            appliedTier: null,
            discountAmount: 0,
            discountPercentage: 0
        };
    }

    // Sort tiers by minQuantity descending to find the best applicable tier
    const sortedTiers = [...product.bulkTiers].sort((a, b) => b.minQuantity - a.minQuantity);
    const applicableTier = sortedTiers.find(tier => quantity >= tier.minQuantity);

    if (!applicableTier) {
        return {
            unitPrice: basePrice,
            finalPrice: basePrice * quantity,
            appliedTier: null,
            discountAmount: 0,
            discountPercentage: 0
        };
    }

    let finalUnitPrice;
    let discountAmount;

    if (applicableTier.discountType === "percentage") {
        discountAmount = basePrice * (applicableTier.discountValue / 100);
        finalUnitPrice = basePrice - discountAmount;
    } else {
        discountAmount = applicableTier.discountValue;
        finalUnitPrice = basePrice - discountAmount;
    }

    return {
        unitPrice: finalUnitPrice,
        finalPrice: finalUnitPrice * quantity,
        finalUnitPrice: finalUnitPrice,
        appliedTier: applicableTier,
        discountAmount: discountAmount * quantity,
        discountPercentage: applicableTier.discountType === "percentage" ? applicableTier.discountValue : (discountAmount / basePrice) * 100
    };
}

module.exports = router;
