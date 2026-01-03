const multer = require("multer");
const cloudinary = require("../config/cloudinary");
const streamifier = require("streamifier");

// Multer memory storage
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|webp|gif/;
        if (
            allowedTypes.test(file.mimetype) &&
            allowedTypes.test(file.originalname.toLowerCase())
        ) {
            cb(null, true);
        } else {
            cb(new Error("Only image files are allowed"), false);
        }
    },
});

// Single file upload
const uploadToCloudinarySingle = (folder = "general") => {
    return (req, res, next) => {
        if (!req.file) {
            return res.status(400).json({ message: "No image file provided" });
        }

        const stream = cloudinary.uploader.upload_stream(
            {
                folder: `nextrade/${folder}`,
                resource_type: "image",
                transformation: [{ width: 800, height: 800, crop: "fill" }],
            },
            (error, result) => {
                if (error) {
                    return res.status(500).json({
                        message: "Cloudinary upload failed",
                        error: error.message,
                    });
                }

                req.file.cloudinary = {
                    url: result.secure_url,
                    publicId: result.public_id,
                };

                req.file.path = result.secure_url; // backward compatibility
                next();
            }
        );

        streamifier.createReadStream(req.file.buffer).pipe(stream);
    };
};

// Multiple files upload
const uploadToCloudinaryMultiple = (folder = "general") => {
    return async (req, res, next) => {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: "No image files provided" });
        }

        try {
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

            req.cloudinaryFiles = await Promise.all(uploads);
            next();
        } catch (err) {
            res.status(500).json({ message: "Cloudinary upload failed", error: err.message });
        }
    };
};

module.exports = {
    uploadSingle: (fieldName, folder) => [
        upload.single(fieldName),
        uploadToCloudinarySingle(folder),
    ],
    uploadMultiple: (fieldName, folder, maxCount = 10) => [
        upload.array(fieldName, maxCount),
        uploadToCloudinaryMultiple(folder),
    ],
};
