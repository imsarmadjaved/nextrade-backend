const express = require("express");
const Payment = require("../models/payment");
const verifyToken = require("../middleware/authMiddleware");
const { uploadSingle } = require("../middleware/upload");
const { roleCheck } = require("../middleware/roleMiddleware");
const Ad = require("../models/ad");
const router = express.Router();

// Upload payment proof (bank transfer)
router.post("/:paymentId/upload-proof",
    verifyToken,
    uploadSingle("image", "payments"),
    async (req, res) => {
        try {
            const payment = await Payment.findById(req.params.paymentId);
            if (!payment) return res.status(404).json({ message: "Payment not found" });

            if (payment.payer.toString() !== req.user.id) {
                return res.status(403).json({ message: "Not authorized" });
            }

            if (!["pending", "bank_transfer"].includes(payment.method)) {
                return res.status(400).json({
                    message: "Proof upload only allowed for bank transfers or pending payments."
                });
            }

            // Check if image was uploaded
            if (!req.file || !req.file.cloudinary) {
                return res.status(400).json({ message: "Valid image file is required." });
            }

            // Create image object in the same format as products
            const paymentProof = {
                url: req.file.cloudinary.url,
                publicId: req.file.cloudinary.publicId
            };

            // Store as array of image objects (for consistency with other models)
            payment.images = [paymentProof];

            if (payment.method === "pending") {
                payment.method = "bank_transfer";
            }

            payment.status = "processing";
            payment.paymentProof = paymentProof; // Also store single reference if needed
            await payment.save();

            res.json({
                message: "Payment proof uploaded successfully",
                image: paymentProof, // Return single image object
                payment
            });

        } catch (err) {
            res.status(500).json({ message: "Server error", error: err.message });
        }
    });

// Get payment proof image
router.get("/:paymentId/proof-image", verifyToken, async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.paymentId);
        if (!payment) return res.status(404).json({ message: "Payment not found" });

        // Check authorization
        if (payment.payer.toString() !== req.user.id && req.user.role !== "admin") {
            return res.status(403).json({ message: "Not authorized" });
        }

        // Get image from images array (or fallback to paymentProof)
        let image = null;

        if (payment.images && payment.images.length > 0) {
            // Get first image from array
            image = payment.images[0];
        } else if (payment.paymentProof && typeof payment.paymentProof === 'object') {
            // Fallback to paymentProof field (for backward compatibility)
            image = payment.paymentProof;
        } else if (typeof payment.paymentProof === 'string') {
            // If it's stored as string URL (legacy format)
            image = {
                url: payment.paymentProof,
                publicId: null
            };
        }

        res.json({
            image,
            // Include payment info for context
            paymentId: payment._id,
            status: payment.status,
            method: payment.method
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Get pending payments for admin
router.get("/admin/pending", verifyToken, roleCheck(["admin"]), async (req, res) => {
    try {
        const pendingPayments = await Payment.find({
            status: { $in: ["pending", "processing"] },
            paymentFor: "ad"
        })
            .populate("payer", "name email")
            .populate({
                path: "itemId",
                select: "title totalCost status isActive",
                model: "Ad"
            })
            .sort({ createdAt: -1 });

        res.json({
            payments: pendingPayments,
            count: pendingPayments.length
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Get payment statistics for admin
router.get("/admin/statistics", verifyToken, roleCheck(["admin"]), async (req, res) => {
    try {
        const stats = await Payment.aggregate([
            {
                $match: { paymentFor: "ad" }
            },
            {
                $group: {
                    _id: null,
                    totalPayments: { $sum: 1 },
                    totalRevenue: { $sum: "$amount" },
                    awaitingPaymentCount: {
                        $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] }
                    },
                    pendingApprovalCount: {
                        $sum: { $cond: [{ $eq: ["$status", "processing"] }, 1, 0] }
                    },
                    completedPayments: {
                        $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] }
                    },
                    failedPayments: {
                        $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] }
                    }
                }
            }
        ]);

        // Get recent payments
        const recentPayments = await Payment.find({ paymentFor: "ad" })
            .populate("payer", "name email")
            .populate({
                path: "itemId",
                select: "title",
                model: "Ad"
            })
            .sort({ createdAt: -1 })
            .limit(10);

        res.json({
            ...(stats[0] || {
                totalPayments: 0,
                totalRevenue: 0,
                awaitingPaymentCount: 0,
                pendingApprovalCount: 0,
                completedPayments: 0,
                failedPayments: 0
            }),
            recentPayments: recentPayments
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Admin verify payment
router.put("/admin/:paymentId/verify", verifyToken, roleCheck(["admin"]), async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.paymentId);
        if (!payment) {
            return res.status(404).json({ message: "Payment not found" });
        }

        // Update payment status
        payment.status = "completed";
        payment.verifiedAt = new Date();
        payment.verifiedBy = req.user.id;
        await payment.save();

        // Find and update the associated ad
        const ad = await Ad.findById(payment.itemId);
        if (ad) {
            ad.status = "approved";
            ad.payment = payment._id;
            ad.isActive = true;
            ad.approvedAt = new Date();
            await ad.save();

            // Send confirmation email
            await sendPaymentConfirmationEmail(ad);
        }

        res.json({
            message: "Payment verified successfully",
            payment,
            ad
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Admin reject payment
router.put("/admin/:paymentId/reject", verifyToken, roleCheck(["admin"]), async (req, res) => {
    try {
        const { reason } = req.body;
        if (!reason) {
            return res.status(400).json({ message: "Rejection reason is required" });
        }

        const payment = await Payment.findById(req.params.paymentId);
        if (!payment) {
            return res.status(404).json({ message: "Payment not found" });
        }

        // Update payment status
        payment.status = "failed";
        payment.rejectionReason = reason;
        payment.verifiedAt = new Date();
        payment.verifiedBy = req.user.id;
        await payment.save();

        // Find and update the associated ad
        const ad = await Ad.findById(payment.itemId);
        if (ad) {
            ad.isActive = false;
            await ad.save();

            // Send rejection email
            await sendAdRejectionEmail(ad, reason, true);
        }

        res.json({
            message: "Payment rejected successfully",
            payment,
            ad
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Get payment instructions
router.get("/instructions/:adId", verifyToken, async (req, res) => {
    try {
        const ad = await Ad.findById(req.params.adId);
        if (!ad) {
            return res.status(404).json({ message: "Ad not found" });
        }

        // Check authorization
        if (ad.createdBy.toString() !== req.user.id && req.user.role !== "admin") {
            return res.status(403).json({ message: "Not authorized" });
        }

        const instructions = {
            bankName: "Sadapay",
            accountNumber: "+9230287900729",
            accountName: "Muhammad Sarmad Javed",
            amount: ad.totalCost,
            reference: `AD${ad._id}`,
            dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
            note: "Include reference number in payment remarks"
        };

        res.json(instructions);
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Get payment status for ad
router.get("/ad/:adId/status", verifyToken, async (req, res) => {
    try {
        const payment = await Payment.findOne({
            itemId: req.params.adId,
            paymentFor: "ad"
        });

        if (!payment) {
            return res.json({
                payment: { status: "not_initiated" }
            });
        }

        res.json({
            payment
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Initiate payment for ad
router.post("/ad/:adId/initiate", verifyToken, async (req, res) => {
    try {
        const { amount, method = "bank_transfer" } = req.body;
        const adId = req.params.adId;

        const ad = await Ad.findById(adId);
        if (!ad) {
            return res.status(404).json({ message: "Ad not found" });
        }

        // Check if ad belongs to user
        if (ad.createdBy.toString() !== req.user.id) {
            return res.status(403).json({ message: "Not authorized" });
        }

        // Check if payment already exists
        let payment = await Payment.findOne({ itemId: adId, paymentFor: "ad" });

        if (!payment) {
            // Create new payment
            payment = new Payment({
                amount: amount || ad.totalCost,
                method,
                status: "pending",
                paymentFor: "ad",
                itemId: adId,
                payer: req.user.id
            });

            await payment.save();
        }

        // Link payment to ad
        ad.payment = payment._id;
        await ad.save();

        res.json({
            message: "Payment initiated successfully",
            payment
        });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

module.exports = router;