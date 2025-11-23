const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

// Các router
const phoneRoutes = require("./routes/phoneRoutes");
const userRoutes = require("./routes/userRoutes");
const cartRoutes = require("./routes/cartRoutes");
const inventoryRoutes = require("./routes/inventoryRoutes");

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Route test
app.get("/", (req, res) => {
  res.send("🎉 Chào mừng đến với API cửa hàng điện thoại!");
});

// Gắn router
app.use("/api/phones", phoneRoutes);
app.use("/api/users", userRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/inventory", inventoryRoutes);

module.exports = app;
