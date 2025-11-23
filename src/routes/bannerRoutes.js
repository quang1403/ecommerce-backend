const express = require("express");
const router = express.Router();
const { getBanners } = require("../controllers/bannerController");

// GET /api/banners
router.get("/", getBanners);

module.exports = router;
