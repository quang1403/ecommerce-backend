/**
 * Logger Utility
 * Enhanced logging for chatbot operations
 */

const fs = require("fs");
const path = require("path");

class Logger {
  constructor() {
    this.logDir = path.join(__dirname, "../../logs");
    this.logFile = path.join(this.logDir, "chatbot.log");

    // Ensure log directory exists
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Write log entry to file
   * @param {string} level
   * @param {string} message
   * @param {Object} metadata
   */
  writeLog(level, message, metadata = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...metadata,
    };

    const logLine = JSON.stringify(logEntry) + "\n";

    try {
      fs.appendFileSync(this.logFile, logLine);
    } catch (error) {
      console.error("Failed to write to log file:", error);
    }

    // Also log to console in development
    if (process.env.NODE_ENV !== "production") {
      const consoleMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
      console.log(consoleMessage, metadata);
    }
  }

  /**
   * Log info message
   * @param {string} message
   * @param {Object} metadata
   */
  info(message, metadata = {}) {
    this.writeLog("info", message, metadata);
  }

  /**
   * Log warning message
   * @param {string} message
   * @param {Object} metadata
   */
  warn(message, metadata = {}) {
    this.writeLog("warn", message, metadata);
  }

  /**
   * Log error message
   * @param {string} message
   * @param {Object} metadata
   */
  error(message, metadata = {}) {
    this.writeLog("error", message, metadata);
  }

  /**
   * Log debug message
   * @param {string} message
   * @param {Object} metadata
   */
  debug(message, metadata = {}) {
    if (process.env.NODE_ENV !== "production") {
      this.writeLog("debug", message, metadata);
    }
  }

  /**
   * Log chat interaction
   * @param {string} sessionId
   * @param {string} message
   * @param {string} intent
   * @param {string} response
   */
  logChatInteraction(sessionId, message, intent, response) {
    this.info("Chat interaction", {
      sessionId,
      userMessage: message,
      detectedIntent: intent,
      botResponse: response.substring(0, 100) + "...",
      timestamp: new Date(),
    });
  }

  /**
   * Log product search
   * @param {string} query
   * @param {number} resultCount
   * @param {string} strategy
   */
  logProductSearch(query, resultCount, strategy) {
    this.info("Product search", {
      query,
      resultCount,
      searchStrategy: strategy,
      timestamp: new Date(),
    });
  }

  /**
   * Log intent detection
   * @param {string} message
   * @param {string} detectedIntent
   * @param {number} confidence
   */
  logIntentDetection(message, detectedIntent, confidence = 1.0) {
    this.debug("Intent detection", {
      message: message.substring(0, 50),
      detectedIntent,
      confidence,
      timestamp: new Date(),
    });
  }

  /**
   * Log error with context
   * @param {Error} error
   * @param {Object} context
   */
  logError(error, context = {}) {
    this.error(error.message, {
      errorName: error.name,
      stack: error.stack,
      context,
      timestamp: new Date(),
    });
  }

  /**
   * Log session activity
   * @param {string} sessionId
   * @param {string} action
   * @param {Object} details
   */
  logSessionActivity(sessionId, action, details = {}) {
    this.info("Session activity", {
      sessionId,
      action,
      details,
      timestamp: new Date(),
    });
  }

  /**
   * Clean old log files (older than 30 days)
   */
  cleanOldLogs() {
    try {
      const files = fs.readdirSync(this.logDir);
      const now = Date.now();
      const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days

      files.forEach((file) => {
        const filePath = path.join(this.logDir, file);
        const stats = fs.statSync(filePath);

        if (now - stats.mtimeMs > maxAge) {
          fs.unlinkSync(filePath);
          console.log(`Deleted old log file: ${file}`);
        }
      });
    } catch (error) {
      console.error("Error cleaning old logs:", error);
    }
  }
}

// Singleton instance
const logger = new Logger();

module.exports = logger;
