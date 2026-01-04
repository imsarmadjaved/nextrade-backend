const express = require("express");
const Payment = require("../models/payment");
const verifyToken = require("../middleware/authMiddleware");
const { uploadSingle } = require("../middleware/upload");
const router = express.Router();

// Upload payment proof (bank transfer) - FIXED
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

// Get payment proof image - FIXED
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

module.exports = router;