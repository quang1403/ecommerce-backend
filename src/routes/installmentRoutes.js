const express = require("express");
const router = express.Router();
const installmentController = require("../controllers/installmentController");
const { auth } = require("../middleware/auth");

// POST /api/installment
router.post("/", auth, installmentController.calculateInstallment);

module.exports = router;
