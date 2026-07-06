/**
 * 日志模块
 * 提供统一的日志记录功能，支持多级别、多输出目标
 */

const fs = require('fs');
const path = require('path');

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

const currentLevel = process.env.LOG_LEVEL
  ? LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()] || LOG_LEVELS.INFO
  : LOG_LEVELS.INFO;

const formatMessage = (level, message, meta = {}) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...meta
  };

  if (Object.keys(meta).length > 0) {
    return `[${timestamp}] [${level}] ${message} ${JSON.stringify(meta)}`;
  }
  return `[${timestamp}] [${level}] ${message}`;
};

const writeToFile = (level, message) => {
  const logDir = path.join(__dirname, '../logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const today = new Date().toISOString().split('T')[0];
  const logFile = path.join(logDir, `${today}.log`);

  fs.appendFileSync(logFile, message + '\n');
};

const shouldLog = (level) => {
  return LOG_LEVELS[level] <= currentLevel;
};

const log = {
  error: (message, meta = {}) => {
    if (!shouldLog('ERROR')) return;
    const formatted = formatMessage('ERROR', message, meta);
    console.error(formatted);
    writeToFile('ERROR', formatted);
  },

  warn: (message, meta = {}) => {
    if (!shouldLog('WARN')) return;
    const formatted = formatMessage('WARN', message, meta);
    console.warn(formatted);
    writeToFile('WARN', formatted);
  },

  info: (message, meta = {}) => {
    if (!shouldLog('INFO')) return;
    const formatted = formatMessage('INFO', message, meta);
    console.log(formatted);
    writeToFile('INFO', formatted);
  },

  debug: (message, meta = {}) => {
    if (!shouldLog('DEBUG')) return;
    const formatted = formatMessage('DEBUG', message, meta);
    console.log(formatted);
    writeToFile('DEBUG', formatted);
  },

  timing: (label, duration, meta = {}) => {
    const formatted = formatMessage('INFO', `[TIMING] ${label}: ${duration}ms`, meta);
    console.log(formatted);
    writeToFile('INFO', formatted);
  },

  request: (req, res, duration) => {
    const meta = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip
    };
    const formatted = formatMessage('INFO', `[REQUEST] ${req.method} ${req.originalUrl}`, meta);
    console.log(formatted);
    writeToFile('INFO', formatted);
  },

  sql: (query, duration) => {
    if (!shouldLog('DEBUG')) return;
    const formatted = formatMessage('DEBUG', `[SQL] ${query}`, { duration: `${duration}ms` });
    console.log(formatted);
    writeToFile('DEBUG', formatted);
  }
};

const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    log.request(req, res, duration);
  });

  next();
};

const errorLogger = (err, req, res, next) => {
  log.error('请求错误', {
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip
  });
  next(err);
};

module.exports = {
  ...log,
  LOG_LEVELS,
  requestLogger,
  errorLogger
};
