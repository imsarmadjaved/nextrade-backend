const express = require("express");
const { uploadSingle, uploadMultiple } = require("../middleware/upload");
const verifyToken = require("../middleware/authMiddleware");
const roleCheck = require("../middleware/roleMiddleware");
const router = express.Router();

console.log('=== UPLOAD ROUTES LOADED ===');
console.log('uploadSingle type:', typeof uploadSingle);
console.log('uploadMultiple type:', typeof uploadMultiple);


// Helper function to get Cloudinary URL
const getCloudinaryUrl = (req) => {
    // First try cloudinaryData (new way)
    if (req.cloudinaryData && req.cloudinaryData.url) {
        return req.cloudinaryData.url;
    }
    // Fallback to file.cloudinary_url (old way)
    if (req.file && req.file.cloudinary_url) {
        return req.file.cloudinary_url;
    }
    return null;
};

// Single file upload for products
router.post("/products/single", verifyToken, roleCheck(["seller", "admin"]),
    uploadSingle("image", "products"),
    async (req, res) => {
        try {
            const imageUrl = getCloudinaryUrl(req);
            if (!imageUrl) {
                return res.status(400).json({ message: "No image file provided or upload failed" });
            }

            res.json({
                message: "Image uploaded to Cloudinary successfully",
                imageUrl: imageUrl,
                publicId: req.cloudinaryData?.publicId || req.file?.cloudinary_id,
                secure_url: imageUrl,
                width: req.cloudinaryData?.width,
                height: req.cloudinaryData?.height,
                format: req.cloudinaryData?.format
            });
        } catch (err) {
            res.status(500).json({ message: "Upload failed", error: err.message });
        }
    }
);

// categories upload - FIXED
router.post(
    "/categories/single",
    verifyToken,
    roleCheck(["admin"]),
    uploadSingle("image", "categories"),
    async (req, res) => {
        try {
            const imageUrl = getCloudinaryUrl(req);
            if (!imageUrl) {
                return res.status(400).json({
                    message: "No image file provided or Cloudinary upload failed"
                });
            }

            console.log("Cloudinary upload successful for category");
            console.log("URL:", imageUrl);

            res.json({
                message: "Category image uploaded to Cloudinary successfully",
                imageUrl: imageUrl,
                publicId: req.cloudinaryData?.publicId || req.file?.cloudinary_id,
                secure_url: imageUrl,
                details: req.cloudinaryData ? {
                    width: req.cloudinaryData.width,
                    height: req.cloudinaryData.height,
                    format: req.cloudinaryData.format,
                    size: req.cloudinaryData.bytes
                } : null
            });
        } catch (err) {
            console.error("Upload route error:", err);
            res.status(500).json({
                message: "Upload failed",
                error: err.message
            });
        }
    }
);

//profile
router.post(
    "/profile",
    verifyToken,
    uploadSingle("image", "profiles"),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ message: "No image file provided" });
            }

            res.json({
                message: "Profile image uploaded successfully",
                imageUrl: req.file.cloudinary_url,
            });
        } catch (err) {
            res.status(500).json({ message: "Upload failed", error: err.message });
        }
    }
);

//payment proof
router.post(
    "/payment/proof",
    verifyToken,
    uploadSingle("image", "payments"),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ message: "No image file uploaded" });
            }

            res.json({
                message: "Payment proof uploaded successfully",
                imageUrl: req.file.cloudinary_url,
                publicId: req.file.cloudinary_id
            });
        } catch (error) {
            res.status(500).json({ message: "Failed to upload payment proof" });
        }
    }
);

module.exports = router;
