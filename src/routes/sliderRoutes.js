const express = require("express");
const router = express.Router();
const { getSliders } = require("../controllers/sliderController");

// GET /api/sliders
router.get("/", getSliders);

module.exports = router;
