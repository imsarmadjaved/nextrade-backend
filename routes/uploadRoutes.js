const express = require("express");
const upload = require("../middleware/upload");
const verifyToken = require("../middleware/authMiddleware");
const roleCheck = require("../middleware/roleMiddleware");
const router = express.Router();

// Single file upload for products
router.post("/products/single", verifyToken, roleCheck(["seller", "admin"]), upload.single("image"), async (req, res) => {
    try {
        console.log('Upload single file request received');
        console.log('File:', req.file);

        if (!req.file) {
            return res.status(400).json({ message: "No image file provided" });
        }

        const imageUrl = `/uploads/products/${req.file.filename}`.replace(/\\/g, '/');

        console.log('File uploaded successfully, URL:', imageUrl);

        res.json({
            message: "Image uploaded successfully",
            imageUrl: imageUrl
        });
    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ message: "Upload failed", error: err.message });
    }
});

// Multiple files upload for products
router.post("/products/multiple", verifyToken, roleCheck(["seller", "admin"]), upload.array("images", 10), async (req, res) => {
    try {
        console.log('Upload multiple files request received');
        console.log('Files:', req.files);

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: "No image files provided" });
        }

        // Normalize paths for URLs
        const imageUrls = req.files.map(file =>
            `/uploads/products/${file.filename}`.replace(/\\/g, '/')
        );

        console.log('Files uploaded successfully, URLs:', imageUrls);

        res.json({
            message: "Images uploaded successfully",
            imageUrls: imageUrls,
            count: imageUrls.length
        });
    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ message: "Upload failed", error: err.message });
    }
});

router.post("/categories/single", verifyToken, roleCheck(["admin"]), upload.single("image"), async (req, res) => {
    try {

        if (!req.file) {
            return res.status(400).json({ message: "No image file provided" });
        }

        const imageUrl = `/uploads/categories/${req.file.filename}`.replace(/\\/g, '/');

        res.json({
            message: "Category image uploaded successfully",
            imageUrl: imageUrl
        });
    } catch (err) {
        res.status(500).json({ message: "Upload failed", error: err.message });
    }
});

router.post("/profile", verifyToken, upload.single("image"), async (req, res) => {
    try {
        console.log('Profile image upload request received');
        console.log('File:', req.file);
        console.log('User:', req.user); // Debug user info

        if (!req.file) {
            return res.status(400).json({ message: "No image file provided" });
        }

        const imageUrl = `/uploads/profiles/${req.file.filename}`.replace(/\\/g, '/');

        console.log('Profile image uploaded successfully, URL:', imageUrl);

        res.json({
            message: "Profile image uploaded successfully",
            imageUrl: imageUrl
        });
    } catch (err) {
        console.error('Profile upload error:', err);
        res.status(500).json({ message: "Upload failed", error: err.message });
    }
});

//payment proof
router.post("/payment/proof", verifyToken, upload.single("image"), async (req, res) => {
    try {
        console.log('Payment proof upload request received');
        console.log('File:', req.file);
        console.log('User:', req.user);

        if (!req.file) {
            return res.status(400).json({ message: "No image file uploaded" });
        }

        // Construct the full URL for the uploaded image
        const imageUrl = `/uploads/payments/${req.file.filename}`;

        console.log('Payment proof uploaded successfully:', {
            filename: req.file.filename,
            path: req.file.path,
            imageUrl: imageUrl
        });

        res.json({
            message: "Payment proof uploaded successfully",
            imageUrl: imageUrl,
            filename: req.file.filename
        });
    } catch (error) {
        console.error("Payment proof upload error:", error);
        res.status(500).json({ message: "Failed to upload payment proof" });
    }
});

module.exports = router;