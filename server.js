const productVariantRoutes = require("./src/routes/productVariantRoutes");
const productMemoryRoutes = require("./src/routes/productMemoryRoutes");
const installmentRoutes = require("./src/routes/installmentRoutes");
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./src/config/db");
const rateLimit = require("express-rate-limit");
const path = require("path");

// Kết nối MongoDB
connectDB();

const app = express();

// Giới hạn tần suất request: mỗi IP tối đa 100 request mỗi 15 phút
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 phút
//   max: 100, // tối đa 100 request
//   message: "Bạn đã gửi quá nhiều yêu cầu, vui lòng thử lại sau.",
// });
// app.use(limiter);

// Bật CORS cho frontend (localhost:3000)
app.use(
  cors({
    origin: "http://localhost:3000", // cho phép frontend gọi API
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Middleware parse body
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cho phép truy cập ảnh trong thư mục uploads và public/images
app.use("/uploads", express.static("uploads"));
app.use("/images", express.static(path.join(__dirname, "public/images")));

// Import routes
const productRoutes = require("./src/routes/productRoutes");
const uploadRoutes = require("./src/routes/upload");
const phoneRoutes = require("./src/routes/phoneRoutes");
const userRoutes = require("./src/routes/userRoutes");
const sliderRoutes = require("./src/routes/sliderRoutes");
const bannerRoutes = require("./src/routes/bannerRoutes");
const commentRoutes = require("./src/routes/commentRoutes");
const brandRoutes = require("./src/routes/brandRoutes");
const categoryRoutes = require("./src/routes/categoryRoutes");
const cartRoutes = require("./src/routes/cartRoutes");
const orderRoutes = require("./src/routes/orderRoutes");
const dashboardRoutes = require("./src/routes/dashboardRoutes");
const analyticsRoutes = require("./src/routes/analyticsRoutes");
const replyRoutes = require("./src/routes/replyRoutes");
const productColorRoutes = require("./src/routes/productColorRoutes");
const inventoryRoutes = require("./src/routes/inventoryRoutes");
const chatRoutes = require("./src/routes/chatRoutes");
// Routes
const newsRoutes = require("./src/routes/newsRoutes");
app.use("/api/inventory", inventoryRoutes);
app.use("/api/news", newsRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/products", productRoutes);
app.use("/api/products", productVariantRoutes);
app.use("/api/products", productMemoryRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/phones", phoneRoutes);
app.use("/api/users", userRoutes);
app.use("/api/sliders", sliderRoutes);
app.use("/api/banners", bannerRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/brands", brandRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/products", productColorRoutes);
app.use("/api/replies", replyRoutes);
app.use("/api/installment", installmentRoutes);
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});
