const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const session = require("express-session");
const passport = require("./config/passport");

// Các router
const phoneRoutes = require("./routes/phoneRoutes");
const userRoutes = require("./routes/userRoutes");
const cartRoutes = require("./routes/cartRoutes");
const inventoryRoutes = require("./routes/inventoryRoutes");

const app = express();

// Middleware
app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:5000"],
    credentials: true,
  })
);
app.use(bodyParser.json());

// Session configuration (cần cho passport)
app.use(
  session({
    secret: process.env.SESSION_SECRET || "your_session_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    },
  })
);

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

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
