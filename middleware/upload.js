const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

// Cloudinary storage
const cloudStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        let folder = "general";

        if (req.originalUrl.includes("categories")) folder = "categories";
        else if (req.originalUrl.includes("products")) folder = "products";
        else if (req.originalUrl.includes("profile")) folder = "profiles";
        else if (req.originalUrl.includes("payment")) folder = "payments";

        return {
            folder,
            public_id: `${file.fieldname}-${Date.now()}-${file.originalname}`,
            resource_type: "auto", // automatically detect image/video type
        };
    },
});

// File type filter
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(file.originalname.toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) cb(null, true);
    else cb(new Error("Invalid file type"), false);
};

// Multer setup
const upload = multer({
    storage: cloudStorage,
    fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

module.exports = upload;
