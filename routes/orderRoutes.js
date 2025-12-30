const express = require("express");
const Order = require("../models/Order");
const Product = require("../models/Product");
const Cart = require("../models/Cart");
const router = express.Router();
const verifyToken = require("../middleware/authMiddleware");
const roleCheck = require("../middleware/roleMiddleware");

async function calculateBulkPrice(product, quantity) {
    if (!product.bulkPricingEnabled || !product.bulkTiers || product.bulkTiers.length === 0) {
        return {
            unitPrice: product.price,
            finalPrice: product.price * quantity,
            finalUnitPrice: product.price,
            appliedTier: null,
            discountAmount: 0
        };
    }

    let populatedProduct = product;
    if (typeof product.bulkTiers[0] === 'object' && product.bulkTiers[0].minQuantity) {
        populatedProduct = product;
    } else {
        populatedProduct = await Product.findById(product._id).populate("bulkTiers");
    }

    const sortedTiers = [...populatedProduct.bulkTiers].sort((a, b) => b.minQuantity - a.minQuantity);
    const applicableTier = sortedTiers.find(tier => quantity >= tier.minQuantity);

    if (!applicableTier) {
        return {
            unitPrice: product.price,
            finalPrice: product.price * quantity,
            finalUnitPrice: product.price,
            appliedTier: null,
            discountAmount: 0
        };
    }

    let finalUnitPrice;
    let discountPerUnit;  // Changed name to be clearer

    if (applicableTier.discountType === "percentage") {
        const discountPercentage = applicableTier.discountValue / 100;
        finalUnitPrice = product.price * (1 - discountPercentage);
        discountPerUnit = product.price - finalUnitPrice;
    } else {
        // Fixed amount discount PER UNIT
        discountPerUnit = applicableTier.discountValue;
        finalUnitPrice = product.price - discountPerUnit;
    }

    // Make sure finalUnitPrice is not negative
    finalUnitPrice = Math.max(finalUnitPrice, 0);

    return {
        unitPrice: product.price,
        finalPrice: finalUnitPrice * quantity,
        finalUnitPrice: finalUnitPrice,
        appliedTier: applicableTier._id,
        discountAmount: discountPerUnit * quantity  // Multiply per-unit discount by quantity
    };
}

// Place Order
router.post("/", verifyToken, roleCheck(["buyer"]), async (req, res) => {
    try {
        const { userId, shippingAddress, paymentMethod } = req.body;
        const cart = await Cart.findOne({ user: userId })
            .populate("products.product")
            .populate("products.appliedTier");

        if (!cart || cart.products.length === 0) {
            return res.status(400).json({ message: "Cart is empty" });
        }

        const orderItems = [];
        let totalAmount = 0;

        for (const cartItem of cart.products) {
            const product = await Product.findById(cartItem.product._id).populate("bulkTiers");

            if (!product) {
                return res.status(404).json({ message: `Product ${cartItem.product.name} not found` });
            }

            const pricing = await calculateBulkPrice(product, cartItem.quantity);

            orderItems.push({
                product: cartItem.product._id,
                quantity: cartItem.quantity,
                unitPrice: pricing.unitPrice,
                finalPrice: pricing.finalPrice,
                appliedTier: pricing.appliedTier,
                discountAmount: pricing.discountAmount
            });

            totalAmount += pricing.finalPrice;
        }

        const order = new Order({
            user: userId,
            items: orderItems,
            totalAmount,
            shippingAddress: shippingAddress,
            paymentMethod,
            status: "Pending",
        });

        await order.save();

        // Clear cart
        cart.products = [];
        await cart.save();

        // Populate order for response
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
        console.error("Order creation error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// View all orders by "Admin/seller"
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

// View order by user
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

// Get orders with admin filters and pagination
router.get("/admin/orders", verifyToken, roleCheck(["admin"]), async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            status,
            search,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        let filter = {};
        if (status && status !== 'all') filter.status = status;
        if (search) {
            filter.$or = [
                { _id: { $regex: search, $options: 'i' } },
                { 'user.name': { $regex: search, $options: 'i' } },
                { 'user.email': { $regex: search, $options: 'i' } }
            ];
        }

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

// Bulk order actions (Admin only)
router.post("/admin/orders/bulk-actions", verifyToken, roleCheck(["admin"]), async (req, res) => {
    try {
        const { orderIds, action } = req.body;

        if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
            return res.status(400).json({ message: "Order IDs are required" });
        }

        let update = {};
        switch (action) {
            case 'processing':
                update = { status: 'Processing' };
                break;
            case 'shipped':
                update = { status: 'Shipped' };
                break;
            case 'delivered':
                update = { status: 'Delivered' };
                break;
            case 'cancelled':
                update = { status: 'Cancelled' };
                break;
            case 'delete':
                await Order.deleteMany({ _id: { $in: orderIds } });
                return res.json({ message: `${orderIds.length} orders deleted` });
            default:
                return res.status(400).json({ message: "Invalid action" });
        }

        const result = await Order.updateMany(
            { _id: { $in: orderIds } },
            update
        );

        res.json({
            message: `${result.modifiedCount} orders updated`,
            modifiedCount: result.modifiedCount
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Update Order Status by "Admin/Seller"
router.put("/:orderId/status", verifyToken, roleCheck(["admin", "seller"]), async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;

        const validStatuses = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: "Invalid status value" });
        }

        const order = await Order.findById(orderId)
            .populate("items.product", "name price")
            .populate("items.appliedTier");

        if (!order) return res.status(404).json({ message: "Order not found" });

        if (status === "Delivered" && order.status !== "Delivered") {
            for (const item of order.items) {
                try {
                    await fetch(`http://localhost:5000/api/activity/purchase/${order.user}/${item.product._id}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': req.headers.authorization
                        }
                    });
                } catch (trackError) {
                    console.error(`Failed to track purchase for product ${item.product._id}:`, trackError);
                }
            }
        }

        order.status = status;
        await order.save();

        res.json({ message: "Order status updated successfully", order });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Get seller's orders only
router.get("/seller/orders", verifyToken, roleCheck(["seller"]), async (req, res) => {
    try {
        const sellerId = req.user.id;

        const sellerProducts = await Product.find({ seller: sellerId }).distinct('_id');

        const orders = await Order.find({
            'items.product': { $in: sellerProducts }
        })
            .populate("user", "name email")
            .populate("items.product", "name price")
            .populate("items.appliedTier")
            .sort({ createdAt: -1 });

        res.json(orders);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Delete order by "admin/seller" 
router.delete("/:orderId", verifyToken, roleCheck(["admin", "seller"]), async (req, res) => {
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

router.get("/buyer/stats", verifyToken, roleCheck(["buyer"]), async (req, res) => {
    try {
        const buyerId = req.user.id;

        // Get all orders for this buyer
        const orders = await Order.find({ user: buyerId });

        // Calculate statistics
        const stats = {
            total: orders.length,
            completed: orders.filter(order => order.status === "Delivered").length,
            pending: orders.filter(order => order.status === "Pending").length,
            processing: orders.filter(order => order.status === "Processing").length,
            shipped: orders.filter(order => order.status === "Shipped").length,
            cancelled: orders.filter(order => order.status === "Cancelled").length
        };

        // Calculate total spent
        stats.totalSpent = orders
            .filter(order => order.status === "Delivered")
            .reduce((sum, order) => sum + order.totalAmount, 0);

        // Add recent orders count (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        stats.recentOrders = orders.filter(order =>
            order.createdAt >= thirtyDaysAgo
        ).length;

        res.json(stats);
    } catch (err) {
        console.error("Buyer stats error:", err);
        res.status(500).json({
            message: "Server error",
            error: err.message
        });
    }
});

module.exports = router;