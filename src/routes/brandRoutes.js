const express = require("express");
const router = express.Router();
const Brand = require("../models/Brand");

// ✅ Lấy danh sách brand
router.get("/", async (req, res) => {
  try {
    const brands = await Brand.find();
    res.json({ success: true, data: brands });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ✅ Thêm brand
router.post("/", async (req, res) => {
  try {
    const brand = new Brand(req.body);
    await brand.save();
    res.status(201).json({ success: true, data: brand });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});
// ✅ Cập nhật brand
router.put("/:id", async (req, res) => {
  try {
    const updated = await Brand.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ success: false, message: "Brand not found" });
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// ✅ Xóa brand
router.delete("/:id", async (req, res) => {
  try {
    await Brand.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Brand deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
