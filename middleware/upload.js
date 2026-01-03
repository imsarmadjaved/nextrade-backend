const multer = require("multer");
const cloudinary = require("../config/cloudinary");
const streamifier = require("streamifier");

// Verify Cloudinary is configured
if (!cloudinary.config().cloud_name) {
    console.error('❌ CLOUDINARY NOT CONFIGURED! Check your .env file');
}

// Multer memory storage
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|webp|gif/;
        const extname = allowedTypes.test(file.originalname.toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) cb(null, true);
        else cb(new Error("Only image files are allowed!"), false);
    },
});

// Cloudinary upload middleware - NO FALLBACK
const uploadToCloudinary = (folder) => {
    return (req, res, next) => {
        if (!req.file) {
            console.log('❌ No file in request');
            return res.status(400).json({ message: "No image file provided" });
        }

        console.log(`☁️ Uploading to Cloudinary folder: ${folder}`);
        console.log(`File: ${req.file.originalname}, Size: ${req.file.size} bytes`);

        const stream = cloudinary.uploader.upload_stream(
            {
                folder: `nextrade/${folder}`,
                resource_type: "auto",
                transformation: [{ width: 800, height: 800, crop: "fill" }],
            },
            (error, result) => {
                if (error) {
                    console.error("❌ Cloudinary upload FAILED:", error.message);
                    // NO FALLBACK - return error
                    return res.status(500).json({
                        message: "Cloudinary upload failed",
                        error: error.message
                    });
                }

                console.log("✅ Cloudinary upload SUCCESS!");
                console.log("URL:", result.secure_url);

                // Store data
                req.cloudinaryData = {
                    url: result.secure_url,
                    publicId: result.public_id,
                };

                req.file.cloudinary_url = result.secure_url;
                req.file.cloudinary_id = result.public_id;
                req.file.path = result.secure_url;

                next();
            }
        );

        streamifier.createReadStream(req.file.buffer).pipe(stream);
    };
};

// Export
module.exports = {
    uploadSingle: (fieldName, folder) => {
        console.log(`🔧 Configuring uploadSingle: ${fieldName}, ${folder}`);
        return [upload.single(fieldName), uploadToCloudinary(folder)];
    },
    uploadMultiple: (fieldName, folder, maxCount = 10) => [
        upload.array(fieldName, maxCount),
        uploadToCloudinary(folder)
    ]
};