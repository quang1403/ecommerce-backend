/**
 * Embedding Model
 * Lưu trữ vector embeddings cho RAG (Retrieval-Augmented Generation)
 */

const mongoose = require("mongoose");

const embeddingSchema = new mongoose.Schema({
  // Loại nội dung
  type: {
    type: String,
    required: true,
    enum: ["product", "faq", "policy", "guide", "review"],
    index: true,
  },

  // ID tham chiếu đến document gốc
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true,
  },

  // Model tham chiếu
  referenceModel: {
    type: String,
    required: true,
    enum: ["Product", "FAQ", "Policy", "Guide", "Review"],
  },

  // Text gốc đã được embed
  text: {
    type: String,
    required: true,
  },

  // Vector embedding
  embedding: {
    type: [Number],
    required: true,
  },

  // Metadata
  metadata: {
    title: String,
    category: String,
    brand: String,
    tags: [String],
    language: { type: String, default: "vi" },
  },

  // Model đã sử dụng để tạo embedding
  embeddingModel: {
    type: String,
    default: "text-embedding-3-small",
  },

  // Số chiều của vector
  dimensions: {
    type: Number,
    default: 1536,
  },

  // Số lần được truy vấn
  queryCount: {
    type: Number,
    default: 0,
  },

  // Lần cuối được truy vấn
  lastQueriedAt: {
    type: Date,
    default: null,
  },

  // Active/Inactive
  isActive: {
    type: Boolean,
    default: true,
  },

  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },

  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes
embeddingSchema.index({ type: 1, isActive: 1 });
embeddingSchema.index({ referenceId: 1, referenceModel: 1 });
embeddingSchema.index({ "metadata.category": 1 });
embeddingSchema.index({ "metadata.brand": 1 });

// Pre-save middleware
embeddingSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

// Instance methods

/**
 * Tính độ tương đồng cosine với vector khác
 */
embeddingSchema.methods.cosineSimilarity = function (otherVector) {
  if (!otherVector || otherVector.length !== this.embedding.length) {
    throw new Error("Vector dimensions do not match");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < this.embedding.length; i++) {
    dotProduct += this.embedding[i] * otherVector[i];
    normA += this.embedding[i] * this.embedding[i];
    normB += otherVector[i] * otherVector[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

/**
 * Cập nhật query count
 */
embeddingSchema.methods.incrementQueryCount = function () {
  this.queryCount += 1;
  this.lastQueriedAt = new Date();
  return this.save();
};

// Static methods

/**
 * Tìm kiếm các embeddings tương đồng
 * Note: Cần sử dụng vector search index trong MongoDB Atlas
 * hoặc tính toán cosine similarity thủ công
 */
embeddingSchema.statics.findSimilar = async function (
  queryVector,
  options = {}
) {
  const {
    type = null,
    limit = 10,
    threshold = 0.7,
    referenceModel = null,
  } = options;

  // Build filter
  const filter = { isActive: true };
  if (type) filter.type = type;
  if (referenceModel) filter.referenceModel = referenceModel;

  // Get all active embeddings (filtered)
  const embeddings = await this.find(filter).lean();

  // Calculate cosine similarity for each
  const results = embeddings.map((emb) => {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < emb.embedding.length; i++) {
      dotProduct += emb.embedding[i] * queryVector[i];
      normA += emb.embedding[i] * emb.embedding[i];
      normB += queryVector[i] * queryVector[i];
    }

    const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));

    return {
      ...emb,
      similarity,
    };
  });

  // Filter by threshold and sort by similarity
  return results
    .filter((r) => r.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
};

/**
 * Tạo hoặc cập nhật embedding
 */
embeddingSchema.statics.upsertEmbedding = async function (data) {
  const { type, referenceId, referenceModel, text, embedding, metadata } = data;

  const existing = await this.findOne({ type, referenceId, referenceModel });

  if (existing) {
    existing.text = text;
    existing.embedding = embedding;
    existing.metadata = { ...existing.metadata, ...metadata };
    existing.updatedAt = new Date();
    return existing.save();
  }

  return this.create(data);
};

/**
 * Xóa embeddings của một reference
 */
embeddingSchema.statics.deleteByReference = function (
  referenceId,
  referenceModel
) {
  return this.deleteMany({ referenceId, referenceModel });
};

/**
 * Thống kê embeddings
 */
embeddingSchema.statics.getStats = async function () {
  return this.aggregate([
    {
      $group: {
        _id: "$type",
        count: { $sum: 1 },
        avgQueryCount: { $avg: "$queryCount" },
        activeCount: {
          $sum: { $cond: ["$isActive", 1, 0] },
        },
      },
    },
    {
      $sort: { count: -1 },
    },
  ]);
};

const Embedding = mongoose.model("Embedding", embeddingSchema);

module.exports = Embedding;
