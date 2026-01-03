const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");

console.log('=== UPLOAD MIDDLEWARE LOADED ===');
console.log('Cloudinary config check:', {
    cloud_name: cloudinary.config().cloud_name,
    api_key: cloudinary.config().api_key ? 'SET' : 'NOT SET'
});

// Multer memory storage
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        console.log(`🔍 File filter checking: ${file.originalname}`);
        const allowedTypes = /jpeg|jpg|png|webp|gif/;
        const extname = allowedTypes.test(file.originalname.toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            console.log('✅ File accepted');
            cb(null, true);
        } else {
            console.log('❌ File rejected');
            cb(new Error("Only image files are allowed!"), false);
        }
    },
});

// Cloudinary upload middleware
const uploadToCloudinary = (folder) => {
    return (req, res, next) => {
        console.log(`=== UPLOAD TO CLOUDINARY STARTED ===`);
        console.log(`Folder: ${folder}`);
        console.log(`Request file exists: ${!!req.file}`);
        console.log(`Request file object:`, req.file ? {
            originalname: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype,
            bufferLength: req.file.buffer?.length
        } : 'No file');

        if (!req.file) {
            console.log('⚠️  No file to upload, skipping Cloudinary');
            return next();
        }

        console.log('☁️  Starting Cloudinary upload...');

        const stream = cloudinary.uploader.upload_stream(
            {
                folder: `nextrade/${folder}`,
                resource_type: "auto",
                transformation: [{ width: 800, height: 800, crop: "fill" }],
            },
            (error, result) => {
                if (error) {
                    console.error("❌ Cloudinary upload failed:", error.message);
                    console.error("Full error:", error);

                    // Fallback - set a local path
                    req.file.path = `/uploads/${folder}/${Date.now()}-${req.file.originalname}`;
                    console.log(`⚠️  Using local fallback: ${req.file.path}`);
                    return next();
                }

                console.log("🎉 Cloudinary upload successful!");
                console.log("URL:", result.secure_url);
                console.log("Public ID:", result.public_id);

                // Store in both places for compatibility
                req.cloudinaryData = {
                    url: result.secure_url,
                    publicId: result.public_id,
                    width: result.width,
                    height: result.height,
                    format: result.format
                };

                req.file.cloudinary_url = result.secure_url;
                req.file.cloudinary_id = result.public_id;
                req.file.path = result.secure_url; // OVERRIDE LOCAL PATH

                next();
            }
        );

        streamifier.createReadStream(req.file.buffer).pipe(stream);
    };
};

// Export with logging
module.exports = {
    uploadSingle: (fieldName, folder) => {
        console.log(`📦 uploadSingle called: ${fieldName}, ${folder}`);
        return [
            (req, res, next) => {
                console.log(`📤 Multer single middleware for ${fieldName}`);
                upload.single(fieldName)(req, res, (err) => {
                    if (err) {
                        console.error('❌ Multer error:', err);
                        return res.status(400).json({ message: err.message });
                    }
                    console.log(`✅ Multer processed: ${req.file ? req.file.originalname : 'no file'}`);
                    next();
                });
            },
            uploadToCloudinary(folder)
        ];
    },

    uploadMultiple: (fieldName, folder, maxCount = 10) => [
        upload.array(fieldName, maxCount),
        uploadToCloudinary(folder)
    ]
};