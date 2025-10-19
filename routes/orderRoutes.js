const express = require("express");
const router = express.Router();
const Order = require("../models/Order");

// Place Order
router.post("/", async (req, res) => {
    try {
        const { userId, shippingAddress, paymentMethod } = req.body;
        const cart = await Cart.findOne({ user: userId }).populate("products.product");

        if (!cart || cart.products.length === 0) {
            return res.status(400).json({ message: "Cart is empty" });
        }

        const totalAmount = cart.products.reduce(
            (sum, item) => sum + item.product.price * item.quantity,
            0
        );

        const order = new Order({
            user: userId,
            items: cart.products.map((item) => ({
                product: item.product._id,
                quantity: item.quantity,
            })),
            totalAmount,
            shippingAddress,
            paymentMethod,
            status: "Pending",
        });

        await order.save();
        cart.products = [];
        await cart.save();

        res.json({ message: "Order placed successfully", order });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// View all orders by "Admin/seller"
router.get("/", async (req, res) => {
    try {
        const orders = await Order.find()
            .populate("user", "name email")
            .populate("items.product", "name price")
            .sort({ createdAt: -1 });

        res.json(orders);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// View order by user
router.get("/:userId", async (req, res) => {
    try {
        const orders = await Order.find({ user: req.params.userId })
            .populate("items.product", "name price")
            .sort({ createdAt: -1 });

        res.json(orders);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Update Order Status by "Admin/Seller"
router.put("/:orderId/status", async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;

        const validStatuses = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: "Invalid status value" });
        }

        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ message: "Order not found" });

        order.status = status;
        await order.save();

        res.json({ message: "Order status updated successfully", order });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Delete order by "admin/seller"
router.delete("/:orderId", async (req, res) => {
    try {
        const { orderId } = req.params;

        const order = await Order.findByIdAndDelete(orderId);
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        res.json({ message: "Order deleted successfully", orderId });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});


module.exports = router;
