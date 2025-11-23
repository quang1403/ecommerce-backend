/**
 * productSearchService.js
 * Rewritten & hardened product search service
 *
 * Features:
 * - normalize query (Vietnamese & punctuation stripping)
 * - robust extractProductInfo (brand, model, variant, storage)
 * - multi-strategy search: exactModel -> brand -> feature -> fuzzy -> fallback
 * - safe regex usage (no 'g' for capture groups)
 * - populate brand with match and filter nulls
 * - scoring with storage/variant/brand/rating/sold/stock
 * - debug toggle
 */

const Product = require("../../models/Product");

class ProductSearchService {
  constructor({ debug = false } = {}) {
    this.debug = debug;

    // product patterns: avoid 'g' flag so exec() returns capture groups reliably
    this.productPatterns = {
      iphone: [
        /iphone\s*(?:series\s*)?(\d{1,4})(?:\s*(pro|plus|mini|max|prm|pm|pmax|promax))?/i,
        /ip\s*(\d{1,4})(?:\s*(pro|plus|mini|max|prm|pm|pmax|promax))?/i,
        /iphone(?:\s*)(pro|plus|mini|max|prm|pm|pmax|promax)/i,
        // Thêm pattern cho iPhone X series (X, XS, XR, XS Max)
        /iphone\s*(x[sr]?(?:\s*max)?(?:\s*pro)?)(?:\s*(max|pro))?/i,
        /ip\s*(x[sr]?(?:\s*max)?(?:\s*pro)?)/i,
      ],
      samsung: [
        /samsung\s*(?:galaxy\s*)?([a-z]?\d{1,3}(?:\s*ultra|\s*plus|\s*note|\s*fe)?)/i,
        /galaxy\s*([a-z]?\d{1,3}(?:\s*ultra|\s*plus|\s*note|\s*fe)?)/i,
        /\b(samsung|sam)\b.*?([sS]\d{1,3}|note\s*\d{1,3}|j\d{1,3})/i,
      ],
      xiaomi: [
        /(?:xiaomi|redmi|poco)\s*(?:mi\s*)?([a-z]*\s*\d{1,4}(?:\s*(pro|plus|ultra|t|note))?)/i,
        /(redmi|poco)\s*(note\s*\d{1,4}|\w*\d{1,4})/i,
      ],
      oppo: [
        /oppo\s*([a-z]*\s*\d{1,4}(?:\s*(pro|plus|neo|f))?)/i,
        /reno\s*(\d{1,4})/i,
        /find\s*([nx]?\d{1,4})/i,
      ],
      vivo: [
        /vivo\s*([a-z]*\s*\d{1,4}(?:\s*(pro|e|neo))?)/i,
        /\bv\s*(\d{1,4}[a-z]?)\b/i,
      ],
      realme: [/realme\s*(\w*\s*\d{1,4}(?:\s*(pro|neo|max))?)/i],
      ipad: [/ipad(?:\s*(pro|air|mini))?(?:\s*(\d+(?:\.\d+)?))?/i],
      headphone: [/(?:tai\s*nghe|headphone|earphone|airpods|earbud)/i],
    };

    // brand mapping & aliases
    this.brandMapping = {
      iphone: "Apple",
      ipad: "Apple",
      apple: "Apple",
      samsung: "Samsung",
      galaxy: "Samsung",
      sam: "Samsung",
      xiaomi: "Xiaomi",
      redmi: "Xiaomi",
      poco: "Xiaomi",
      oppo: "Oppo",
      reno: "Oppo",
      find: "Oppo",
      vivo: "Vivo",
      realme: "Realme",
      airpods: "Apple",
    };

    // alias variants mapping for normalization
    this.variantAliases = {
      prm: "pro max",
      pm: "pro max",
      pmax: "pro max",
      promax: "pro max",
      pro: "pro",
      plus: "plus",
      m: "mini",
      mini: "mini",
      ultra: "ultra",
      t: "t",
      note: "note",
    };

    // feature keywords
    this.featureKeywords = {
      price: ["rẻ", "giá thấp", "tiết kiệm", "bình dân", "budget"],
      premium: ["cao cấp", "premium", "flagship", "đắt", "pro", "max", "ultra"],
      gaming: ["gaming", "game", "chơi game", "hiệu năng cao", "mượt"],
      camera: ["camera", "chụp ảnh", "selfie", "quay video", "zoom"],
      battery: ["pin", "battery", "sạc", "dung lượng pin", "pin trâu"],
      storage: ["bộ nhớ", "storage", "gb", "tb", "dung lượng"],
      ram: ["ram", "memory"],
    };
  }

  log(...args) {
    if (this.debug) console.log("[ProductSearchService]", ...args);
  }

  /**
   * Main entry
   */
  async searchProducts(rawQuery, options = {}) {
    try {
      this.log("Searching for:", rawQuery);
      const query = this.normalizeQuery(rawQuery);

      // Search strategies in order
      const strategies = [
        () => this.exactModelSearch(query),
        () => this.brandBasedSearch(query),
        () => this.featureBasedSearch(query),
        () => this.fuzzySearch(query),
        () => this.fallbackSearch(query),
      ];

      for (const fn of strategies) {
        const res = await fn();
        if (
          res &&
          res.success &&
          Array.isArray(res.products) &&
          res.products.length > 0
        ) {
          this.log(`Strategy ${res.strategy} found ${res.products.length}`);
          return this.formatSearchResults(res, rawQuery);
        }
      }

      return {
        success: false,
        message:
          "Không tìm thấy sản phẩm phù hợp. Bạn thử miêu tả thêm (dung lượng, màu, hãng) nhé.",
        products: [],
        searchInfo: { query: rawQuery, strategy: "none" },
      };
    } catch (err) {
      console.error("ProductSearchService.searchProducts error:", err);
      return {
        success: false,
        message: "Có lỗi khi tìm kiếm sản phẩm.",
        products: [],
        error: err.message,
      };
    }
  }

  /**
   * Normalize query: remove diacritics, punctuation, extra spaces, lowercase.
   */
  normalizeQuery(q) {
    if (!q || typeof q !== "string") return "";
    let s = q.toLowerCase();

    // Remove Vietnamese diacritics
    s = s
      .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, "a")
      .replace(/[èéẹẻẽêềếệểễ]/g, "e")
      .replace(/[ìíịỉĩ]/g, "i")
      .replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, "o")
      .replace(/[ùúụủũưừứựửữ]/g, "u")
      .replace(/[ỳýỵỷỹ]/g, "y")
      .replace(/đ/g, "d");

    // Replace punctuation with spaces, collapse spaces
    s = s
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return s;
  }

  /**
   * EXACT model search: try to extract brand/model/variant/storage and query DB precisely
   */
  async exactModelSearch(query) {
    try {
      const info = this.extractProductInfo(query);
      this.log("exactModelSearch - extracted:", info);

      // If no useful tokens, fail fast
      if (!info.brand && !info.model && !info.storage) {
        return { success: false, products: [] };
      }

      // Build criteria using extracted info
      const criteria = this.buildSearchCriteria(info);

      // If brand specified but brand stored as ObjectId ref, we will populate with match in brandBasedSearch.
      // Here do a general name search first (works when brand is string embedded)
      let products = [];
      if (criteria.$or && criteria.$or.length > 0) {
        products = await Product.find(criteria)
          .populate("brand")
          .sort({ createdAt: -1 })
          .limit(20);
      }

      this.log("exactModelSearch found raw products:", products.length);

      // If not found, try brand-based populate-match (handles ref brand)
      if (!products || products.length === 0) {
        // Try populate+match if brand available
        if (info.brand) {
          const regexBrand = new RegExp(info.brand, "i");
          const regexModel = info.model
            ? new RegExp(info.model.split(" ").join(".*"), "i")
            : null;

          // find and populate brand, then filter
          products = await Product.find({})
            .populate({
              path: "brand",
              match: { name: regexBrand },
            })
            .limit(50);

          products = products.filter(
            (p) => p.brand && (!regexModel || regexModel.test(p.name))
          );
          this.log("exactModelSearch after populate-match:", products.length);
        }
      }

      if (products && products.length > 0) {
        const scored = this.scoreProducts(products, query, info);
        return {
          success: true,
          products: scored.slice(0, 10),
          strategy: "exact_model",
          extractedInfo: info,
        };
      }

      return { success: false, products: [] };
    } catch (err) {
      console.error("exactModelSearch error:", err);
      return { success: false, products: [] };
    }
  }

  /**
   * Brand-based search
   */
  async brandBasedSearch(query) {
    try {
      const info = this.extractProductInfo(query);
      if (!info.brand) return { success: false, products: [] };

      const regexBrand = new RegExp(info.brand, "i");

      // populate brand with match, then filter non-null brands
      let results = await Product.find({})
        .populate({
          path: "brand",
          match: { name: regexBrand },
        })
        .limit(50);

      results = results.filter((p) => p.brand); // only those with the brand match

      if (results.length === 0) {
        return { success: false, products: [] };
      }

      const scored = this.scoreProducts(results, query, info);
      return {
        success: true,
        products: scored.slice(0, 10),
        strategy: "brand_based",
        extractedInfo: info,
      };
    } catch (err) {
      console.error("brandBasedSearch error:", err);
      return { success: false, products: [] };
    }
  }

  /**
   * Feature-based search (price/gaming/camera/premium)
   */
  async featureBasedSearch(query) {
    try {
      const features = this.extractFeatures(query);
      if (!features || features.length === 0)
        return { success: false, products: [] };

      const criteria = {};
      const orClauses = [];

      if (features.includes("price")) {
        // cheap
        criteria.price = { $lt: 10000000 };
      }
      if (features.includes("premium")) {
        criteria.price = { $gt: 15000000 };
      }
      if (features.includes("gaming")) {
        orClauses.push({ ram: { $gte: 8 } });
        orClauses.push({
          chipset: /snapdragon\s*8|dimensity\s*[89]|exynos|a13|a14/i,
        });
      }
      if (features.includes("camera")) {
        orClauses.push({ cameraRear: { $exists: true } });
        orClauses.push({ cameraFront: { $exists: true } });
      }
      if (Object.keys(criteria).length === 0 && orClauses.length === 0) {
        return { success: false, products: [] };
      }

      const queryObj = Object.keys(criteria).length > 0 ? { ...criteria } : {};
      if (orClauses.length > 0) queryObj.$or = orClauses;

      const products = await Product.find(queryObj)
        .populate("brand")
        .sort({ rating: -1 })
        .limit(30);
      if (!products || products.length === 0)
        return { success: false, products: [] };

      return {
        success: true,
        products: products.slice(0, 10),
        strategy: "feature_based",
        features,
      };
    } catch (err) {
      console.error("featureBasedSearch error:", err);
      return { success: false, products: [] };
    }
  }

  /**
   * Fuzzy search with smart token regex - safer than splitting with |
   */
  async fuzzySearch(query) {
    try {
      const info = this.extractProductInfo(query);
      // build keywords prioritized: model tokens then remaining words
      const tokens = query.split(" ").filter((t) => t.length > 1);
      const modelToken = info.model
        ? info.model.split(" ").filter(Boolean)
        : [];
      const other = tokens.filter((t) => !modelToken.includes(t)).slice(0, 6);

      const patternParts = [];
      if (modelToken.length) patternParts.push(modelToken.join(".*"));
      if (other.length) patternParts.push(other.join(".*"));

      const pattern = patternParts.length
        ? new RegExp(patternParts.join(".*"), "i")
        : new RegExp(query, "i");

      const products = await Product.find({
        $or: [{ name: pattern }, { description: pattern }],
      })
        .populate("brand")
        .sort({ rating: -1, sold: -1 })
        .limit(50);

      if (!products || products.length === 0)
        return { success: false, products: [] };

      const scored = this.scoreProducts(products, query, info);
      return {
        success: true,
        products: scored.slice(0, 10),
        strategy: "fuzzy_search",
        extractedInfo: info,
      };
    } catch (err) {
      console.error("fuzzySearch error:", err);
      return { success: false, products: [] };
    }
  }

  /**
   * Fallback popular products
   */
  async fallbackSearch(query) {
    try {
      // Fallback KHÔNG được trả success=true vì không match query
      // Chỉ trả sản phẩm gợi ý để AI biết "không tìm thấy"
      const products = await Product.find({})
        .populate("brand")
        .sort({ sold: -1, rating: -1 })
        .limit(10);
      return {
        success: false,
        products,
        strategy: "fallback_popular",
        message:
          "Không tìm thấy sản phẩm phù hợp. Dưới đây là một số sản phẩm bán chạy bạn có thể quan tâm.",
      };
    } catch (err) {
      console.error("fallbackSearch error:", err);
      return { success: false, products: [] };
    }
  }

  /**
   * Extract product info: brand, model, variant, storage
   * Always use normalized query input
   */
  extractProductInfo(query) {
    const q = this.normalizeQuery(query);
    const info = {
      brand: null,
      model: null,
      variant: null,
      storage: null,
      type: "phone",
    };

    // storage e.g., "256gb", "1tb"
    const storageMatch = q.match(/\b(\d{2,4})\s*(gb|tb)\b/i);
    if (storageMatch) {
      let size = parseInt(storageMatch[1], 10);
      if (/tb/i.test(storageMatch[2])) size = size * 1024;
      info.storage = size;
    }

    // headphone/tablet quick detect
    if (/\bipad\b/i.test(q)) {
      info.type = "tablet";
      info.brand = "Apple";
      const m = q.match(/ipad\s*(pro|air|mini)?/i);
      if (m && m[1]) info.model = m[1];
      return info;
    }
    if (/\btai\s*nghe\b|\bairpods\b|\bearbud\b/i.test(q)) {
      info.type = "accessory";
      if (/\bairpods\b/i.test(q)) {
        info.brand = "Apple";
        info.model = "AirPods";
      }
      return info;
    }

    // try brand-specific patterns
    for (const [brandKey, patterns] of Object.entries(this.productPatterns)) {
      for (const pattern of patterns) {
        // exec returns capture groups for patterns without global flag
        const match = pattern.exec(q);
        if (match) {
          // normalize brand
          info.brand = this.brandMapping[brandKey] || brandKey;
          // model extraction heuristics
          // model could be in group 1 or fallback to full match
          const candidateModel = match[1] ? match[1].trim() : match[0].trim();
          // cleanup candidate: remove extra words "series" etc.
          info.model = candidateModel
            .replace(/\b(series|series\s*\d+)\b/i, "")
            .trim();

          // variant: often capture in group 2
          if (match[2]) {
            let v = match[2].toLowerCase();
            if (this.variantAliases[v]) v = this.variantAliases[v];
            info.variant = v;
          } else {
            // try to detect variant keywords in candidateModel
            for (const alias of Object.keys(this.variantAliases)) {
              if (
                /\b(promax|pro|max|ultra|plus|mini|neo|t|note)\b/i.test(
                  candidateModel
                )
              ) {
                // set generic variant if found
                const found = candidateModel.match(
                  /\b(promax|pro|max|ultra|plus|mini|neo|t|note)\b/i
                );
                if (found && found[0]) {
                  let v = found[0].toLowerCase();
                  if (this.variantAliases[v]) v = this.variantAliases[v];
                  info.variant = v;
                  break;
                }
              }
            }
          }

          // reset lastIndex just in case
          if (pattern && pattern.lastIndex) pattern.lastIndex = 0;

          return info;
        }
        // reset lastIndex if pattern had it
        if (pattern && pattern.lastIndex) pattern.lastIndex = 0;
      }
    }

    // fallback: try to detect brand by keywords in query
    for (const [k, brandName] of Object.entries(this.brandMapping)) {
      if (q.includes(k)) {
        info.brand = brandName;
        break;
      }
    }

    // try to detect simple model numbers (e.g., "15", "13t", "s24")
    const simpleModelMatch = q.match(/\b([a-z]*\d{1,4}[a-z]*)\b/i);
    if (simpleModelMatch) {
      const token = simpleModelMatch[1];
      // avoid words like "gia" "mau" etc.
      if (!/^(gia|mau|mau-sac|mau-sac|hien|bao)$/i.test(token)) {
        info.model = token;
      }
    }

    return info;
  }

  /**
   * Build Mongo search criteria from extractedInfo
   */
  buildSearchCriteria(extractedInfo = {}) {
    const criteria = {};
    const ors = [];

    if (extractedInfo.brand && extractedInfo.model) {
      // match either "Brand ... Model" or "Model ... Brand" in name
      let brandPattern = extractedInfo.brand.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      // Fix: Apple brand cũng match "iphone", "ip" trong tên sản phẩm
      if (extractedInfo.brand.toLowerCase() === "apple") {
        brandPattern = "(?:apple|iphone|ip)";
      }

      const m = extractedInfo.model.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      ors.push({ name: new RegExp(`${brandPattern}.*${m}`, "i") });
      ors.push({ name: new RegExp(`${m}.*${brandPattern}`, "i") });
      ors.push({ name: new RegExp(`\\b${m}\\b`, "i") });
    } else if (extractedInfo.model) {
      const m = extractedInfo.model.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      ors.push({ name: new RegExp(`${m}`, "i") });
    } else if (extractedInfo.brand) {
      let brandPattern = extractedInfo.brand.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );
      if (extractedInfo.brand.toLowerCase() === "apple") {
        brandPattern = "(?:apple|iphone|ip)";
      }
      ors.push({ name: new RegExp(`${brandPattern}`, "i") });
    }

    if (extractedInfo.variant) {
      ors.push({
        name: new RegExp(
          extractedInfo.variant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          "i"
        ),
      });
    }

    if (ors.length > 0) criteria.$or = ors;

    // Fix: storage filter phải là AND, không phải OR
    if (extractedInfo.storage) {
      criteria.storage = extractedInfo.storage;
    }

    return criteria;
  }

  /**
   * Score products based on multiple signals
   */
  scoreProducts(products, rawQuery, extractedInfo = {}) {
    const q = rawQuery.toLowerCase();
    return products
      .map((product) => {
        let score = 0;
        const name = (product.name || "").toLowerCase();

        // exact name contains full query
        if (q.length > 2 && name.includes(q)) score += 150;

        // model match strongly
        if (
          extractedInfo.model &&
          name.includes(extractedInfo.model.toLowerCase())
        )
          score += 120;

        // variant
        if (
          extractedInfo.variant &&
          name.includes(extractedInfo.variant.toLowerCase())
        )
          score += 60;

        // storage exact
        if (extractedInfo.storage && product.storage === extractedInfo.storage)
          score += 100;

        // check variants array for matching storage/ram
        if (
          product.variants &&
          Array.isArray(product.variants) &&
          extractedInfo.storage
        ) {
          const vmatch = product.variants.find(
            (v) => Number(v.storage) === Number(extractedInfo.storage)
          );
          if (vmatch) score += 80;
        }

        // brand match (if brand populated)
        if (
          extractedInfo.brand &&
          product.brand &&
          (product.brand.name || "")
            .toLowerCase()
            .includes(extractedInfo.brand.toLowerCase())
        ) {
          score += 70;
        }

        // popularity & rating
        score += (product.rating || 0) * 5;
        score += Math.min((product.sold || 0) / 50, 40);

        // stock
        if (product.stock && product.stock > 0) score += 20;

        // slight boost if name contains model tokens in order
        const modelTokens = extractedInfo.model
          ? extractedInfo.model.toLowerCase().split(" ").filter(Boolean)
          : [];
        if (modelTokens.length) {
          const joined = modelTokens.join(" ");
          if (name.includes(joined)) score += 30;
        }

        return { ...product.toObject(), score };
      })
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Extract features from query
   */
  extractFeatures(query) {
    const q = this.normalizeQuery(query);
    const features = [];
    for (const [feat, keywords] of Object.entries(this.featureKeywords)) {
      for (const kw of keywords) {
        if (q.includes(kw)) {
          features.push(feat);
          break;
        }
      }
    }
    return features;
  }

  /**
   * Format search results
   */
  formatSearchResults(result, originalQuery) {
    return {
      success: true,
      products: result.products,
      searchInfo: {
        originalQuery,
        strategy: result.strategy,
        extractedInfo: result.extractedInfo || {},
        features: result.features || [],
        resultCount: result.products.length,
      },
    };
  }
}

module.exports = ProductSearchService;
