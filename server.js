const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");   //cross origin resource sharing
const connectDB = require("./config/db");
// Routes Import
const authRoutes = require("./routes/authRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const productRoutes = require("./routes/productRoutes");
const aiRecommendation = require("./routes/productAiRecommendation");
const cartRoutes = require("./routes/cartRoutes");
const orderRoutes = require("./routes/orderRoutes");
const reviewRoutes = require("./routes/ReviewRoutes");
const profileRoutes = require("./routes/profileRoutes.js");
const adminRoutes = require("./routes/adminRoutes");
const adRoutes = require("./routes/adRoutes");
const adAIRoutes = require("./routes/adAIroutes");
const pricingRoutes = require("./routes/pricingRoutes");
const bulkPricingRoutes = require("./routes/bulkPricingRoutes");
const activityRoutes = require("./routes/activityRoutes.js");
const paymentRoutes = require("./routes/paymentRoutes");
const contactRoutes = require('./routes/contactRoute');
const uploadRoutes = require("./routes/uploadRoutes");


dotenv.config();
const app = express();

// Middleware
app.use(cors({
    origin: "https://nextrade-frontend.vercel.app",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
}));
app.use(express.json());    //Converts incoming JSON request body into req.body

// Connect to DB
connectDB();

// health check
app.get("/health", (req, res) => {
    res.status(200).send("OK");
});

// Routes
app.use("/api/auth", authRoutes);   //authentication Routes
app.use("/api/categories", categoryRoutes); //catagory routes

// product and product recommendation routes
app.use("/api/products", productRoutes);
app.use("/api/ai/products", aiRecommendation);

app.use("/api/cart", cartRoutes);   //cart Route
app.use("/api/orders", orderRoutes);    //order Route
app.use("/api/reviews", reviewRoutes);  //Review Route
app.use("/api/profile", profileRoutes); //Profile Route
app.use("/api/admin", adminRoutes); //admin Routes

//ads and ads recommendation route
app.use("/api/ads", adRoutes);
app.use("/api/ai/ads", adAIRoutes);

//pricing Routes
app.use("/api/pricing", pricingRoutes);
app.use("/api", bulkPricingRoutes);
app.use("/api/payments", paymentRoutes);

app.use("/api/activity", activityRoutes);   //activity Route
app.use('/api/contact', contactRoutes); //customer support

// image uploading
app.use("/api/upload", uploadRoutes);
app.use("/uploads", express.static("/mnt/data/uploads"));

// Test route
app.get("/", (req, res) => {
    res.send("API is running...");
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
