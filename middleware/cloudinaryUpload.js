// middleware/cloudinaryUpload.js
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");

console.log('✅ Cloudinary Upload Middleware loaded');

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Simple memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Cloudinary upload function
const uploadToCloudinary = (folder) => {
    return async (req, res, next) => {
        try {
            if (!req.file) {
                return next();
            }

            console.log(`📤 Uploading to Cloudinary folder: ${folder}`);
            console.log(`File: ${req.file.originalname}`);

            const result = await new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    {
                        folder: `nextrade/${folder}`,
                        resource_type: "auto",
                        transformation: [{ width: 800, height: 800, crop: "fill" }]
                    },
                    (error, result) => {
                        if (error) reject(error);
                        else resolve(result);
                    }
                );

                streamifier.createReadStream(req.file.buffer).pipe(stream);
            });

            console.log(`✅ Uploaded to: ${result.secure_url}`);

            // Attach to request
            req.cloudinaryResult = result;
            req.file.cloudinary_url = result.secure_url;
            req.file.cloudinary_id = result.public_id;
            req.file.path = result.secure_url;

            next();

        } catch (error) {
            console.error("❌ Cloudinary upload error:", error);
            return res.status(500).json({
                message: "Cloudinary upload failed",
                error: error.message
            });
        }
    };
};

// Export middleware
module.exports = {
    uploadSingle: (fieldName, folder) => [
        upload.single(fieldName),
        uploadToCloudinary(folder)
    ],

    uploadMultiple: (fieldName, folder, maxCount = 10) => [
        upload.array(fieldName, maxCount),
        async (req, res, next) => {
            try {
                if (!req.files || req.files.length === 0) {
                    return next();
                }

                console.log(`📤 Uploading ${req.files.length} files to Cloudinary`);

                const uploadPromises = req.files.map(file => {
                    return new Promise((resolve, reject) => {
                        const stream = cloudinary.uploader.upload_stream(
                            { folder: `nextrade/${folder}` },
                            (error, result) => {
                                if (error) reject(error);
                                else resolve(result);
                            }
                        );
                        streamifier.createReadStream(file.buffer).pipe(stream);
                    });
                });

                const results = await Promise.all(uploadPromises);
                req.cloudinaryResults = results;
                req.files_cloudinary = results.map(r => ({
                    cloudinary_url: r.secure_url,
                    cloudinary_id: r.public_id
                }));

                next();

            } catch (error) {
                console.error("❌ Multiple upload error:", error);
                return res.status(500).json({
                    message: "Multiple upload failed",
                    error: error.message
                });
            }
        }
    ]
};