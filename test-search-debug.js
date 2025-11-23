require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("./src/models/Product");
const Brand = require("./src/models/Brand");
const ProductSearchService = require("./src/services/ai/productSearch.service");

async function test() {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log("✅ Connected\n");

    const service = new ProductSearchService({ debug: true });

    const queries = [
      "iphone 12",
      "iphone 16 series",
      "Samsung Galaxy A51",
      "iPhone XS Pro",
      "iPhone X",
      "iPhone XR",
      "iPhone XS Max",
    ];

    for (const q of queries) {
      console.log(`\n${"=".repeat(60)}`);
      console.log(`🔍 Testing: "${q}"`);
      console.log("=".repeat(60));

      const result = await service.searchProducts(q);

      console.log(`Result: ${result.success ? "✅ SUCCESS" : "❌ FAILED"}`);
      console.log(`Strategy: ${result.searchInfo?.strategy || "none"}`);
      console.log(`Found: ${result.products?.length || 0} products`);

      if (result.products && result.products.length > 0) {
        result.products.slice(0, 3).forEach((p, i) => {
          console.log(`  ${i + 1}. ${p.name} - ${p.price?.toLocaleString()}đ`);
        });
      }
    }

    mongoose.disconnect();
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

test();
