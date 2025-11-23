# Kiến Trúc AI Chatbot - Cấu Trúc Mới

## 📁 Cấu Trúc Thư Mục

```
src/
├── services/
│   ├── ai/                          # 🤖 AI Services - Logic xử lý chatbot
│   │   ├── chat.service.js          # Orchestrator chính - điều phối tất cả
│   │   ├── intent.service.js        # Nhận diện intent từ tin nhắn
│   │   ├── prompt.service.js        # Quản lý prompts cho ChatGPT
│   │   ├── productSearch.service.js # Tìm kiếm sản phẩm thông minh
│   │   └── dataset.service.js       # Quản lý dữ liệu training
│   │
│   ├── chatService.js               # Legacy service (sẽ deprecated)
│   └── productSearchService.js      # Legacy service (sẽ deprecated)
│
├── controllers/
│   └── chatController.js            # ✅ Đã cập nhật - sử dụng ChatService mới
│
├── utils/
│   ├── textCleaner.js               # Chuẩn hóa và làm sạch text
│   ├── parser.js                    # Phân tích và trích xuất thông tin
│   └── logger.js                    # Logging cho chatbot
│
└── datasets/                        # 📊 Dữ liệu training
    ├── training/                    # Tương tác chat để học
    ├── suggestions/                 # Gợi ý sản phẩm thành công
    └── mistakes/                    # Lỗi để cải thiện
```

## 🔄 Luồng Xử Lý Mới

### 1. Request Flow

```
User Message → ChatController → ChatService
                                      ↓
                            IntentService (nhận diện intent)
                                      ↓
                            Delegate to specialized handler
                                      ↓
                            PromptService (tạo prompt)
                                      ↓
                            OpenAI API → Response
```

### 2. Các Intent Được Hỗ Trợ

| Intent                | Mô Tả            | Handler                      |
| --------------------- | ---------------- | ---------------------------- |
| `product_inquiry`     | Tư vấn sản phẩm  | `handleProductInquiry()`     |
| `installment_inquiry` | Tư vấn trả góp   | `handleInstallmentInquiry()` |
| `product_compare`     | So sánh sản phẩm | `handleProductCompare()`     |
| `order_tracking`      | Tra cứu đơn hàng | `handleOrderTracking()`      |
| `stock_check`         | Kiểm tra tồn kho | `handleStockCheck()`         |
| `recommendation`      | Gợi ý sản phẩm   | `handleRecommendation()`     |
| `greeting`            | Chào hỏi         | `handleGreeting()`           |
| `general`             | Câu hỏi chung    | `handleGeneral()`            |

## 🚀 Sử Dụng

### Endpoint Chính (Recommended)

```http
POST /api/chat/ask
Content-Type: application/json

{
  "message": "Tìm iPhone 15 Pro Max giá rẻ nhất",
  "sessionId": "optional_session_id"
}
```

### Response Format

```json
{
  "success": true,
  "reply": "Câu trả lời từ AI...",
  "intent": "product_inquiry",
  "sessionId": "session_123",
  "timestamp": "2025-11-19T...",
  "data": {
    "products": [...],
    "searchInfo": {...}
  }
}
```

## 📝 Chi Tiết Các Service

### ChatService (chat.service.js)

**Vai trò**: Orchestrator chính - điều phối tất cả logic

**Methods chính**:

- `processChat(message, session, user)` - Xử lý tin nhắn chính
- `handleProductInquiry()` - Xử lý tư vấn sản phẩm
- `handleInstallmentInquiry()` - Xử lý trả góp
- `generateAIResponse()` - Gọi OpenAI API
- `parseProductSelection()` - Phân tích lựa chọn sản phẩm
- `updateSessionContext()` - Cập nhật context

### IntentService (intent.service.js)

**Vai trò**: Nhận diện intent từ tin nhắn

**Methods chính**:

- `detectIntent(message, session)` - Nhận diện intent
- `detectContextIntent(message, session)` - Nhận diện dựa trên context
- `hasProductMention(message)` - Kiểm tra có nhắc sản phẩm không
- `extractProductName(message)` - Trích xuất tên sản phẩm

**Patterns nhận diện**:

- Greeting: "xin chào", "hello", "hi"
- Product: "iphone", "samsung", "điện thoại"
- Installment: "trả góp", "X tháng", "lãi suất"
- Order: "đơn hàng", mã đơn số

### PromptService (prompt.service.js)

**Vai trò**: Quản lý prompts cho ChatGPT

**Methods chính**:

- `createProductInquiryPrompt()` - Prompt cho tư vấn sản phẩm
- `createComparePrompt()` - Prompt cho so sánh
- `createInstallmentPolicyPrompt()` - Chính sách trả góp
- `createGeneralPrompt()` - Prompt chung

### ProductSearchService (productSearch.service.js)

**Vai trò**: Tìm kiếm sản phẩm thông minh

**Chiến lược tìm kiếm**:

1. **Exact Model Search** - Tìm chính xác model
2. **Brand Based Search** - Tìm theo thương hiệu
3. **Feature Based Search** - Tìm theo tính năng
4. **Fuzzy Search** - Tìm gần đúng
5. **Fallback Search** - Sản phẩm phổ biến

**Scoring System**:

- Exact name match: +100
- Model match: +80
- Brand match: +60
- Variant match: +40
- Rating: +5 per star
- Sold count: up to +20
- In stock: +10

### DatasetService (dataset.service.js)

**Vai trò**: Quản lý dữ liệu training

**Methods chính**:

- `saveTrainingData()` - Lưu tương tác để học
- `saveMistake()` - Lưu lỗi để cải thiện
- `saveSuggestion()` - Lưu gợi ý thành công
- `analyzeTrainingData()` - Phân tích dữ liệu
- `exportForFineTuning()` - Xuất data cho fine-tune

## 🛠️ Utils

### TextCleaner (textCleaner.js)

- `normalizeVietnamese()` - Chuẩn hóa tiếng Việt
- `cleanText()` - Xóa ký tự đặc biệt
- `extractNumbers()` - Trích xuất số
- `extractPrices()` - Trích xuất giá
- `extractKeywords()` - Trích xuất từ khóa
- `sanitizeInput()` - Bảo mật input

### Parser (parser.js)

- `parseProductSelection()` - Phân tích lựa chọn sản phẩm
- `parseProductSpecs()` - Phân tích thông số kỹ thuật
- `parseInstallmentInfo()` - Phân tích thông tin trả góp
- `parseComparisonRequest()` - Phân tích yêu cầu so sánh
- `parseOrderCode()` - Phân tích mã đơn hàng
- `parsePriceRange()` - Phân tích khoảng giá

### Logger (logger.js)

- `info()`, `warn()`, `error()`, `debug()` - Logging
- `logChatInteraction()` - Log tương tác chat
- `logProductSearch()` - Log tìm kiếm sản phẩm
- `logIntentDetection()` - Log nhận diện intent

## 🔧 Cấu Hình

### Environment Variables

```env
OPENAI_API_KEY=your_openai_api_key
NODE_ENV=development
```

### OpenAI Model

- Model: `gpt-4o-mini`
- Max tokens: 1000
- Temperature: 0.7

## 📊 Session Management

Session lưu trữ context giữa các tin nhắn:

```javascript
{
  sessionId: "guest_...",
  userId: "user_id",
  context: {
    lastIntent: "product_inquiry",
    productOptions: [...],      // Sản phẩm đang xem xét
    currentProduct: {...},      // Sản phẩm đã chọn
    searchInfo: {...},          // Thông tin tìm kiếm
    lastMessage: "..."
  },
  createdAt: Date,
  lastActivity: Date
}
```

## 🎯 Ví Dụ Sử Dụng

### 1. Tư vấn sản phẩm

```javascript
// User: "Tìm iPhone 15 Pro Max"
→ Intent: product_inquiry
→ ProductSearchService tìm kiếm
→ PromptService tạo prompt với danh sách sản phẩm
→ ChatGPT tư vấn
→ Response với products data
```

### 2. Chọn sản phẩm và tính trả góp

```javascript
// User: "số 1" (sau khi có danh sách)
→ Intent: installment_inquiry (từ context)
→ Parse selection → product #1
→ Calculate installment options
→ Response với bảng trả góp
```

### 3. So sánh sản phẩm

```javascript
// User: "So sánh iPhone 15 vs Samsung S24"
→ Intent: product_compare
→ Extract 2 products
→ Create comparison prompt
→ ChatGPT so sánh chi tiết
```

## 🔄 Migration từ Old Service

### Old Way (Deprecated)

```javascript
const chatService = require("../services/chatService");
const result = await chatService.handleProductInquiry(...);
```

### New Way (Recommended)

```javascript
const ChatService = require("../services/ai/chat.service");
const chatService = new ChatService();
const response = await chatService.processChat(message, session, user);
```

## 📈 Monitoring & Analytics

### Dữ liệu được thu thập

- ✅ Tất cả tương tác chat (training/)
- ✅ Gợi ý sản phẩm thành công (suggestions/)
- ✅ Lỗi và feedback (mistakes/)

### Phân tích

```javascript
const datasetService = new DatasetService();
const stats = await datasetService.analyzeTrainingData();
// → { totalInteractions, intentDistribution, helpfulnessRate, topQueries }
```

## 🚧 Tính Năng Sắp Tới

- [ ] RAG Service - Tìm kiếm thông minh hơn
- [ ] Recommendation Service - Gợi ý cá nhân hóa
- [ ] Compare Service - So sánh nâng cao
- [ ] Order Service - Xử lý đơn hàng
- [ ] Stock Service - Quản lý tồn kho
- [ ] Fine-tuned model - Model tùy chỉnh cho domain

## 📞 Support

Nếu có vấn đề, kiểm tra:

1. Logs tại `logs/chatbot.log`
2. Dataset files tại `src/datasets/`
3. Console output (development mode)

---

**Version**: 2.0.0  
**Last Updated**: 2025-11-19  
**Architecture**: Clean, Modular, Scalable
