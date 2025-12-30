const express = require("express");
const Ad = require("../models/ad");
const Payment = require("../models/payment");
const { getPaymentInstructions } = require("../utils/paymentInstructions");
const verifyToken = require("../middleware/authMiddleware");
const roleCheck = require("../middleware/roleMiddleware");

const router = express.Router();

// Payment Instructions
router.get("/instructions/:adId", async (req, res) => {
    try {
        const ad = await Ad.findById(req.params.adId);
        if (!ad) return res.status(404).json({ message: "Ad not found" });

        const paymentInstructions = getPaymentInstructions(ad);
        res.json(paymentInstructions);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Create payment record when ad is approved
router.post("/ad/:adId/initiate", verifyToken, roleCheck(["seller"]), async (req, res) => {
    try {
        const ad = await Ad.findById(req.params.adId);
        if (!ad) return res.status(404).json({ message: "Ad not found" });

        // Check if payment already exists
        const existingPayment = await Payment.findOne({ itemId: ad._id, paymentFor: "ad" });
        if (existingPayment) {
            return res.json({
                message: "Payment already initiated",
                payment: existingPayment
            });
        }

        // Create new payment record
        const payment = new Payment({
            payer: req.user.id,
            paymentFor: "ad",
            itemId: ad._id,
            amount: ad.totalCost,
            method: "pending", // Seller will choose method later
            status: "pending"  // Payment not started yet
        });

        await payment.save();

        // Link payment to ad
        ad.payment = payment._id;
        await ad.save();

        res.status(201).json({
            message: "Payment initiated successfully",
            payment: payment
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Get payment status for an ad
router.get("/ad/:adId/status", verifyToken, async (req, res) => {
    try {
        const ad = await Ad.findById(req.params.adId).populate("payment");
        if (!ad) return res.status(404).json({ message: "Ad not found" });

        if (!ad.payment) {
            return res.json({
                paymentStatus: "not_initiated",
                message: "Payment not yet initiated"
            });
        }

        res.json({
            paymentStatus: ad.payment.status,
            paymentMethod: ad.payment.method,
            payment: ad.payment
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// NEW: Update payment method (online vs bank transfer)
router.put("/:paymentId/method", verifyToken, async (req, res) => {
    try {
        const { method } = req.body; // "jazzcash", "easypaisa", or "bank_transfer"
        const validMethods = ["jazzcash", "easypaisa", "bank_transfer"];

        if (!validMethods.includes(method)) {
            return res.status(400).json({ message: "Invalid payment method" });
        }

        const payment = await Payment.findById(req.params.paymentId);
        if (!payment) return res.status(404).json({ message: "Payment not found" });

        // Verify user owns this payment
        if (payment.payer.toString() !== req.user.id) {
            return res.status(403).json({ message: "Not authorized" });
        }

        payment.method = method;
        await payment.save();

        res.json({
            message: `Payment method set to ${method}`,
            payment: payment
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// NEW: Upload payment proof for bank transfer
router.post("/:paymentId/upload-proof", verifyToken, async (req, res) => {
    try {
        const { imageUrl } = req.body;

        if (!imageUrl) {
            return res.status(400).json({ message: "Image URL is required" });
        }

        const payment = await Payment.findById(req.params.paymentId);
        if (!payment) return res.status(404).json({ message: "Payment not found" });

        // Verify user owns this payment
        if (payment.payer.toString() !== req.user.id) {
            return res.status(403).json({ message: "Not authorized" });
        }

        // Allow upload if method is "pending" or "bank_transfer"
        // When seller chooses bank transfer, they can upload proof
        if (!["pending", "bank_transfer"].includes(payment.method)) {
            return res.status(400).json({
                message: "Proof upload only for bank transfers. For online payments, use the online payment option."
            });
        }

        payment.proofImage = imageUrl;

        // If method was "pending", set it to "bank_transfer"
        if (payment.method === "pending") {
            payment.method = "bank_transfer";
        }

        payment.status = "processing"; // Waiting for admin verification
        await payment.save();

        res.json({
            message: "Payment proof uploaded successfully",
            payment: payment
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// NEW: Simulate online payment (for now - replace with real API later)
router.post("/:paymentId/process-online", verifyToken, async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.paymentId);
        if (!payment) return res.status(404).json({ message: "Payment not found" });

        // Verify user owns this payment
        if (payment.payer.toString() !== req.user.id) {
            return res.status(403).json({ message: "Not authorized" });
        }

        // Only allow if method is "pending" or already set to online method
        if (!["pending", "jazzcash", "easypaisa"].includes(payment.method)) {
            return res.status(400).json({
                message: "This method only for online payments. For bank transfer, upload payment proof."
            });
        }

        // SIMULATION - Replace with real JazzCash/EasyPaisa API later
        const transactionId = `ONLINE_${Date.now()}`;

        // If method was "pending", require method in request body
        if (payment.method === "pending") {
            const { method } = req.body;
            if (!["jazzcash", "easypaisa"].includes(method)) {
                return res.status(400).json({
                    message: "Please specify payment method: 'jazzcash' or 'easypaisa'"
                });
            }
            payment.method = method;
        }

        payment.transactionId = transactionId;
        payment.status = "completed";
        payment.paidAt = new Date();
        await payment.save();

        // Activate the ad automatically for online payments
        const ad = await Ad.findById(payment.itemId);
        if (ad) {
            ad.isActive = true;
            await ad.save();
        }

        res.json({
            message: "Payment completed successfully",
            payment: payment,
            transactionId: transactionId
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// NEW: Get all pending payments for admin
router.get("/admin/pending", verifyToken, roleCheck(["admin"]), async (req, res) => {
    try {
        const payments = await Payment.find({
            status: { $in: ["processing", "pending"] }
        })
            .populate("payer", "name email")
            .populate({
                path: "itemId",
                select: "title description"
            })
            .sort({ createdAt: -1 });

        // Get the count of pending payments
        const pendingPaymentsCount = await Payment.countDocuments({
            status: { $in: ["processing", "pending"] }
        });

        res.json({
            message: "Pending payments retrieved successfully",
            count: pendingPaymentsCount,
            payments: payments
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// NEW: Verify payment (mark as completed)
router.put("/admin/:paymentId/verify", verifyToken, roleCheck(["admin"]), async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.paymentId);
        if (!payment) return res.status(404).json({ message: "Payment not found" });

        // Check if payment is already completed
        if (payment.status === "completed") {
            return res.status(400).json({ message: "Payment already verified" });
        }

        // Update payment status
        payment.status = "completed";
        payment.verifiedAt = new Date();
        payment.verifiedBy = req.user.id;
        await payment.save();

        // Activate the ad
        const ad = await Ad.findById(payment.itemId);
        if (ad) {
            if (ad.status === "approved") {
                ad.isActive = true;
                await ad.save();
            } else {
                console.log(`Ad ${ad._id} is not approved, cannot activate. Status: ${ad.status}`);
            }
        }

        res.json({
            message: "Payment verified successfully",
            payment: payment
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Reject payment (mark as failed)
router.put("/admin/:paymentId/reject", verifyToken, roleCheck(["admin"]), async (req, res) => {
    try {
        const { reason } = req.body;
        const payment = await Payment.findById(req.params.paymentId);
        if (!payment) return res.status(404).json({ message: "Payment not found" });

        // Payment "failed"
        payment.status = "failed";
        payment.verifiedAt = new Date();
        payment.verifiedBy = req.user.id;
        await payment.save();

        // Update Associated ad
        const ad = await Ad.findById(payment.itemId);
        if (ad) {
            ad.status = "rejected";
            ad.isActive = false;

            if (reason) {
                ad.rejectionReason = reason;
            }

            await ad.save();
        }

        res.json({
            message: "Payment rejected successfully",
            payment: payment,
            adUpdated: !!ad,
            reason: reason || "Payment proof not valid"
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// NEW: Get payment statistics for admin dashboard
router.get("/admin/statistics", verifyToken, roleCheck(["admin"]), async (req, res) => {
    try {
        const totalPayments = await Payment.countDocuments();

        // "Awaiting Payment" - payment created but method not chosen
        const awaitingPaymentCount = await Payment.countDocuments({
            status: "pending",
            method: "pending"
        });

        // "Pending Approval" - proof uploaded, waiting for admin verification
        const pendingApprovalCount = await Payment.countDocuments({
            status: "processing"
        });

        const completedPayments = await Payment.countDocuments({ status: "completed" });
        const failedPayments = await Payment.countDocuments({ status: "failed" });

        const totalRevenue = await Payment.aggregate([
            { $match: { status: "completed" } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);

        res.json({
            totalPayments,
            awaitingPaymentCount,    // "Awaiting Payment" - payment not started
            pendingApprovalCount,    // "Pending Approval" - proof uploaded
            completedPayments,       // Completed payments
            failedPayments,          // Failed payments
            totalRevenue: totalRevenue[0]?.total || 0,

            // Breakdown by method
            paymentMethods: {
                bankTransfer: await Payment.countDocuments({ method: "bank_transfer" }),
                jazzcash: await Payment.countDocuments({ method: "jazzcash" }),
                easypaisa: await Payment.countDocuments({ method: "easypaisa" }),
                pendingMethod: await Payment.countDocuments({ method: "pending" })
            }
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Seller completes payment (uploads proof or confirms online payment) - MAIN ENDPOINT
router.post("/:paymentId/complete", verifyToken, async (req, res) => {
    try {
        const { paymentMethod, proofImage, transactionId } = req.body;
        const payment = await Payment.findById(req.params.paymentId);

        if (!payment) return res.status(404).json({ message: "Payment not found" });

        // Verify user owns this payment
        if (payment.payer.toString() !== req.user.id) {
            return res.status(403).json({ message: "Not authorized" });
        }

        // Check if payment is already completed
        if (payment.status === "completed") {
            return res.status(400).json({ message: "Payment already completed" });
        }

        // Update payment based on method
        if (paymentMethod === "bank_transfer") {
            if (!proofImage) {
                return res.status(400).json({ message: "Payment proof image required for bank transfer" });
            }

            payment.method = "bank_transfer";
            payment.proofImage = proofImage;
            payment.status = "processing"; // Wait for admin verification
            await payment.save();

            // Ad remains inactive until admin verification
            await Ad.findByIdAndUpdate(payment.itemId, {
                isActive: false
            });

            res.json({
                message: "Bank transfer payment submitted. Awaiting admin verification.",
                payment: payment,
                nextStep: "Admin will verify your payment proof and activate your ad."
            });

        } else if (["jazzcash", "easypaisa"].includes(paymentMethod)) {
            // For online payments
            payment.method = paymentMethod;
            payment.transactionId = transactionId || `${paymentMethod.toUpperCase()}_${Date.now()}`;
            payment.status = "completed";
            payment.paidAt = new Date();
            await payment.save();

            // Activate the ad immediately for online payments
            await Ad.findByIdAndUpdate(payment.itemId, {
                isActive: true
            });

            res.json({
                message: "Online payment completed successfully! Your ad is now active.",
                payment: payment,
                adActivated: true,
                transactionId: payment.transactionId
            });

        } else {
            return res.status(400).json({
                message: "Invalid payment method. Choose 'bank_transfer', 'jazzcash', or 'easypaisa'"
            });
        }

    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Get seller's pending payments
router.get("/seller/pending", verifyToken, roleCheck(["seller"]), async (req, res) => {
    try {
        const payments = await Payment.find({
            payer: req.user.id,
            paymentFor: "ad",
            status: { $in: ["pending", "processing"] }
        })
            .populate({
                path: "itemId",
                select: "title description totalCost"
            })
            .sort({ createdAt: -1 });

        res.json({
            message: "Pending payments retrieved successfully",
            payments: payments
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Get payment history for seller
router.get("/seller/history", verifyToken, roleCheck(["seller"]), async (req, res) => {
    try {
        const payments = await Payment.find({
            payer: req.user.id,
            paymentFor: "ad"
        })
            .populate({
                path: "itemId",
                select: "title description"
            })
            .sort({ createdAt: -1 });

        res.json({
            message: "Payment history retrieved successfully",
            payments: payments
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

module.exports = router;