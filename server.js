const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/db");

// Routes Import
const authRoutes = require("./routes/authRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const productRoutes = require("./routes/productRoutes");
const aiRecommendation = require("./routes/productAiRecommendation");
const cartRoutes = require("./routes/cartRoutes");
const orderRoutes = require("./routes/orderRoutes");
const reviewRoutes = require("./routes/ReviewRoutes");
const profileRoutes = require("./routes/profileRoutes");
const adminRoutes = require("./routes/adminRoutes");
const adRoutes = require("./routes/adRoutes");
const adAIRoutes = require("./routes/adAIroutes");
const pricingRoutes = require("./routes/pricingRoutes");
const bulkPricingRoutes = require("./routes/bulkPricingRoutes");
const activityRoutes = require("./routes/activityRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const contactRoutes = require('./routes/contactRoute');
const uploadRoutes = require("./routes/uploadRoutes");

dotenv.config();
const app = express();

// Middleware
app.use(cors({
    origin: "https://nextrade-frontend.vercel.app",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
}));
app.use(express.json()); // Parse incoming JSON

app.get('/api/debug/vars', (req, res) => {
    const allVars = {};

    // Check ALL environment variables
    Object.keys(process.env).forEach(key => {
        if (key.includes('CLOUDINARY') || key.includes('MONGODB') || key.includes('JWT') || key.includes('PORT')) {
            allVars[key] = process.env[key] ? '***SET***' : 'NOT SET';
        }
    });

    res.json({
        timestamp: new Date().toISOString(),
        allEnvVars: Object.keys(process.env).filter(k => k.includes('CLOUDINARY')),
        specificVars: {
            CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || 'NOT FOUND',
            CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY ? 'SET (hidden)' : 'NOT FOUND',
            CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET ? 'SET (hidden)' : 'NOT FOUND',
            NODE_ENV: process.env.NODE_ENV || 'NOT SET'
        },
        rawCloudinaryConfig: {
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            length: process.env.CLOUDINARY_CLOUD_NAME ? process.env.CLOUDINARY_CLOUD_NAME.length : 0
        }
    });
});

// Connect to DB
connectDB();
testCloudinaryOnStart();

// Health check
app.get("/health", (req, res) => {
    res.status(200).send("OK");
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/ai/products", aiRecommendation);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/ads", adRoutes);
app.use("/api/ai/ads", adAIRoutes);
app.use("/api/pricing", pricingRoutes);
app.use("/api", bulkPricingRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/contact", contactRoutes);

// Image uploading
app.use("/api/upload", uploadRoutes);

// Test route
app.get("/", (req, res) => {
    res.send("API is running...");
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
