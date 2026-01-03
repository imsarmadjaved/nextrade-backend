const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

// Cloudinary storage
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: (req, file) => {
        // Determine folder based on URL
        let folder = "general";
        if (req.originalUrl.includes("categories")) folder = "categories";
        if (req.originalUrl.includes("products")) folder = "products";
        if (req.originalUrl.includes("profile")) folder = "profiles";
        if (req.originalUrl.includes("payment")) folder = "payments";

        // Create unique filename
        const timestamp = Date.now();
        const originalname = file.originalname.replace(/\.[^/.]+$/, "");
        const sanitizedName = originalname.replace(/[^a-zA-Z0-9]/g, "-");
        const public_id = `${file.fieldname}-${timestamp}-${sanitizedName}`;

        return {
            folder: folder,
            public_id: public_id,
            resource_type: "auto",
            allowed_formats: ["jpg", "jpeg", "png", "webp", "gif"],
            transformation: [{ width: 1200, crop: "limit" }]
        };
    },
});

// File type filter
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp|gif/;
    const extname = allowedTypes.test(file.originalname.toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
        cb(null, true);
    } else {
        cb(new Error("Only image files (jpeg, jpg, png, webp, gif) are allowed!"), false);
    }
};

// Multer setup
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

module.exports = upload;