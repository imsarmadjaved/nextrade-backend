const express = require("express");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");
const verifyToken = require("../middleware/authMiddleware");
const roleCheck = require("../middleware/roleMiddleware");

const router = express.Router();

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

console.log('✅ Upload routes loaded with DIRECT Cloudinary integration');
console.log('Cloudinary cloud_name:', cloudinary.config().cloud_name);

// Helper function for Cloudinary upload
const uploadToCloudinary = (folder, file) => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: `nextrade/${folder}`,
                resource_type: "auto",
                transformation: [{ width: 800, height: 800, crop: "fill" }],
                quality: "auto",
                fetch_format: "auto"
            },
            (error, result) => {
                if (error) {
                    console.error(`❌ Cloudinary upload error (${folder}):`, error.message);
                    reject(error);
                } else {
                    console.log(`✅ Cloudinary upload successful (${folder}):`, result.secure_url);
                    resolve(result);
                }
            }
        );
        streamifier.createReadStream(file.buffer).pipe(stream);
    });
};

// ========== CATEGORIES UPLOAD ==========
router.post(
    "/categories/single",
    verifyToken,
    roleCheck(["admin"]),
    // Use memory storage ONLY - no disk storage
    multer({ storage: multer.memoryStorage() }).single("image"),
    async (req, res) => {
        try {
            console.log("=== CATEGORY UPLOAD START ===");

            if (!req.file) {
                console.log("❌ No file received");
                return res.status(400).json({ message: "No image file provided" });
            }

            console.log(`📤 File received: ${req.file.originalname}, ${req.file.size} bytes`);

            // Upload to Cloudinary
            const result = await uploadToCloudinary("categories", req.file);

            res.json({
                message: "Category image uploaded to Cloudinary successfully",
                imageUrl: result.secure_url,
                publicId: result.public_id,
                secure_url: result.secure_url,
                width: result.width,
                height: result.height,
                format: result.format
            });

        } catch (error) {
            console.error("❌ Category upload failed:", error.message);
            res.status(500).json({
                message: "Cloudinary upload failed",
                error: error.message
            });
        }
    }
);

// ========== PRODUCTS UPLOAD ==========
router.post(
    "/products/single",
    verifyToken,
    roleCheck(["seller", "admin"]),
    multer({ storage: multer.memoryStorage() }).single("image"),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ message: "No image file provided" });
            }

            const result = await uploadToCloudinary("products", req.file);

            res.json({
                message: "Product image uploaded to Cloudinary successfully",
                imageUrl: result.secure_url,
                publicId: result.public_id,
                secure_url: result.secure_url
            });
        } catch (error) {
            res.status(500).json({
                message: "Upload failed",
                error: error.message
            });
        }
    }
);

// ========== PROFILE UPLOAD ==========
router.post(
    "/profile",
    verifyToken,
    multer({ storage: multer.memoryStorage() }).single("image"),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ message: "No image file provided" });
            }

            const result = await uploadToCloudinary("profiles", req.file);

            res.json({
                message: "Profile image uploaded to Cloudinary successfully",
                imageUrl: result.secure_url,
                publicId: result.public_id
            });
        } catch (error) {
            res.status(500).json({
                message: "Upload failed",
                error: error.message
            });
        }
    }
);

// ========== PAYMENT PROOF UPLOAD ==========
router.post(
    "/payment/proof",
    verifyToken,
    multer({ storage: multer.memoryStorage() }).single("image"),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ message: "No image file uploaded" });
            }

            const result = await uploadToCloudinary("payments", req.file);

            res.json({
                message: "Payment proof uploaded to Cloudinary successfully",
                imageUrl: result.secure_url,
                publicId: result.public_id
            });
        } catch (error) {
            res.status(500).json({
                message: "Failed to upload payment proof",
                error: error.message
            });
        }
    }
);

// ========== MULTIPLE FILES UPLOAD ==========
router.post(
    "/products/multiple",
    verifyToken,
    roleCheck(["seller", "admin"]),
    multer({ storage: multer.memoryStorage() }).array("images", 10),
    async (req, res) => {
        try {
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({ message: "No image files provided" });
            }

            console.log(`📤 Uploading ${req.files.length} files to Cloudinary...`);

            const uploadPromises = req.files.map(file =>
                uploadToCloudinary("products", file)
            );

            const results = await Promise.all(uploadPromises);
            const imageUrls = results.map(r => r.secure_url);

            res.json({
                message: "Images uploaded to Cloudinary successfully",
                imageUrls,
                count: imageUrls.length,
            });
        } catch (error) {
            res.status(500).json({
                message: "Upload failed",
                error: error.message
            });
        }
    }
);

module.exports = router;