const express = require("express");
const Cart = require("../models/Cart");
const Product = require("../models/Product");
const router = express.Router();

// ADD TO CART
router.post("/", async (req, res) => {
    try {
        const { userId, productId, quantity } = req.body;

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        let cart = await Cart.findOne({ user: userId });

        if (!cart) {
            cart = new Cart({
                user: userId,
                products: [{ product: productId, quantity }]
            });
        } else {
            const productIndex = cart.products.findIndex(
                (p) => p.product.toString() === productId
            );

            if (productIndex > -1) {
                cart.products[productIndex].quantity += quantity;
            } else {
                cart.products.push({ product: productId, quantity });
            }
        }

        await cart.save();
        res.status(201).json({ message: "Product added to cart", cart });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// View Cart according to user
router.get("/:userId", async (req, res) => {
    try {
        const { userId } = req.params;

        const cart = await Cart.findOne({ user: userId }).populate("products.product");

        if (!cart) {
            return res.status(404).json({ message: "Cart not found" });
        }

        res.json(cart);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Update quantity
router.put("/:userId/:productId", async (req, res) => {
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

        cart.products[productIndex].quantity = quantity;

        await cart.save();
        res.json({ message: "Cart updated", cart });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Remove from cart
router.delete("/:userId/:productId", async (req, res) => {
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
router.delete("/:userId", async (req, res) => {
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
