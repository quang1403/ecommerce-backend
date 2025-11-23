/**
 * OpenAI Configuration
 * Cấu hình client OpenAI cho toàn bộ ứng dụng
 */

const OpenAI = require("openai");

if (!process.env.OPENAI_API_KEY) {
  console.warn(" OPENAI_API_KEY chưa được cấu hình trong .env");
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Cấu hình model mặc định
 */
const config = {
  model: process.env.OPENAI_MODEL || "gpt-4o-mini",
  maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 1000,
  temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.7,

  // Embedding model cho RAG
  embeddingModel: "text-embedding-3-small",
  embeddingDimensions: 1536,
};

/**
 * Tạo chat completion
 * @param {Array} messages - Mảng messages
 * @param {Object} options - Tùy chọn
 * @returns {Promise<string>}
 */
async function createChatCompletion(messages, options = {}) {
  try {
    const completion = await openai.chat.completions.create({
      model: options.model || config.model,
      messages: messages,
      max_tokens: options.maxTokens || config.maxTokens,
      temperature: options.temperature || config.temperature,
      ...options,
    });

    return completion.choices[0].message.content.trim();
  } catch (error) {
    console.error("❌ OpenAI API Error:", error.message);
    throw new Error("Lỗi khi gọi OpenAI API: " + error.message);
  }
}

/**
 * Tạo embeddings cho text
 * @param {string|Array} input - Text hoặc mảng texts
 * @returns {Promise<Array>}
 */
async function createEmbeddings(input) {
  try {
    const response = await openai.embeddings.create({
      model: config.embeddingModel,
      input: input,
      dimensions: config.embeddingDimensions,
    });

    return response.data.map((item) => item.embedding);
  } catch (error) {
    console.error("❌ Embedding Error:", error.message);
    throw new Error("Lỗi khi tạo embeddings: " + error.message);
  }
}

/**
 * Stream chat completion (cho realtime response)
 * @param {Array} messages
 * @param {Function} onChunk - Callback khi có chunk mới
 * @param {Object} options
 */
async function streamChatCompletion(messages, onChunk, options = {}) {
  try {
    const stream = await openai.chat.completions.create({
      model: options.model || config.model,
      messages: messages,
      max_tokens: options.maxTokens || config.maxTokens,
      temperature: options.temperature || config.temperature,
      stream: true,
      ...options,
    });

    let fullContent = "";

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        fullContent += content;
        onChunk(content);
      }
    }

    return fullContent;
  } catch (error) {
    console.error("❌ Stream Error:", error.message);
    throw new Error("Lỗi khi stream response: " + error.message);
  }
}

module.exports = {
  openai,
  config,
  createChatCompletion,
  createEmbeddings,
  streamChatCompletion,
};
