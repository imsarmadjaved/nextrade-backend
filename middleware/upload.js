const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");

// Multer memory storage
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|webp|gif/;
        const extname = allowedTypes.test(file.originalname.toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) cb(null, true);
        else cb(new Error("Only image files are allowed!"), false);
    },
});

// Cloudinary upload middleware
const uploadToCloudinary = (folder) => {
    return (req, res, next) => {
        if (!req.file) return next();

        const stream = cloudinary.uploader.upload_stream(
            {
                folder,
                resource_type: "auto",
                transformation: [{ width: 800, height: 800, crop: "fill" }],
            },
            (error, result) => {
                if (error) {
                    console.error("Cloudinary upload error:", error);
                    return res.status(500).json({
                        message: "Cloudinary upload failed",
                        error: error.message
                    });
                }

                // Store complete Cloudinary data
                req.cloudinaryData = {
                    url: result.secure_url,
                    publicId: result.public_id,
                    width: result.width,
                    height: result.height,
                    format: result.format,
                    bytes: result.bytes,
                    createdAt: result.created_at
                };

                next();
            }
        );

        streamifier.createReadStream(req.file.buffer).pipe(stream);
    };
};

// Export function for routes
module.exports = {
    uploadSingle: (fieldName, folder) => [upload.single(fieldName), uploadToCloudinary(folder)],
    uploadMultiple: (fieldName, folder, maxCount = 10) => [upload.array(fieldName, maxCount), (req, res, next) => {
        if (!req.files) return next();
        let pending = req.files.length;
        req.files_cloudinary = [];

        req.files.forEach(file => {
            const stream = cloudinary.uploader.upload_stream(
                { folder, resource_type: "auto", transformation: [{ width: 1200, crop: "limit" }] },
                (error, result) => {
                    if (error) return res.status(500).json({ message: "Cloudinary upload failed", error });

                    req.files_cloudinary.push({ cloudinary_url: result.secure_url, cloudinary_id: result.public_id });
                    pending--;
                    if (pending === 0) next();
                }
            );
            streamifier.createReadStream(file.buffer).pipe(stream);
        });
    }]
};