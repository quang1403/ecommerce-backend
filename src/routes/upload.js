const express = require("express");
const multer = require("multer");
const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});

const upload = multer({ storage });

// API upload ảnh
router.post("/", upload.array("images"), (req, res) => {
  const imageUrls = req.files.map((f) => `/uploads/${f.filename}`);
  res.json({ data: imageUrls });
});
module.exports = router;