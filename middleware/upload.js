const multer = require("multer");
const cloudinary = require("../config/cloudinary");
const streamifier = require("streamifier");

// Configure multer to store files in memory (not disk)
const storage = multer.memoryStorage();

// Set up multer middleware with file size limits and type filtering
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max file size
    fileFilter: (req, file, cb) => {
        // Only allow image file types
        const allowedTypes = /jpeg|jpg|png|webp|gif/;
        if (
            allowedTypes.test(file.mimetype) &&
            allowedTypes.test(file.originalname.toLowerCase())
        ) {
            cb(null, true); // Accept file
        } else {
            cb(new Error("Only image files are allowed"), false); // Reject file
        }
    },
});

// Single file upload middleware for Cloudinary
const uploadToCloudinarySingle = (folder = "general") => {
    return (req, res, next) => {
        if (!req.file) {
            return res.status(400).json({ message: "No image file provided" });
        }

        // Create upload stream to Cloudinary
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: `nextrade/${folder}`, // Organize files in folders
                resource_type: "image",
                transformation: [{ width: 800, height: 800, crop: "fill" }], // Resize images
            },
            (error, result) => {
                if (error) {
                    return res.status(500).json({
                        message: "Cloudinary upload failed",
                        error: error.message,
                    });
                }

                // Add Cloudinary info to the file object
                req.file.cloudinary = {
                    url: result.secure_url,
                    publicId: result.public_id,
                };

                req.file.path = result.secure_url;
                next();
            }
        );

        // Pipe the file buffer to Cloudinary
        streamifier.createReadStream(req.file.buffer).pipe(stream);
    };
};

// Multiple files upload middleware for Cloudinary
const uploadToCloudinaryMultiple = (folder = "general") => {
    return async (req, res, next) => {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: "No image files provided" });
        }

        try {
            // Upload all files in parallel
            const uploads = req.files.map(
                file =>
                    new Promise((resolve, reject) => {
                        const stream = cloudinary.uploader.upload_stream(
                            {
                                folder: `nextrade/${folder}`,
                                resource_type: "image",
                            },
                            (error, result) => {
                                if (error) reject(error);
                                else resolve({
                                    url: result.secure_url,
                                    publicId: result.public_id,
                                });
                            }
                        );
                        streamifier.createReadStream(file.buffer).pipe(stream);
                    })
            );

            // Wait for all uploads to complete
            req.cloudinaryFiles = await Promise.all(uploads);
            next();
        } catch (err) {
            res.status(500).json({ message: "Cloudinary upload failed", error: err.message });
        }
    };
};

// Export middleware combinations for easy use in routes
module.exports = {
    uploadSingle: (fieldName, folder) => [
        upload.single(fieldName),         // Multer single file upload
        uploadToCloudinarySingle(folder), // Cloudinary upload
    ],
    uploadMultiple: (fieldName, folder, maxCount = 10) => [
        upload.array(fieldName, maxCount),    // Multer multiple files upload
        uploadToCloudinaryMultiple(folder),   // Cloudinary upload
    ],
};