const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/User");
const Product = require("../models/Product");
const Ad = require("../models/ad");
const Payment = require("../models/payment");
const Order = require("../models/Order");
const Profile = require("../models/Profile");
const verifyToken = require("../middleware/authMiddleware");
const roleCheck = require("../middleware/roleMiddleware");
const router = express.Router();

// Get pending seller applications
router.get("/sellers/pending", verifyToken, roleCheck(["admin"]), async (req, res) => {
    try {
        const { page = 1, limit = 10, search } = req.query;

        let filter = {
            role: "seller_pending",
            approvalStatus: "pending"
        };

        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        const pendingSellers = await User.find(filter)
            .select("-password")
            .sort({ submittedAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        // Get profiles for business info
        const sellersWithProfiles = await Promise.all(
            pendingSellers.map(async (seller) => {
                const profile = await Profile.findOne({ user: seller._id });
                return {
                    ...seller.toObject(),
                    businessProfile: profile
                };
            })
        );

        const total = await User.countDocuments(filter);

        res.json({
            sellers: sellersWithProfiles,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Approve seller
router.put("/sellers/:id/approve", verifyToken, roleCheck(["admin"]), async (req, res) => {
    try {
        const seller = await User.findByIdAndUpdate(
            req.params.id,
            {
                role: "seller_approved",
                approvalStatus: "approved",
                approvalDate: new Date()
            },
            { new: true }
        ).select("-password");

        if (!seller) return res.status(404).json({ message: "Seller not found" });

        res.json({
            message: "Seller approved successfully",
            seller
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Reject seller
router.put("/sellers/:id/reject", verifyToken, roleCheck(["admin"]), async (req, res) => {
    try {
        const { rejectedReason } = req.body;

        const seller = await User.findByIdAndUpdate(
            req.params.id,
            {
                role: "buyer",
                approvalStatus: "rejected",
                rejectedReason
            },
            { new: true }
        ).select("-password");

        if (!seller) return res.status(404).json({ message: "Seller not found" });

        res.json({
            message: "Seller application rejected",
            seller
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Bulk seller actions
router.post("/sellers/bulk-actions", verifyToken, roleCheck(["admin"]), async (req, res) => {
    try {
        const { sellerIds, action, rejectedReason } = req.body;

        if (!sellerIds || !Array.isArray(sellerIds) || sellerIds.length === 0) {
            return res.status(400).json({ message: "Seller IDs are required" });
        }

        let update = {};
        switch (action) {
            case 'approve':
                update = {
                    role: "seller_approved",
                    approvalStatus: "approved",
                    approvalDate: new Date()
                };
                break;
            case 'reject':
                update = {
                    role: "buyer",
                    approvalStatus: "rejected",
                    rejectedReason: rejectedReason || "Application rejected by admin"
                };
                break;
            default:
                return res.status(400).json({ message: "Invalid action" });
        }

        const result = await User.updateMany(
            { _id: { $in: sellerIds }, role: "seller_pending" },
            update
        );

        res.json({
            message: `${result.modifiedCount} seller applications updated`,
            modifiedCount: result.modifiedCount
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Get seller approval stats
router.get("/sellers/stats", verifyToken, roleCheck(["admin"]), async (req, res) => {
    try {
        const pendingSellers = await User.countDocuments({
            role: "seller_pending",
            approvalStatus: "pending"
        });
        const approvedSellers = await User.countDocuments({
            role: "seller_approved"
        });
        const rejectedSellers = await User.countDocuments({
            approvalStatus: "rejected"
        });
        const totalSellers = await User.countDocuments({
            $or: [{ role: "seller_approved" }, { role: "seller_pending" }]
        });

        res.status(200).json({
            pendingSellers,
            approvedSellers,
            rejectedSellers,
            totalSellers
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// View all users (updated filter)
router.get("/users", verifyToken, roleCheck(["admin"]), async (req, res) => {
    try {
        const { page = 1, limit = 10, role, status, search } = req.query;

        let filter = {};
        if (role && role !== 'all') {
            if (role === 'seller') {
                // Show both seller types
                filter.role = { $in: ["seller_pending", "seller_approved"] };
            } else {
                // Handle other roles including buyer and admin
                filter.role = role;
            }
        }

        // If no role filter is applied, show all users including sellers
        if (status && status !== 'all') {
            if (status === 'blocked') {
                filter.isBlocked = true;
            } else if (status === 'active') {
                filter.isBlocked = false;
            } else if (status === 'pending_approval') {
                filter.approvalStatus = 'pending';
            }
        }

        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        const users = await User.find(filter)
            .select("-password")
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await User.countDocuments(filter);

        res.json({
            users,
            totalPages: Math.ceil(total / limit),
            currentPage: parseInt(page),
            total: parseInt(total)
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Update user role
router.put("/users/:id/role", verifyToken, roleCheck(["admin"]), async (req, res) => {
    try {
        const { role } = req.body;
        const validRoles = ["buyer", "seller_pending", "seller_approved", "admin"];

        if (!validRoles.includes(role)) {
            return res.status(400).json({ message: "Invalid role value" });
        }

        const user = await User.findByIdAndUpdate(
            req.params.id,
            { role },
            { new: true }
        ).select("-password");

        if (!user) return res.status(404).json({ message: "User not found" });
        res.json({ message: "User role updated", user });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Admin Dashboard 
router.get("/stats", verifyToken, roleCheck(["admin"]), async (req, res) => {
    try {
        // basic couts
        const totalUsers = await User.countDocuments();
        const totalBuyers = await User.countDocuments({ role: "buyer" });
        const approvedSellers = await User.countDocuments({ role: "seller_approved" });
        const pendingSellers = await User.countDocuments({ role: "seller_pending", approvalStatus: "pending" });
        const totalSellers = approvedSellers + pendingSellers;
        const blockedUsers = await User.countDocuments({ isBlocked: true });
        const totalProducts = await Product.countDocuments();
        const totalOrders = await Order.countDocuments();

        // Advertising calculation
        const adCounts = {
            totalAds: await Ad.countDocuments(),
            activeAds: await Ad.countDocuments({ isActive: true, status: "approved" }),
            pendingAds: await Ad.countDocuments({ status: "pending" }),
            approvedAds: await Ad.countDocuments({ status: "approved" }),
            rejectedAds: await Ad.countDocuments({ status: "rejected" })
        };

        // Payment status count
        const paymentStats = await Payment.aggregate([
            {
                $match: { paymentFor: "ad" }
            },
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 },
                    totalAmount: { $sum: "$amount" }
                }
            }
        ]);

        // Convert to object
        const paymentStatsObj = {};
        paymentStats.forEach(item => {
            paymentStatsObj[item._id] = {
                count: item.count,
                amount: item.totalAmount
            };
        });

        // Calculate "Awaiting Payment"(Approved ads with payment status "pending")
        const awaitingPaymentAds = await Ad.countDocuments({
            status: "approved",
            isActive: false,
            $or: [
                { payment: { $exists: false } },
                {
                    payment: { $exists: true },
                    $expr: {
                        $eq: [
                            { $ifNull: ["$payment.status", "pending"] },
                            "pending"
                        ]
                    }
                }
            ]
        });

        // Calculate "Pending Approval"(Payment proof uploaded)
        const pendingApprovalAds = await Ad.countDocuments({
            status: "approved",
            isActive: false,
            "payment.status": "processing"
        });

        // Calculate "Paid & Active" ads
        const paidActiveAds = await Ad.countDocuments({
            status: "approved",
            isActive: true,
            "payment.status": "completed"
        });

        // Revenue calc
        const completedRevenueAgg = await Payment.aggregate([
            {
                $match: {
                    paymentFor: "ad",
                    status: "completed"
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$amount" }
                }
            }
        ]);

        const pendingRevenueAgg = await Payment.aggregate([
            {
                $match: {
                    paymentFor: "ad",
                    status: { $in: ["pending", "processing"] }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$amount" }
                }
            }
        ]);

        const potentialRevenueAgg = await Ad.aggregate([
            {
                $match: {
                    status: "approved",
                    isActive: false
                }
            },
            {
                $lookup: {
                    from: "payments",
                    localField: "payment",
                    foreignField: "_id",
                    as: "paymentDetails"
                }
            },
            {
                $addFields: {
                    paymentStatus: {
                        $ifNull: [
                            { $arrayElemAt: ["$paymentDetails.status", 0] },
                            "pending"
                        ]
                    }
                }
            },
            {
                $match: {
                    paymentStatus: { $in: ["pending", "processing"] }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$totalCost" }
                }
            }
        ]);

        // Extract values
        const completedRevenue = completedRevenueAgg[0]?.total || 0;
        const pendingRevenue = pendingRevenueAgg[0]?.total || 0;
        const potentialRevenue = potentialRevenueAgg[0]?.total || 0;

        // monthly revenue
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();

        const monthlyRevenueAgg = await Payment.aggregate([
            {
                $match: {
                    paymentFor: "ad",
                    status: "completed",
                    createdAt: {
                        $gte: new Date(currentYear, currentMonth, 1),
                        $lt: new Date(currentYear, currentMonth + 1, 1)
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: "$amount" }
                }
            }
        ]);

        const monthlyRevenue = monthlyRevenueAgg[0]?.total || 0;

        // ad performance
        const adPerformance = await Ad.aggregate([
            {
                $match: { status: "approved" }
            },
            {
                $group: {
                    _id: null,
                    totalImpressions: { $sum: "$impressions" },
                    totalClicks: { $sum: "$clicks" },
                    avgCTR: { $avg: "$ctr" }
                }
            }
        ]);

        // Order Statistics
        const orderStatusStats = await Order.aggregate([
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 },
                    totalAmount: { $sum: "$totalAmount" }
                }
            },
            { $sort: { count: -1 } }
        ]);

        const orderStatus = orderStatusStats.reduce((acc, stat) => {
            acc[stat._id] = {
                count: stat.count,
                totalAmount: stat.totalAmount
            };
            return acc;
        }, {});

        // Total Sales
        const salesAgg = await Order.aggregate([
            {
                $match: { status: "Delivered" }
            },
            {
                $group: {
                    _id: null,
                    totalSales: { $sum: "$totalAmount" },
                    orderCount: { $sum: 1 }
                }
            }
        ]);

        const totalSales = salesAgg[0]?.totalSales || 0;
        const deliveredOrders = orderStatus["Delivered"]?.count || 0;

        // Monthly sales
        const monthlySalesAgg = await Order.aggregate([
            {
                $match: {
                    status: "Delivered",
                    createdAt: {
                        $gte: new Date(currentYear, currentMonth, 1),
                        $lt: new Date(currentYear, currentMonth + 1, 1)
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    monthlySales: { $sum: "$totalAmount" },
                    monthlyOrders: { $sum: 1 }
                }
            }
        ]);

        const monthlySales = monthlySalesAgg[0]?.monthlySales || 0;
        const monthlyOrders = monthlySalesAgg[0]?.monthlyOrders || 0;

        // final
        const response = {
            // user stats
            totalUsers,
            totalBuyers,
            totalSellers,
            approvedSellers,
            pendingSellers,
            blockedUsers,

            // product and order stats
            totalProducts,
            totalOrders,
            monthlyOrders,

            // Sales
            totalSales,
            monthlySales,
            deliveredOrders,

            // advertisment
            advertising: {
                // Ad counts
                totalAds: adCounts.totalAds,
                activeAds: adCounts.activeAds,
                pendingAds: adCounts.pendingAds,
                approvedAds: adCounts.approvedAds,
                rejectedAds: adCounts.rejectedAds,

                // Payment status counts
                awaitingPaymentCount: awaitingPaymentAds,
                pendingApprovalCount: pendingApprovalAds,
                paidAds: paidActiveAds,

                // Revenue
                revenue: completedRevenue,
                monthlyRevenue: monthlyRevenue,
                approvedRevenue: potentialRevenue,
                pendingRevenue: pendingRevenue,

                // Payment breakdown 
                paymentBreakdown: {
                    completed: paymentStatsObj.completed?.count || 0,
                    processing: paymentStatsObj.processing?.count || 0,
                    pending: paymentStatsObj.pending?.count || 0,
                    failed: paymentStatsObj.failed?.count || 0
                },

                // Performance
                impressions: adPerformance[0]?.totalImpressions || 0,
                clicks: adPerformance[0]?.totalClicks || 0,
                avgCTR: adPerformance[0]?.avgCTR || 0
            },

            // Revenue summary
            revenue: {
                totalRevenue: completedRevenue,
                monthlyTotalRevenue: monthlyRevenue,
                totalPotentialRevenue: potentialRevenue,
                pendingRevenue: pendingRevenue
            },

            // order stats
            orderStatus,
            averageOrderValue: totalOrders > 0 ? (totalSales / totalOrders).toFixed(2) : 0,
            conversionRate: totalUsers > 0 ? ((totalOrders / totalUsers) * 100).toFixed(1) + "%" : "0%",
            lastUpdated: new Date()
        };
        res.status(200).json(response);

    } catch (err) {
        console.error("Admin stats ERROR:", err);
        res.status(500).json({
            message: "Server error",
            error: err.message
        });
    }
});

// Bulk user actions (Admin only)
router.post("/users/bulk-actions", verifyToken, roleCheck(["admin"]), async (req, res) => {
    try {
        const { userIds, action } = req.body;

        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ message: "User IDs are required" });
        }

        let update = {};
        switch (action) {
            case 'activate':
                update = { isBlocked: false };
                break;
            case 'block':
                update = { isBlocked: true };
                break;
            case 'delete':
                await User.deleteMany({ _id: { $in: userIds } });
                return res.json({ message: `${userIds.length} users deleted` });
            case 'approve_sellers':
                update = { isBlocked: false, role: 'seller' };
                break;
            default:
                return res.status(400).json({ message: "Invalid action" });
        }

        const result = await User.updateMany(
            { _id: { $in: userIds } },
            update
        );

        res.json({
            message: `${result.modifiedCount} users updated`,
            modifiedCount: result.modifiedCount
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Delete user (Admin only)
router.delete("/users/:id", verifyToken, roleCheck(["admin"]), async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) return res.status(404).json({ message: "User not found" });
        res.json({ message: "User deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Get recent activities
router.get("/recent-activities", verifyToken, roleCheck(["admin"]), async (req, res) => {
    try {
        const recentUsers = await User.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .select("name email role createdAt isBlocked");

        const recentProducts = await Product.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .populate("category", "name")
            .populate("seller", "name email");

        const recentOrders = await Order.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .populate("user", "name email")
            .select("totalAmount status createdAt");

        res.status(200).json({
            users: recentUsers,
            products: recentProducts,
            orders: recentOrders,
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Quick stats
router.get("/quick-stats", verifyToken, roleCheck(["admin"]), async (req, res) => {
    try {
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

        // Monthly Revenue
        const monthlyRevenueData = await Order.aggregate([
            {
                $match: {
                    createdAt: { $gte: startOfMonth, $lte: endOfMonth },
                    status: { $ne: "Cancelled" }
                }
            },
            { $group: { _id: null, total: { $sum: "$totalAmount" } } },
        ]);
        const monthlyRevenue = monthlyRevenueData[0]?.total || 0;

        const totalOrders = await Order.countDocuments();
        const totalBuyers = await User.countDocuments({ role: "buyer" });
        const conversionRate = totalBuyers > 0 ? ((totalOrders / totalBuyers) * 100).toFixed(1) + "%" : "0%";

        // Active sessions (users active in last 30 minutes)
        const activeSessions = await User.countDocuments({
            updatedAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) },
        });

        res.status(200).json({
            monthlyRevenue,
            totalOrders,
            conversionRate,
            activeSessions,
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Seller dashboard statistics
router.get("/seller/stats", verifyToken, roleCheck(["seller"]), async (req, res) => {
    try {
        const sellerId = req.user.id;

        // Basic product stats
        const totalProducts = await Product.countDocuments({ seller: sellerId });

        const activeProducts = await Product.countDocuments({
            seller: sellerId,
            stock: { $gt: 0 }
        });

        const lowStockProducts = await Product.countDocuments({
            seller: sellerId,
            stock: { $lt: 10, $gt: 0 }
        });

        const outOfStockProducts = await Product.countDocuments({
            seller: sellerId,
            stock: 0
        });

        // Get seller's product IDs
        const sellerProducts = await Product.find({ seller: sellerId }).select('_id');
        const sellerProductIds = sellerProducts.map(p => p._id);

        // Order statistics
        const totalOrders = await Order.countDocuments({
            'items.product': { $in: sellerProductIds }
        });

        const pendingOrders = await Order.countDocuments({
            'items.product': { $in: sellerProductIds },
            status: 'Pending'
        });

        // Revenue calculation using aggregation
        const revenueAggregation = await Order.aggregate([
            {
                $match: {
                    'items.product': { $in: sellerProductIds },
                    status: "Delivered"
                }
            },
            { $unwind: "$items" },
            {
                $match: {
                    'items.product': { $in: sellerProductIds }
                }
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: {
                        $sum: {
                            $multiply: [
                                "$items.unitPrice",
                                "$items.quantity"
                            ]
                        }
                    }
                }
            }
        ]);

        // Extract total revenue or default to 0
        const totalRevenue = revenueAggregation.length > 0 ? revenueAggregation[0].totalRevenue : 0;

        // Other status counts
        const processingOrders = await Order.countDocuments({
            'items.product': { $in: sellerProductIds },
            status: 'Processing'
        });

        const shippedOrders = await Order.countDocuments({
            'items.product': { $in: sellerProductIds },
            status: 'Shipped'
        });

        const deliveredOrders = await Order.countDocuments({
            'items.product': { $in: sellerProductIds },
            status: 'Delivered'
        });

        const cancelledOrders = await Order.countDocuments({
            'items.product': { $in: sellerProductIds },
            status: 'Cancelled'
        });

        const stats = {
            // Product stats
            totalProducts,
            activeProducts,
            lowStockProducts,
            outOfStockProducts,

            // Order counts
            totalOrders,
            pendingOrders,
            processingOrders,
            shippedOrders,
            deliveredOrders,
            cancelledOrders,

            // Revenue
            totalRevenue,
            successRate: totalOrders > 0 ?
                ((deliveredOrders / totalOrders) * 100).toFixed(1) + "%" : "0%"
        };

        res.json(stats);

    } catch (err) {
        console.error("Seller stats error:", err);
        res.status(500).json({
            message: "Server error in seller stats",
            error: err.message
        });
    }
});

module.exports = router;
