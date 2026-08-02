/**
 * 配置管理系统
 * 集中管理所有应用配置，支持环境变量、配置验证、热更新
 */
const path = require('path');
const Joi = require('joi');

// 加载环境变量
require('dotenv').config({ path: path.join(__dirname, '.env'), override: true });

// 配置验证模式
const configSchema = Joi.object({
  // 服务器配置
  PORT: Joi.number().integer().min(1).max(65535).default(3001),
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  
  // MySQL 数据库配置
  DB_HOST: Joi.string().default('localhost'),
  DB_PORT: Joi.number().integer().min(1).max(65535).default(3306),
  DB_USER: Joi.string().default('root'),
  DB_PASSWORD: Joi.string().allow('').default(''),
  DB_NAME: Joi.string().default('mseism'),
  
  // 外部设备数据源 API
  DEVICE_API_URL: Joi.string().uri().required(),
  
  // 数据同步配置
  SYNC_INTERVAL: Joi.number().integer().min(1000).default(5000),
  OFFLINE_THRESHOLD: Joi.number().integer().min(1).default(300),
  API_TIMEOUT: Joi.number().integer().min(1000).default(10000),
  
  // WebSocket 配置
  WS_PING_TIMEOUT: Joi.number().integer().min(1000).default(60000),
  WS_PING_INTERVAL: Joi.number().integer().min(1000).default(25000),
  
  // JWT 认证配置
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_TOKEN_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_TOKEN_EXPIRES_IN: Joi.string().default('7d'),
  JWT_ALGORITHM: Joi.string().default('HS256'),
  
  // 密码加密配置
  BCRYPT_ROUNDS: Joi.number().integer().min(8).max(16).default(12),
  
  // CORS 配置
  ALLOWED_ORIGINS: Joi.string().default('http://localhost:5173,http://localhost:3000'),
  
  // 初始管理员密码（仅在首次创建管理员时使用）
  INITIAL_ADMIN_PASSWORD: Joi.string().min(8).default('admin123'),

  // 初始超级管理员（root）密码（仅在首次创建 root 时使用）
  INITIAL_ROOT_PASSWORD: Joi.string().min(8).default('root123'),
  
  // 安全配置
  MAX_LOGIN_ATTEMPTS: Joi.number().integer().min(1).default(5),
  LOGIN_LOCKOUT_TIME: Joi.number().integer().min(1).default(30),
  
  // 性能监控配置
  ENABLE_PERFORMANCE_MONITORING: Joi.boolean().default(true),
  PERFORMANCE_ALERT_THRESHOLD: Joi.number().integer().min(100).default(1000),
  SYNC_ALERT_THRESHOLD: Joi.number().integer().min(100).default(5000),
  
  // 日志配置
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
  ENABLE_ACCESS_LOG: Joi.boolean().default(true),
  ENABLE_ERROR_LOG: Joi.boolean().default(true),
  ENABLE_OPERATION_LOG: Joi.boolean().default(true),
  
  // 速率限制配置
  API_RATE_LIMIT_WINDOW: Joi.number().integer().min(1000).default(60000),
  API_RATE_LIMIT_MAX: Joi.number().integer().min(1).default(100),
  SYNC_RATE_LIMIT_WINDOW: Joi.number().integer().min(1000).default(60000),
  SYNC_RATE_LIMIT_MAX: Joi.number().integer().min(1).default(10),
  
  // Redis 配置（用于分布式限流和缓存）
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().integer().min(1).max(65535).default(6379),
  REDIS_PASSWORD: Joi.string().allow('').default(''),
  REDIS_DB: Joi.number().integer().min(0).max(15).default(0),
  REDIS_ENABLED: Joi.boolean().default(false),
});

// 配置验证和加载
function loadConfig() {
  const { error, value: envConfig } = configSchema.validate(process.env, {
    allowUnknown: true,
    stripUnknown: true
  });
  
  if (error) {
    throw new Error(`配置验证失败: ${error.message}`);
  }
  
  return {
    // 服务器配置
    server: {
      port: envConfig.PORT,
      nodeEnv: envConfig.NODE_ENV,
      isProduction: envConfig.NODE_ENV === 'production',
      isDevelopment: envConfig.NODE_ENV === 'development',
    },
    
    // 数据库配置
    database: {
      host: envConfig.DB_HOST,
      port: envConfig.DB_PORT,
      user: envConfig.DB_USER,
      password: envConfig.DB_PASSWORD,
      database: envConfig.DB_NAME,
    },
    
    // 外部设备数据源 API
    deviceApi: {
      url: envConfig.DEVICE_API_URL,
      timeout: envConfig.API_TIMEOUT,
    },
    
    // 数据同步配置
    sync: {
      interval: envConfig.SYNC_INTERVAL,
      offlineThreshold: envConfig.OFFLINE_THRESHOLD,
    },
    
    // WebSocket 配置
    websocket: {
      pingTimeout: envConfig.WS_PING_TIMEOUT,
      pingInterval: envConfig.WS_PING_INTERVAL,
    },
    
    // JWT 认证配置
    jwt: {
      secret: envConfig.JWT_SECRET,
      accessTokenExpiresIn: envConfig.JWT_ACCESS_TOKEN_EXPIRES_IN,
      refreshTokenExpiresIn: envConfig.JWT_REFRESH_TOKEN_EXPIRES_IN,
      algorithm: envConfig.JWT_ALGORITHM,
    },
    
    // 密码加密配置
    security: {
      bcryptRounds: envConfig.BCRYPT_ROUNDS,
      initialAdminPassword: envConfig.INITIAL_ADMIN_PASSWORD,
      maxLoginAttempts: envConfig.MAX_LOGIN_ATTEMPTS,
      loginLockoutTime: envConfig.LOGIN_LOCKOUT_TIME,
    },
    
    // CORS 配置
    cors: {
      allowedOrigins: envConfig.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()),
    },
    
    // 性能监控配置
    performance: {
      enabled: envConfig.ENABLE_PERFORMANCE_MONITORING,
      alertThreshold: envConfig.PERFORMANCE_ALERT_THRESHOLD,
      syncAlertThreshold: envConfig.SYNC_ALERT_THRESHOLD,
    },
    
    // 日志配置
    logging: {
      level: envConfig.LOG_LEVEL,
      enableAccessLog: envConfig.ENABLE_ACCESS_LOG,
      enableErrorLog: envConfig.ENABLE_ERROR_LOG,
      enableOperationLog: envConfig.ENABLE_OPERATION_LOG,
    },
    
    // 速率限制配置
    rateLimit: {
      api: {
        windowMs: envConfig.API_RATE_LIMIT_WINDOW,
        max: envConfig.API_RATE_LIMIT_MAX,
      },
      sync: {
        windowMs: envConfig.SYNC_RATE_LIMIT_WINDOW,
        max: envConfig.SYNC_RATE_LIMIT_MAX,
      },
    },
    
    // Redis 配置
    redis: {
      host: envConfig.REDIS_HOST,
      port: envConfig.REDIS_PORT,
      password: envConfig.REDIS_PASSWORD,
      db: envConfig.REDIS_DB,
      enabled: envConfig.REDIS_ENABLED,
    },
  };
}

// 加载配置
let currentConfig = loadConfig();

// 配置变更回调
const configChangeListeners = [];

// 注册配置变更监听器
function onConfigChange(listener) {
  configChangeListeners.push(listener);
}

// 触发配置变更
function notifyConfigChange(oldConfig, newConfig) {
  configChangeListeners.forEach(listener => {
    try {
      listener(oldConfig, newConfig);
    } catch (error) {
      console.error('配置变更监听器执行失败:', error);
    }
  });
}

// 热更新配置
function reloadConfig() {
  console.log('正在重新加载配置...');
  
  try {
    const oldConfig = { ...currentConfig };
    
    // 重新加载环境变量
    require('dotenv').config({ path: path.join(__dirname, '.env'), override: true });
    
    // 重新加载配置
    const newConfig = loadConfig();
    
    currentConfig = newConfig;
    
    // 通知监听器
    notifyConfigChange(oldConfig, newConfig);
    
    console.log('配置重新加载成功');
    return { success: true, message: '配置重新加载成功' };
  } catch (error) {
    console.error('配置重新加载失败:', error);
    return { success: false, message: error.message };
  }
}

// 获取配置（只读）
function getConfig() {
  return { ...currentConfig };
}

// 获取特定配置项
function get(path) {
  return path.split('.').reduce((obj, key) => obj?.[key], currentConfig);
}

// 检查配置是否需要重启才能生效
function needsRestart(configPath) {
  const restartRequiredPaths = [
    'server.port',
    'server.nodeEnv',
    'database.host',
    'database.port',
    'database.user',
    'database.password',
    'database.database',
  ];
  return restartRequiredPaths.includes(configPath);
}

// 验证配置
function validateConfig(config) {
  try {
    const schema = Joi.object({
      server: Joi.object({
        port: Joi.number().integer().min(1).max(65535),
        nodeEnv: Joi.string().valid('development', 'production', 'test'),
      }),
      database: Joi.object({
        host: Joi.string(),
        port: Joi.number().integer().min(1).max(65535),
        user: Joi.string(),
        password: Joi.string(),
        database: Joi.string(),
      }),
      deviceApi: Joi.object({
        url: Joi.string().uri(),
        timeout: Joi.number().integer().min(1000),
      }),
      sync: Joi.object({
        interval: Joi.number().integer().min(1000),
        offlineThreshold: Joi.number().integer().min(1),
      }),
      jwt: Joi.object({
        secret: Joi.string().min(32),
        accessTokenExpiresIn: Joi.string(),
        refreshTokenExpiresIn: Joi.string(),
      }),
      // 添加其他配置的验证...
    });
    
    const { error } = schema.validate(config);
    if (error) {
      return { valid: false, message: error.message };
    }
    
    return { valid: true };
  } catch (error) {
    return { valid: false, message: error.message };
  }
}

// 导出配置对象（向后兼容）
module.exports = {
  ...currentConfig,
  
  // 配置管理方法
  getConfig,
  get,
  reloadConfig,
  onConfigChange,
  validateConfig,
  needsRestart,
  
  // 配置项（向后兼容）
  PORT: currentConfig.server.port,
  DEVICE_API_URL: currentConfig.deviceApi.url,
  SYNC_INTERVAL: currentConfig.sync.interval,
  OFFLINE_THRESHOLD: currentConfig.sync.offlineThreshold,
  API_TIMEOUT: currentConfig.deviceApi.timeout,
  JWT_SECRET: currentConfig.jwt.secret,
  JWT_ACCESS_TOKEN_EXPIRES_IN: currentConfig.jwt.accessTokenExpiresIn,
  JWT_REFRESH_TOKEN_EXPIRES_IN: currentConfig.jwt.refreshTokenExpiresIn,
  JWT_ALGORITHM: currentConfig.jwt.algorithm,
  BCRYPT_ROUNDS: currentConfig.security.bcryptRounds,
  INITIAL_ADMIN_PASSWORD: currentConfig.security.initialAdminPassword,
  ALLOWED_ORIGINS: currentConfig.cors.allowedOrigins,
  MAX_LOGIN_ATTEMPTS: currentConfig.security.maxLoginAttempts,
  LOGIN_LOCKOUT_TIME: currentConfig.security.loginLockoutTime,
  ENABLE_PERFORMANCE_MONITORING: currentConfig.performance.enabled,
  PERFORMANCE_ALERT_THRESHOLD: currentConfig.performance.alertThreshold,
  SYNC_ALERT_THRESHOLD: currentConfig.performance.syncAlertThreshold,
  LOG_LEVEL: currentConfig.logging.level,
  ENABLE_ACCESS_LOG: currentConfig.logging.enableAccessLog,
  ENABLE_ERROR_LOG: currentConfig.logging.enableErrorLog,
  ENABLE_OPERATION_LOG: currentConfig.logging.enableOperationLog,
  // MySQL 数据库配置（向后兼容）
  DB_HOST: currentConfig.database.host,
  DB_PORT: currentConfig.database.port,
  DB_USER: currentConfig.database.user,
  DB_PASSWORD: currentConfig.database.password,
  DB_NAME: currentConfig.database.database,
};
