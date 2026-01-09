/**
 * productSearchService.js
 * Rewritten & hardened product search service
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
        /samsung\s*(?:galaxy\s*)?([a-z]?\d{1,3}(?:\s*(?:ultra|plus|note|fe|5g|4g))*)/i,
        /galaxy\s*([a-z]?\d{1,3}(?:\s*(?:ultra|plus|note|fe|5g|4g))*)/i,
        /galaxy\s*z\s*(fold|flip)\s*(\d{1,2})?/i, // Galaxy Z Fold/Flip series
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
      headphone: [
        /(?:tai\s*nghe|headphone|earphone|earbud)(?:\s*(?:bluetooth|không\s*dây|khong\s*day|wireless))?/i,
        /\b(?:airpods?|ap|a\.p\.?)\s*(\d+|pro|max|ultra)?/i,
        /(?:sony|jbl|bose|beats|samsung\s*buds?)(?:\s*\w+)?/i,
        /(?:galaxy\s*buds?)(?:\s*\d+)?(?:\s*(?:pro|plus|live|fe))?/i,
        /(?:jabra|anker|soundpeats|edifier)(?:\s*\w+)?/i,
      ],
      airpods: [/\b(?:airpods?|ap|a\.p\.?)\s*(\d+|pro|max|ultra)?/i],
    };

    // brand mapping & aliases
    this.brandMapping = {
      iphone: "Apple",
      ipad: "Apple",
      apple: "Apple",
      ap: "Apple",
      airpods: "Apple",
      samsung: "Samsung",
      galaxy: "Samsung",
      sam: "Samsung",
      buds: "Samsung",
      "galaxy buds": "Samsung",
      xiaomi: "Xiaomi",
      redmi: "Xiaomi",
      poco: "Xiaomi",
      oppo: "Oppo",
      reno: "Oppo",
      find: "Oppo",
      vivo: "Vivo",
      realme: "Realme",
      sony: "Sony",
      jbl: "JBL",
      bose: "Bose",
      beats: "Beats",
      jabra: "Jabra",
      anker: "Anker",
      soundpeats: "SoundPeats",
      edifier: "Edifier",
    };

    this.synonyms = {
      // Máy tính bảng
      "máy tính bảng": "ipad tablet",
      "may tinh bang": "ipad tablet",
      tablet: "ipad",

      // Nhu cầu sử dụng -> Features
      "máy chơi game": "gaming phone smartphone điện thoại hiệu năng cao",
      "may choi game": "gaming phone smartphone điện thoại hiệu năng cao",
      "chơi game": "gaming hiệu năng cao performance",
      "choi game": "gaming hiệu năng cao performance",
      gaming: "hiệu năng cao performance chipset mạnh",
      "máy chụp ảnh": "camera phone smartphone điện thoại camera tốt",
      "may chup anh": "camera phone smartphone điện thoại camera tốt",
      "chụp ảnh đẹp": "camera tốt camera chất lượng cao",
      "chup anh dep": "camera tốt camera chất lượng cao",
      "pin trâu": "pin lớn battery life dung lượng pin cao",
      "pin khỏe": "pin lớn battery life dung lượng pin cao",

      // Tai nghe - Phong phú hơn
      "tai nghe": "headphone earphone earbud airpods",
      "tai nghe không dây": "wireless headphone bluetooth earphone airpods",
      "tai nghe khong day": "wireless headphone bluetooth earphone airpods",
      "tai nghe bluetooth": "bluetooth headphone wireless earphone airpods",
      "tai nghe true wireless": "tws earbuds airpods",
      "tai nghe chụp tai": "over ear headphone",
      "tai nghe nhét tai": "in ear earphone earbud",
      "tai nghe thể thao": "sport earphone workout headphone",
      "tai nghe gaming": "gaming headset headphone",
      "tai nghe có dây": "wired headphone earphone",
      earbuds: "earphone airpods wireless",
      tws: "true wireless earbuds airpods",
      headset: "headphone gaming",

      // Điện thoại
      "điện thoại": "phone smartphone",
      "dien thoai": "phone smartphone",
      "smart phone": "phone",
      "di động": "phone",
      "di dong": "phone",
      máy: "phone smartphone điện thoại", // "máy" trong context cửa hàng phone
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
      price: [
        "rẻ",
        "giá thấp",
        "tiết kiệm",
        "bình dân",
        "budget",
        "tầm giá",
        "khoảng",
      ],
      premium: ["cao cấp", "premium", "flagship", "đắt", "pro", "max", "ultra"],
      gaming: [
        "gaming",
        "game",
        "chơi game",
        "choi game",
        "máy chơi game",
        "may choi game",
        "hiệu năng cao",
        "mượt",
        "performance",
        "chipset mạnh",
        "ram cao",
      ],
      camera: [
        "camera",
        "chụp ảnh",
        "chup anh",
        "máy chụp ảnh",
        "may chup anh",
        "selfie",
        "quay video",
        "zoom",
        "camera đẹp",
        "camera tốt",
      ],
      battery: [
        "pin",
        "battery",
        "sạc",
        "dung lượng pin",
        "pin trâu",
        "pin khỏe",
      ],
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

          // 🎯 Log top 3 results để debug
          console.log(`\n🔍 Top results for "${rawQuery}":`);
          res.products.slice(0, 3).forEach((p, idx) => {
            console.log(
              `${idx + 1}. ${p.name} (score: ${p.score || "N/A"}, stock: ${
                p.stock
              })`
            );
          });
          console.log("");

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

    // 🎯 Apply synonyms TRƯỚC khi normalize
    for (const [synonym, replacement] of Object.entries(this.synonyms)) {
      const regex = new RegExp(synonym, "gi");
      if (regex.test(s)) {
        s = s.replace(regex, replacement);
        console.log(
          `🔄 Synonym replaced: "${synonym}" → "${replacement}" | Query: "${s}"`
        );
      }
    }

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

      // Build better search criteria focusing on brand/model
      const searchCriteria = [];

      // If we have brand, prioritize it
      if (info.brand) {
        const brandPattern = new RegExp(info.brand, "i");
        searchCriteria.push({ name: brandPattern });
      }

      // If we have model, use it
      if (info.model) {
        const modelPattern = new RegExp(
          info.model.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          "i"
        );
        searchCriteria.push({ name: modelPattern });
      }

      // If no brand/model extracted, use tokens but filter out common words
      if (!info.brand && !info.model) {
        const stopWords = [
          "con",
          "hang",
          "khong",
          "co",
          "gi",
          "nao",
          "the",
          "nay",
          "kia",
          "duoc",
          "cho",
          "toi",
          "mua",
          "ban",
          "gia",
          "bao",
          "nhieu",
        ];
        const tokens = query
          .split(" ")
          .filter((t) => t.length > 1 && !stopWords.includes(t));

        if (tokens.length > 0) {
          // Only use first 3 most meaningful tokens
          const meaningfulTokens = tokens.slice(0, 3);
          const pattern = new RegExp(meaningfulTokens.join(".*"), "i");
          searchCriteria.push({ name: pattern });
        }
      }

      if (searchCriteria.length === 0) {
        return { success: false, products: [] };
      }

      const products = await Product.find({
        $or: searchCriteria,
      })
        .populate("brand")
        .sort({ rating: -1, sold: -1 })
        .limit(30);

      if (!products || products.length === 0)
        return { success: false, products: [] };

      const scored = this.scoreProducts(products, query, info);

      // Filter out products with very low scores (< 0.2)
      const filtered = scored.filter((p) => p.searchScore >= 0.2);

      if (filtered.length === 0) {
        return { success: false, products: [] };
      }

      return {
        success: true,
        products: filtered.slice(0, 10),
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

    // Enhanced headphone detection with AP abbreviation and model extraction
    if (
      /\btai\s*nghe\b|\bairpods?\b|\bearbud\b|\b(?:ap|a\.p\.?)\s*\d/i.test(q)
    ) {
      info.type = "accessory";

      // Detect AirPods (full name or AP abbreviation)
      if (/\b(?:airpods?|ap|a\.p\.?)\b/i.test(q)) {
        info.brand = "Apple";

        // Extract model number: "AirPods 3", "AP 4", "A.P. 2"
        const modelMatch = q.match(
          /\b(?:airpods?|ap|a\.p\.?)\s*(\d+|pro|max)?/i
        );
        if (modelMatch && modelMatch[1]) {
          info.model = `AirPods ${modelMatch[1]}`;
        } else {
          info.model = "AirPods";
        }
      } else {
        // Generic headphone - try to extract brand and model from remaining text
        // Example: "tai nghe Sony WH-1000XM5"
        const brandMatch = q.match(
          /\b(sony|samsung|jbl|bose|beats|xiaomi|oppo|huawei)\b/i
        );
        if (brandMatch) {
          info.brand =
            brandMatch[1].charAt(0).toUpperCase() +
            brandMatch[1].slice(1).toLowerCase();
        }

        // Extract model code/number
        const modelMatch = q.match(/\b([a-z]{2,4}[-\s]*\d{1,4}[a-z\d]*)\b/i);
        if (modelMatch) {
          info.model = modelMatch[1].toUpperCase();
        }
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

          // Special handling for Galaxy Z Fold/Flip series
          if (
            brandKey === "samsung" &&
            /galaxy\s*z\s*(fold|flip)/i.test(match[0])
          ) {
            const zType = match[1]; // "Fold" or "Flip"
            const number = match[2] || ""; // Number like "6"
            info.model = number ? `Z ${zType} ${number}` : `Z ${zType}`;
            info.variant = null;

            if (pattern && pattern.lastIndex) pattern.lastIndex = 0;
            return info;
          }

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

      // Escape model but allow flexible spaces
      const modelParts = extractedInfo.model.split(/\s+/);
      const m = modelParts
        .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("\\s*");

      ors.push({ name: new RegExp(`${brandPattern}.*${m}`, "i") });
      ors.push({ name: new RegExp(`${m}.*${brandPattern}`, "i") });
      ors.push({ name: new RegExp(`${m}`, "i") }); // Remove word boundary for flexibility
    } else if (extractedInfo.model) {
      // Split model by spaces and allow flexible matching
      const modelParts = extractedInfo.model.split(/\s+/);
      const m = modelParts
        .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("\\s*");
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
    const q = rawQuery.toLowerCase().trim();
    return products
      .map((product) => {
        let score = 0;
        const name = (product.name || "").toLowerCase().trim();

        // 🎯 EXACT MATCH - Ưu tiên tuyệt đối
        // VD: "iphone 15" khớp chính xác "iPhone 15" → +500 điểm
        if (name === q) {
          score += 500;
        }

        // 🎯 EXACT MATCH không dấu (normalize)
        const normalizedName = name.replace(/\s+/g, "").replace(/[^\w]/g, "");
        const normalizedQ = q.replace(/\s+/g, "").replace(/[^\w]/g, "");
        if (normalizedName === normalizedQ) {
          score += 450;
        }

        // 🎯 EXACT PRODUCT TYPE MATCH
        // "ipad pro" trong query → "ipad pro" trong tên = +300, "iphone pro" = 0
        const productTypes = [
          "ipad",
          "iphone",
          "galaxy",
          "xiaomi",
          "redmi",
          "airpods",
          "tai nghe",
          "headphone",
          "earphone",
          "earbud",
        ];
        for (const type of productTypes) {
          if (q.includes(type) && name.includes(type)) {
            score += 300;
            console.log(
              `✅ Exact product type match: "${type}" in "${name}" (+300)`
            );
            break;
          } else if (q.includes(type) && !name.includes(type)) {
            // Query có type này nhưng product không có → Penalty lớn
            score -= 250;
            console.log(
              `❌ Type mismatch: query wants "${type}" but product is "${name}" (-250)`
            );
            break;
          }
        }

        // 🎯 SHORTER NAME PRIORITY
        // Nếu cả 2 đều chứa query, ưu tiên tên ngắn hơn
        // VD: "iPhone 15" (10 ký tự) > "iPhone 15 màu trắng" (20 ký tự)
        if (q.length > 2 && name.includes(q)) {
          score += 150;
          // Bonus cho tên ngắn: càng gần độ dài query càng cao
          const lengthDiff = name.length - q.length;
          if (lengthDiff === 0) {
            score += 300; // Exact length match
          } else if (lengthDiff < 5) {
            score += 200; // Very close
          } else if (lengthDiff < 10) {
            score += 100; // Close
          } else if (lengthDiff < 20) {
            score += 50; // Moderately close
          }
          // Penalty cho tên quá dài (có thể là variant)
          if (lengthDiff > 15) {
            score -= 50;
          }
        } else {
          // 🎯 FUZZY MATCH cho các token riêng lẻ
          // VD: "tai nghe ap 3" match "Tai nghe AP 3 Pro" (có cả 4 tokens)
          const queryTokens = q.split(/\s+/).filter((t) => t.length > 1);
          const nameTokens = name.split(/\s+/).filter((t) => t.length > 1);
          let matchedTokens = 0;

          for (const qToken of queryTokens) {
            for (const nToken of nameTokens) {
              if (nToken.includes(qToken) || qToken.includes(nToken)) {
                matchedTokens++;
                break;
              }
            }
          }

          if (matchedTokens > 0 && queryTokens.length > 0) {
            const matchRatio = matchedTokens / queryTokens.length;
            score += Math.round(matchRatio * 150);
            if (matchRatio >= 0.8) {
              console.log(
                `✅ Fuzzy match: ${matchedTokens}/${
                  queryTokens.length
                } tokens in "${name}" (+${Math.round(matchRatio * 150)})`
              );
            }
          }
        }

        // model match strongly
        if (
          extractedInfo.model &&
          name.includes(extractedInfo.model.toLowerCase())
        )
          score += 120;

        // variant - LOGIC MÀU SẮC THÔNG MINH
        // Phân biệt 2 trường hợp:
        // 1. "iPhone 15 có những màu nào" → Cần sản phẩm BASE (iPhone 15), không phải variant
        // 2. "iPhone 15 màu đen" → Cần variant cụ thể
        const colorKeywords = [
          "đen",
          "trắng",
          "đỏ",
          "xanh",
          "vàng",
          "hồng",
          "tím",
          "xám",
          "bạc",
          "gold",
          "black",
          "white",
          "red",
          "blue",
          "green",
          "purple",
          "gray",
          "silver",
          "titan",
          "titanium",
        ];

        const askingAboutColors =
          /có (những )?màu (gì|nào|sắc)/i.test(q) ||
          /màu sắc nào/i.test(q) ||
          /bao nhiêu màu/i.test(q) ||
          /mấy màu/i.test(q);

        const nameHasColorInName = colorKeywords.some((keyword) =>
          name.includes(keyword)
        );
        const queryHasSpecificColor = colorKeywords.some((keyword) =>
          q.includes(keyword)
        );

        //  CASE 1: User hỏi "có những màu nào" → Ưu tiên sản phẩm BASE
        if (askingAboutColors && nameHasColorInName) {
          // Tên có màu cụ thể nhưng user đang hỏi CÓ MÀU GÌ → Penalty mạnh
          score -= 200;
          console.log(
            `⚠️ Penalty: "${name}" có màu cụ thể khi user hỏi về danh sách màu (-200)`
          );
        }

        //  CASE 2: User không hỏi về màu, nhưng tên có màu → Penalty
        if (
          !askingAboutColors &&
          !queryHasSpecificColor &&
          nameHasColorInName
        ) {
          score -= 150;
          console.log(
            `⚠️ Penalty: "${name}" có màu khi user không hỏi về màu (-150)`
          );
        }

        //  CASE 3: User hỏi màu cụ thể → Bonus cho variant đúng màu
        if (queryHasSpecificColor && nameHasColorInName) {
          // Check if name contains the specific color user asked for
          const matchingColor = colorKeywords.find(
            (keyword) => q.includes(keyword) && name.includes(keyword)
          );
          if (matchingColor) {
            score += 200;
            console.log(
              `✅ Bonus: "${name}" khớp màu "${matchingColor}" user yêu cầu (+200)`
            );
          }
        }

        //  CASE 4: Ưu tiên BASE MODEL khi user hỏi về màu
        // VD: "iPhone 12 có màu nào" → Ưu tiên "iPhone 12" hơn "iPhone 12 Pro Max"
        if (askingAboutColors) {
          const variantKeywords = [
            "pro max",
            "pro",
            "plus",
            "ultra",
            "mini",
            "lite",
            "se",
          ];
          const isVariantModel = variantKeywords.some((keyword) =>
            name.includes(keyword)
          );

          // Extract base model từ query
          // "iPhone 12 có màu nào" → base = "iphone 12"
          const baseModelMatch = q.match(
            /(iphone|ipad|samsung|galaxy|xiaomi|redmi|oppo|vivo|realme|nokia)\s*(\d+)/i
          );

          if (baseModelMatch && isVariantModel) {
            const baseModel = baseModelMatch[0].toLowerCase();
            // Check if name có chính xác base model + variant
            // VD: "iphone 12 pro max" chứa "iphone 12" + "pro max"
            if (name.includes(baseModel)) {
              score -= 150;
              console.log(
                `⚠️ Penalty: "${name}" là variant model khi user hỏi base model màu (-150)`
              );
            }
          } else if (baseModelMatch && !isVariantModel) {
            // Đây là base model, bonus
            const baseModel = baseModelMatch[0].toLowerCase();
            // Check exact: "iphone 12" trong "iphone 12" (không có pro/max/plus)
            const nameWords = name.split(/\s+/);
            const hasExactBase = nameWords.some((word, idx) => {
              if (idx === 0) return false; // skip brand
              return word === baseModel.split(/\s+/)[1]; // so sánh số
            });

            if (hasExactBase && nameWords.length <= 3) {
              // VD: "iphone 12" (2 words) hoặc "iphone 12 64gb" (3 words)
              score += 150;
              console.log(`✅ Bonus: "${name}" là base model chính xác (+150)`);
            }
          }
        }

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

        //  Final score log for debugging
        if (name.includes("iphone 15")) {
          console.log(
            `📊 Score for "${name}": ${score} (query: "${q.substring(0, 30)}")`
          );
        }

        return { ...product.toObject(), score };
      })
      .sort((a, b) => {
        // Log top 3 products for debugging
        if (a.score > 0 || b.score > 0) {
          const aShort = (a.name || "").substring(0, 30);
          const bShort = (b.name || "").substring(0, 30);
          if (Math.abs(a.score - b.score) < 50) {
            console.log(
              `⚖️ Score comparison: "${aShort}" (${a.score}) vs "${bShort}" (${b.score})`
            );
          }
        }
        return b.score - a.score;
      });
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
