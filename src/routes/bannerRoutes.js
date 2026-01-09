const express = require("express");
const router = express.Router();
const {
  getBanners,
  getBannerById,
  createBanner,
  updateBanner,
  deleteBanner,
} = require("../controllers/bannerController");
const { auth, isAdmin } = require("../middleware/auth");

// Public routes
router.get("/", getBanners);
router.get("/:id", getBannerById);

// Admin routes
router.post("/", auth, isAdmin, createBanner);
router.put("/:id", auth, isAdmin, updateBanner);
router.delete("/:id", auth, isAdmin, deleteBanner);

module.exports = router;
