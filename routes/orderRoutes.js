const express = require("express");
const Order = require("../models/Order");
const Product = require("../models/Product");
const Cart = require("../models/Cart");
const router = express.Router();
const verifyToken = require("../middleware/authMiddleware");
const roleCheck = require("../middleware/roleMiddleware");
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// Calculate bulk pricing based on quantity tiers
async function calculateBulkPrice(product, quantity) {
    // If bulk pricing is not enabled, return regular price
    if (!product.bulkPricingEnabled || !product.bulkTiers || product.bulkTiers.length === 0) {
        return {
            unitPrice: product.price,
            finalPrice: product.price * quantity,
            finalUnitPrice: product.price,
            appliedTier: null,
            discountAmount: 0
        };
    }

    // Sort tiers by quantity (highest first) to find the best applicable tier
    const sortedTiers = [...product.bulkTiers].sort((a, b) => b.minQuantity - a.minQuantity);
    const applicableTier = sortedTiers.find(tier => quantity >= tier.minQuantity);

    // If no applicable tier found, return regular price
    if (!applicableTier) {
        return {
            unitPrice: product.price,
            finalPrice: product.price * quantity,
            finalUnitPrice: product.price,
            appliedTier: null,
            discountAmount: 0
        };
    }

    let finalUnitPrice, discountPerUnit;

    // Calculate price based on discount type (percentage or fixed amount)
    if (applicableTier.discountType === "percentage") {
        const discountPercentage = applicableTier.discountValue / 100;
        finalUnitPrice = product.price * (1 - discountPercentage);
        discountPerUnit = product.price - finalUnitPrice;
    } else {
        discountPerUnit = applicableTier.discountValue;
        finalUnitPrice = product.price - discountPerUnit;
    }

    // Ensure price doesn't go below zero
    finalUnitPrice = Math.max(finalUnitPrice, 0);

    return {
        unitPrice: product.price,
        finalPrice: finalUnitPrice * quantity,
        finalUnitPrice: finalUnitPrice,
        appliedTier: applicableTier._id,
        discountAmount: discountPerUnit * quantity
    };
}

// Create a new order from cart
router.post("/", verifyToken, roleCheck(["buyer"]), async (req, res) => {
    try {
        const { userId, shippingAddress, paymentMethod } = req.body;
        const cart = await Cart.findOne({ user: userId }).populate("products.product");

        // Check if cart exists and has items
        if (!cart || cart.products.length === 0) {
            return res.status(400).json({ message: "Cart is empty" });
        }

        const orderItems = [];
        let totalAmount = 0;

        // Process each item in the cart
        for (const cartItem of cart.products) {
            const product = cartItem.product;

            if (!product) {
                return res.status(404).json({ message: "Product not found" });
            }

            // Calculate price with bulk discounts
            const pricing = await calculateBulkPrice(product, cartItem.quantity);

            orderItems.push({
                product: product._id,
                quantity: cartItem.quantity,
                unitPrice: pricing.unitPrice,
                finalPrice: pricing.finalPrice,
                appliedTier: pricing.appliedTier,
                discountAmount: pricing.discountAmount
            });

            totalAmount += pricing.finalPrice;
        }

        // Create new order
        const order = new Order({
            user: userId,
            items: orderItems,
            totalAmount,
            shippingAddress,
            paymentMethod,
            status: "Pending"
        });

        await order.save();

        // Clear the cart after successful order
        cart.products = [];
        await cart.save();

        // Get populated order details
        const populatedOrder = await Order.findById(order._id)
            .populate("user", "name email")
            .populate("items.product", "name price images")
            .populate("items.appliedTier");

        res.json({
            message: "Order placed successfully",
            order: populatedOrder,
            savings: orderItems.reduce((sum, item) => sum + item.discountAmount, 0)
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Get all orders (admin and sellers only)
router.get("/", verifyToken, roleCheck(["admin", "seller"]), async (req, res) => {
    try {
        const orders = await Order.find()
            .populate("user", "name email")
            .populate("items.product", "name price")
            .populate("items.appliedTier")
            .sort({ createdAt: -1 });

        res.json(orders);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Get orders for a specific user
router.get("/user/:userId", verifyToken, roleCheck(["buyer"]), async (req, res) => {
    try {
        const orders = await Order.find({ user: req.params.userId })
            .populate("items.product", "name price images")
            .populate("items.appliedTier")
            .sort({ createdAt: -1 });

        res.json(orders);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Admin orders with pagination and filters
router.get("/admin/orders", verifyToken, roleCheck(["admin"]), async (req, res) => {
    try {
        const { page = 1, limit = 10, status, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

        let filter = {};
        if (status && status !== 'all') filter.status = status;

        const sort = {};
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

        const orders = await Order.find(filter)
            .populate("user", "name email")
            .populate("items.product", "name price images")
            .populate("items.appliedTier")
            .sort(sort)
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Order.countDocuments(filter);

        res.json({
            orders,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Bulk order actions for admin
router.post("/admin/orders/bulk-actions", verifyToken, roleCheck(["admin"]), async (req, res) => {
    try {
        const { orderIds, action } = req.body;

        if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
            return res.status(400).json({ message: "Order IDs are required" });
        }

        let update = {};
        switch (action) {
            case 'processing': update = { status: 'Processing' }; break;
            case 'shipped': update = { status: 'Shipped' }; break;
            case 'delivered': update = { status: 'Delivered' }; break;
            case 'cancelled': update = { status: 'Cancelled' }; break;
            case 'delete':
                await Order.deleteMany({ _id: { $in: orderIds } });
                return res.json({ message: `${orderIds.length} orders deleted` });
            default: return res.status(400).json({ message: "Invalid action" });
        }

        const result = await Order.updateMany({ _id: { $in: orderIds } }, update);
        res.json({ message: `${result.modifiedCount} orders updated`, modifiedCount: result.modifiedCount });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Update order status
router.put("/:orderId/status", verifyToken, roleCheck(["admin", "seller"]), async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;
        const validStatuses = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"];
        if (!validStatuses.includes(status)) return res.status(400).json({ message: "Invalid status value" });

        const order = await Order.findById(orderId).populate("items.product", "name price");
        if (!order) return res.status(404).json({ message: "Order not found" });

        // When order is delivered, track purchases for recommendations
        if (status === "Delivered" && order.status !== "Delivered") {
            for (const item of order.items) {
                try {
                    await fetch(`${process.env.SERVER_URL}/api/activity/purchase/${order.user}/${item.product._id}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': req.headers.authorization }
                    });
                } catch (trackError) { }
            }
        }

        order.status = status;
        await order.save();
        res.json({ message: "Order status updated successfully", order });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Get orders for a specific seller
router.get("/seller/orders", verifyToken, roleCheck(["seller"]), async (req, res) => {
    try {
        const sellerProducts = await Product.find({ seller: req.user.id }).distinct('_id');

        const orders = await Order.find({ 'items.product': { $in: sellerProducts } })
            .populate("user", "name email")
            .populate("items.product", "name price")
            .populate("items.appliedTier")
            .sort({ createdAt: -1 });

        res.json(orders);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Delete an order
router.delete("/:orderId", verifyToken, roleCheck(["admin", "seller"]), async (req, res) => {
    try {
        const order = await Order.findByIdAndDelete(req.params.orderId);
        if (!order) return res.status(404).json({ message: "Order not found" });
        res.json({ message: "Order deleted successfully", orderId: req.params.orderId });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Get buyer statistics
router.get("/buyer/stats", verifyToken, roleCheck(["buyer"]), async (req, res) => {
    try {
        const orders = await Order.find({ user: req.user.id });

        const stats = {
            total: orders.length,
            completed: orders.filter(o => o.status === "Delivered").length,
            pending: orders.filter(o => o.status === "Pending").length,
            processing: orders.filter(o => o.status === "Processing").length,
            shipped: orders.filter(o => o.status === "Shipped").length,
            cancelled: orders.filter(o => o.status === "Cancelled").length,
            totalSpent: orders.filter(o => o.status === "Delivered").reduce((sum, o) => sum + o.totalAmount, 0),
            recentOrders: orders.filter(o => o.createdAt >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length
        };

        res.json(stats);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

module.exports = router;