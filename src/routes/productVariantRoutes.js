// src/routes/productVariantRoutes.js
const express = require("express");
const router = express.Router();
const productVariantController = require("../controllers/productVariantController");

// RAM/Storage variants (existing)
router.get("/:id/variants", productVariantController.getProductVariants);

// Color variants routes
router.get("/:id/color-variants", productVariantController.getColorVariants);
router.post("/:id/color-variants", productVariantController.addColorVariant);
router.put(
  "/:id/color-variants/:variantId",
  productVariantController.updateColorVariant
);
router.delete(
  "/:id/color-variants/:variantId",
  productVariantController.deleteColorVariant
);

module.exports = router;
