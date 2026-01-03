const multer = require("multer");
const path = require("path");
const fs = require("fs");

// uploads directories
const createUploadDirs = () => {
    const directories = [
        "uploads/products",
        "uploads/categories",
        "uploads/profiles",
        "uploads/payments"
    ];

    directories.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log('Created upload directory:', dir);
        }
    });
};

// Run directory creation
createUploadDirs();

// Configure multer for file uploads with dynamic destinations
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let uploadDir = "uploads/";

        console.log('Upload request URL:', req.originalUrl);
        console.log('Upload request path:', req.path);

        // Match the actual route paths being used
        if (req.originalUrl.includes('/upload/categories') || req.path.includes('/categories')) {
            uploadDir += "categories/";
        } else if (req.originalUrl.includes('/upload/products') || req.path.includes('/products')) {
            uploadDir += "products/";
        } else if (req.originalUrl.includes('/upload/profile') || req.path.includes('/profile')) {
            uploadDir += "profiles/";
        } else if (req.originalUrl.includes('/upload/payment') || req.path.includes('/payment')) {
            uploadDir += "payments/";
        } else {
            uploadDir += "general/";
        }

        console.log('Upload destination determined:', uploadDir);

        // Ensure the specific directory exists
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
            console.log('Created directory:', uploadDir);
        }

        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Create unique filename with original extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);

        // FIXED: Better detection for payment proof
        let fileType = 'file';
        if (req.originalUrl.includes('/categories') || req.path.includes('/categories')) {
            fileType = 'category';
        } else if (req.originalUrl.includes('/products') || req.path.includes('/products')) {
            fileType = 'product';
        } else if (req.originalUrl.includes('/profile') || req.path.includes('/profile')) {
            fileType = 'profile';
        } else if (req.originalUrl.includes('/payment') || req.path.includes('/payment')) {
            fileType = 'payment-proof';
        }

        const filename = `${fileType}-${uniqueSuffix}${path.extname(file.originalname)}`;
        console.log('Generated filename:', filename);
        cb(null, filename);
    },
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    console.log('File filter - Original name:', file.originalname);
    console.log('File filter - MIME type:', file.mimetype);

    if (extname && mimetype) {
        cb(null, true);
    } else {
        cb(new Error(`Invalid file type. Only ${allowedTypes} are allowed.`), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Error handling middleware for multer
upload.errorHandler = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ message: 'File too large. Maximum size is 10MB.' });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({ message: 'Too many files.' });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({ message: 'Unexpected field.' });
        }
    } else if (err) {
        return res.status(400).json({ message: err.message });
    }
    next();
};

module.exports = upload;
