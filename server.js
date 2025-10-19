const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");

dotenv.config();
const app = express();

// Middleware
app.use(cors({
    origin: "http://localhost:5173",
    credentials: true
}));
app.use(express.json());

// Connect to DB
connectDB();

// Routes
const authRoutes = require("./routes/authRoutes");
app.use("/api/auth", authRoutes);
const categoryRoutes = require("./routes/categoryRoutes");
app.use("/api/categories", categoryRoutes);

const productRoutes = require("./routes/productRoutes");
app.use("/api/products", productRoutes);
const recommendationRoutes = require("./routes/productRecommendationRoutes");
app.use("/api/recommendations", recommendationRoutes);
const aiRecommendation = require("./routes/productAiRecommendation");
app.use("/api/ai", aiRecommendation);

const cartRoutes = require("./routes/cartRoutes");
app.use("/api/cart", cartRoutes);
const orderRoutes = require("./routes/orderRoutes");
app.use("/api/orders", orderRoutes);
const reviewRoutes = require("./routes/ReviewRoutes");
app.use("/api/reviews", reviewRoutes);
const profileRoutes = require("./routes/profileRoutes.js");
app.use("/api/profile", profileRoutes);
const adminRoutes = require("./routes/adminRoutes");
app.use("/api/admin", adminRoutes);

const adRoutes = require("./routes/adRoutes");
app.use("/api/ads", adRoutes);
const adAIRoutes = require("./routes/adAIroutes");
app.use("/api/ai", adAIRoutes);

const activityRoutes = require("./routes/activityRoutes.js");
app.use("/api/activity", activityRoutes);
app.use("/uploads", express.static(__dirname + "/uploads"));

// Test route
app.get("/", (req, res) => {
    res.send("API is running...");
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
