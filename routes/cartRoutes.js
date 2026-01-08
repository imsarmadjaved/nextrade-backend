const express = require("express");
const Cart = require("../models/Cart");
const Product = require("../models/Product");
const BulkPricingTier = require("../models/BulkPricingTier");
const router = express.Router();
const verifyToken = require("../middleware/authMiddleware");
const roleCheck = require("../middleware/roleMiddleware");

async function calculateBulkPrice(product, quantity) {
    // Validate product and bulk pricing
    if (!product || !product.bulkPricingEnabled || !product.bulkTiers || product.bulkTiers.length === 0) {
        // Use sale price if available, otherwise regular price
        const basePrice = product.salePrice && product.salePrice < product.price
            ? product.salePrice
            : product.price;

        return {
            unitPrice: basePrice || 0,
            finalPrice: (basePrice || 0) * quantity,
            appliedTier: null,
            discountAmount: 0
        };
    }

    try {
        // Populate bulk tiers if needed
        let populatedProduct = product;
        if (product.bulkTiers.length > 0 && typeof product.bulkTiers[0] !== 'object') {
            populatedProduct = await Product.findById(product._id).populate("bulkTiers");
        }

        // Use sale price if available, otherwise regular price
        const basePrice = product.salePrice && product.salePrice < product.price
            ? product.salePrice
            : product.price;

        // Sort tiers by minQuantity descending to find the best applicable tier
        const sortedTiers = [...populatedProduct.bulkTiers].sort((a, b) => b.minQuantity - a.minQuantity);
        const applicableTier = sortedTiers.find(tier => quantity >= tier.minQuantity);

        if (!applicableTier) {
            return {
                unitPrice: basePrice,
                finalPrice: basePrice * quantity,
                appliedTier: null,
                discountAmount: 0
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
            unitPrice: basePrice, // Return the base price used for calculations
            finalPrice: finalUnitPrice * quantity,
            finalUnitPrice: finalUnitPrice,
            appliedTier: applicableTier._id,
            discountAmount: discountAmount * quantity
        };
    } catch (error) {
        console.error("Bulk price calculation error:", error);
        const basePrice = product.salePrice && product.salePrice < product.price
            ? product.salePrice
            : product.price;

        return {
            unitPrice: basePrice,
            finalPrice: basePrice * quantity,
            appliedTier: null,
            discountAmount: 0
        };
    }
}

// ADD TO CART
router.post("/", verifyToken, roleCheck(["buyer"]), async (req, res) => {
    try {
        console.log("Add to cart request body:", req.body);
        const { userId, productId, quantity } = req.body;

        // Validate required fields
        if (!userId || !productId || !quantity) {
            return res.status(400).json({
                message: "Missing required fields: userId, productId, quantity"
            });
        }

        const product = await Product.findById(productId).populate("bulkTiers");
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        console.log("Found product:", product.name);

        const pricing = await calculateBulkPrice(product, quantity);

        let cart = await Cart.findOne({ user: userId });

        if (!cart) {
            console.log("Creating new cart for user:", userId);
            cart = new Cart({
                user: userId,
                products: [{
                    product: productId,
                    quantity,
                    unitPrice: pricing.unitPrice,
                    finalPrice: pricing.finalPrice,
                    appliedTier: pricing.appliedTier,
                    discountAmount: pricing.discountAmount
                }]
            });
        } else {
            console.log("Updating existing cart");
            const productIndex = cart.products.findIndex(
                (p) => p.product.toString() === productId
            );

            if (productIndex > -1) {
                const newQuantity = cart.products[productIndex].quantity + quantity;
                const updatedPricing = await calculateBulkPrice(product, newQuantity);

                cart.products[productIndex].quantity = newQuantity;
                cart.products[productIndex].unitPrice = updatedPricing.unitPrice;
                cart.products[productIndex].finalPrice = updatedPricing.finalPrice;
                cart.products[productIndex].appliedTier = updatedPricing.appliedTier;
                cart.products[productIndex].discountAmount = updatedPricing.discountAmount;
            } else {
                cart.products.push({
                    product: productId,
                    quantity,
                    unitPrice: pricing.unitPrice,
                    finalPrice: pricing.finalPrice,
                    appliedTier: pricing.appliedTier,
                    discountAmount: pricing.discountAmount
                });
            }
        }

        await cart.save();
        console.log("Cart saved successfully");

        const populatedCart = await Cart.findById(cart._id)
            .populate("products.product")
            .populate("products.appliedTier");

        res.status(201).json({
            message: "Product added to cart",
            cart: populatedCart,
            appliedDiscount: pricing.appliedTier ? `Bulk discount applied: ${pricing.discountAmount} saved` : "No bulk discount"
        });
    } catch (err) {
        console.error("Add to cart error:", err);
        res.status(500).json({
            message: "Server error in add to cart",
            error: err.message,
            stack: err.stack
        });
    }
});

// View Cart according to user
router.get("/:userId", verifyToken, roleCheck(["buyer"]), async (req, res) => {
    try {
        console.log("=== CART GET REQUEST ===");
        console.log("User ID from params:", req.params.userId);
        console.log("Authenticated user:", req.user);

        const { userId } = req.params;

        // Validate user ID format
        if (!userId || userId.length !== 24) {
            console.log("Invalid user ID format");
            return res.status(400).json({
                message: "Invalid user ID format",
                userId: userId
            });
        }

        console.log("Searching for cart with user:", userId);
        const cart = await Cart.findOne({ user: userId })
            .populate("products.product")
            .populate("products.appliedTier");

        console.log("Cart query result:", cart);

        if (!cart) {
            console.log("No cart found, returning empty cart");
            // Return empty cart structure instead of 404
            return res.json({
                user: userId,
                products: [],
                totalAmount: 0
            });
        }

        console.log("Cart found, sending response");
        res.json(cart);
    } catch (err) {
        console.error("CART FETCH ERROR");
        console.error("Error message:", err.message);
        console.error("Error stack:", err.stack);
        console.error("Full error object:", err);

        res.status(500).json({
            message: "Server error in cart fetch",
            error: err.message
        });
    }
});

// Update quantity
router.put("/:userId/:productId", verifyToken, roleCheck(["buyer"]), async (req, res) => {
    try {
        const { userId, productId } = req.params;
        const { quantity } = req.body;

        if (quantity < 1) {
            return res.status(400).json({ message: "Quantity must be at least 1" });
        }

        let cart = await Cart.findOne({ user: userId });
        if (!cart) {
            return res.status(404).json({ message: "Cart not found" });
        }

        const productIndex = cart.products.findIndex(
            (p) => p.product.toString() === productId
        );

        if (productIndex === -1) {
            return res.status(404).json({ message: "Product not found in cart" });
        }

        // Get product and calculate new pricing
        const product = await Product.findById(productId).populate("bulkTiers");
        const pricing = await calculateBulkPrice(product, quantity);

        // Update cart item with new pricing
        cart.products[productIndex].quantity = quantity;
        cart.products[productIndex].unitPrice = pricing.unitPrice;
        cart.products[productIndex].finalPrice = pricing.finalPrice;
        cart.products[productIndex].appliedTier = pricing.appliedTier;
        cart.products[productIndex].discountAmount = pricing.discountAmount;

        await cart.save();

        // Populate for response
        const populatedCart = await Cart.findById(cart._id)
            .populate("products.product")
            .populate("products.appliedTier");

        res.json({ message: "Cart updated", cart: populatedCart });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Remove from cart
router.delete("/:userId/:productId", verifyToken, roleCheck(["buyer"]), async (req, res) => {
    try {
        const { userId, productId } = req.params;

        let cart = await Cart.findOne({ user: userId });
        if (!cart) {
            return res.status(404).json({ message: "Cart not found" });
        }

        const newProducts = cart.products.filter(
            (p) => p.product.toString() !== productId
        );

        if (newProducts.length === cart.products.length) {
            return res.status(404).json({ message: "Product not found in cart" });
        }

        cart.products = newProducts;
        await cart.save();

        res.json({ message: "Product removed from cart", cart });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Clear Cart
router.delete("/:userId", verifyToken, roleCheck(["buyer"]), async (req, res) => {
    try {
        const { userId } = req.params;

        let cart = await Cart.findOne({ user: userId });
        if (!cart) {
            return res.status(404).json({ message: "Cart not found" });
        }

        cart.products = [];
        await cart.save();

        res.json({ message: "Cart cleared successfully", cart });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

module.exports = router;
