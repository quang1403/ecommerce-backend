const IntentService = require("./src/services/ai/intent.service");

const service = new IntentService();

const testCases = [
  "iPhone XS Pro giá bao nhiêu",
  "iPhone 12 giá bao nhiêu",
  "Samsung Galaxy A51 giá bao nhiêu",
  "iphone 16 series",
  "giá iphone 15",
];

console.log("🧪 Testing Intent Detection:\n");

testCases.forEach((msg) => {
  const intent = service.detectIntent(msg);
  console.log(`Message: "${msg}"`);
  console.log(`Intent: ${intent}\n`);
});
