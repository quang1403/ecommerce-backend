const express = require("express");
const router = express.Router();
const {
  getSliders,
  getSliderById,
  createSlider,
  updateSlider,
  deleteSlider,
} = require("../controllers/sliderController");
const { auth, isAdmin } = require("../middleware/auth");

// Public routes
router.get("/", getSliders);
router.get("/:id", getSliderById);

// Admin routes
router.post("/", auth, isAdmin, createSlider);
router.put("/:id", auth, isAdmin, updateSlider);
router.delete("/:id", auth, isAdmin, deleteSlider);

module.exports = router;
