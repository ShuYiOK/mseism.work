/**
 * 日志系统模块 - 基于 Winston
 * 支持多级别日志、日志轮转、格式化输出
 */

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');
const config = require('./config');

// 日志目录
const LOG_DIR = path.join(__dirname, 'logs');

// 确保日志目录存在
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// 日志级别
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// 日志颜色
const LOG_COLORS = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue'
};

winston.addColors(LOG_COLORS);

// 自定义格式
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack, ...metadata }) => {
    let log = \`[\${timestamp}] [\${level.toUpperCase().padEnd(5)}]\`;
    
    if (metadata.module) {
      log += \` [\${metadata.module}]\`;
      delete metadata.module;
    }
    
    log += \` \${message}\`;
    
    if (Object.keys(metadata).length > 0) {
      log += \` \${JSON.stringify(metadata)}\`;
    }
    
    if (stack) {
      log += \`\\n\${stack}\`;
    }
    
    return log;
  })
);

// 控制台格式（带颜色）
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.printf(({ level, message, timestamp, ...metadata }) => {
    let log = \`[\${timestamp}] [\${level}]\`;
    if (metadata.module) {
      log += \` [\${metadata.module}]\`;
      delete metadata.module;
    }
    log += \` \${message}\`;
    if (Object.keys(metadata).length > 0) {
      log += \` \${JSON.stringify(metadata)}\`;
    }
    return log;
  })
);

// 创建日志传输器
const transports = [
  new winston.transports.Console({
    level: config.logging?.level || 'info',
    format: consoleFormat,
    handleExceptions: true,
    handleRejections: true
  })
];

// 生产环境添加文件输出
if (config.server?.isProduction || process.env.NODE_ENV === 'production') {
  transports.push(
    new DailyRotateFile({
      level: 'error',
      filename: path.join(LOG_DIR, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      format: customFormat,
      handleExceptions: true,
      handleRejections: true
    })
  );

  transports.push(
    new DailyRotateFile({
      level: 'info',
      filename: path.join(LOG_DIR, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      format: customFormat
    })
  );

  if (config.logging?.enableAccessLog) {
    transports.push(
      new DailyRotateFile({
        level: 'http',
        filename: path.join(LOG_DIR, 'access-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '7d',
        format: customFormat
      })
    );
  }
}

// 创建 Logger 实例
const logger = winston.createLogger({
  levels: LOG_LEVELS,
  transports,
  exitOnError: false
});

// 创建模块日志器工厂函数
function createModuleLogger(moduleName) {
  return {
    error: (message, meta = {}) => logger.error(message, { module: moduleName, ...meta }),
    warn: (message, meta = {}) => logger.warn(message, { module: moduleName, ...meta }),
    info: (message, meta = {}) => logger.info(message, { module: moduleName, ...meta }),
    http: (message, meta = {}) => logger.http(message, { module: moduleName, ...meta }),
    debug: (message, meta = {}) => logger.debug(message, { module: moduleName, ...meta }),
    log: (level, message, meta = {}) => logger.log(level, message, { module: moduleName, ...meta }),
    startTimer: () => {
      const start = Date.now();
      return {
        done: (message, meta = {}) => {
          const duration = Date.now() - start;
          logger.info(message, { module: moduleName, duration: \`\${duration}ms\`, ...meta });
          return duration;
        }
      };
    }
  };
}

// HTTP 请求日志中间件
function httpLoggerMiddleware(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const message = \`\${req.method} \${req.originalUrl} \${res.statusCode} - \${duration}ms\`;
    
    if (res.statusCode >= 400) {
      logger.warn(message, {
        module: 'HTTP',
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration,
        ip: req.ip
      });
    } else {
      logger.http(message, {
        module: 'HTTP',
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration
      });
    }
  });
  
  next();
}

function getLogStats() {
  const stats = {
    logDir: LOG_DIR,
    files: []
  };
  
  try {
    const files = fs.readdirSync(LOG_DIR);
    files.forEach(file => {
      const filePath = path.join(LOG_DIR, file);
      const stat = fs.statSync(filePath);
      stats.files.push({
        name: file,
        size: stat.size,
        modified: stat.mtime
      });
    });
  } catch (error) {
    stats.error = error.message;
  }
  
  return stats;
}

function cleanOldLogs(daysToKeep = 30) {
  const cutoff = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;
  let cleaned = 0;
  
  try {
    const files = fs.readdirSync(LOG_DIR);
    files.forEach(file => {
      const filePath = path.join(LOG_DIR, file);
      const stat = fs.statSync(filePath);
      if (stat.mtime.getTime() < cutoff) {
        fs.unlinkSync(filePath);
        cleaned++;
      }
    });
  } catch (error) {
    logger.error('清理日志失败', { error: error.message });
  }
  
  return cleaned;
}

module.exports = {
  logger,
  createModuleLogger,
  httpLoggerMiddleware,
  getLogStats,
  cleanOldLogs,
  LOG_LEVELS
};
