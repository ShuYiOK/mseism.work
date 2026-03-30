/**
 * 认证和授权系统
 * 包含用户认证、JWT token管理、权限控制
 */
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const config = require('./config');

// 配置
const CONFIG = {
  // JWT密钥（生产环境应该从环境变量读取）
  JWT_SECRET: config.JWT_SECRET,
  // Token有效期（访问token）
  JWT_ACCESS_TOKEN_EXPIRES_IN: config.JWT_ACCESS_TOKEN_EXPIRES_IN,
  // Token有效期（刷新token）
  JWT_REFRESH_TOKEN_EXPIRES_IN: config.JWT_REFRESH_TOKEN_EXPIRES_IN,
  // Token算法
  JWT_ALGORITHM: config.JWT_ALGORITHM,
  // 密码加密轮次
  BCRYPT_ROUNDS: config.BCRYPT_ROUNDS,
  // Token刷新阈值（7天内有效）
  REFRESH_THRESHOLD: 7 * 24 * 60 * 60 * 1000,
  // 最大登录尝试次数
  MAX_LOGIN_ATTEMPTS: config.MAX_LOGIN_ATTEMPTS,
  // 登录锁定时间（分钟）
  LOGIN_LOCKOUT_TIME: config.LOGIN_LOCKOUT_TIME
};

// 用户角色
const Role = {
  ADMIN: 'admin',
  USER: 'user',
  VIEWER: 'viewer'
};

// 权限列表
const Permission = {
  // 设备相关
  DEVICE_READ: 'device:read',
  DEVICE_WRITE: 'device:write',
  DEVICE_DELETE: 'device:delete',
  
  // 分组相关
  GROUP_READ: 'group:read',
  GROUP_WRITE: 'group:write',
  GROUP_DELETE: 'group:delete',
  
  // 系统相关
  SYSTEM_MANAGE: 'system:manage',
  SYSTEM_MONITOR: 'system:monitor',
  USER_MANAGE: 'user:manage'
};

// 角色权限映射
const RolePermissions = {
  [Role.ADMIN]: [
    Permission.DEVICE_READ,
    Permission.DEVICE_WRITE,
    Permission.DEVICE_DELETE,
    Permission.GROUP_READ,
    Permission.GROUP_WRITE,
    Permission.GROUP_DELETE,
    Permission.SYSTEM_MANAGE,
    Permission.SYSTEM_MONITOR,
    Permission.USER_MANAGE
  ],
  [Role.USER]: [
    Permission.DEVICE_READ,
    Permission.GROUP_READ,
    Permission.GROUP_WRITE
  ],
  [Role.VIEWER]: [
    Permission.DEVICE_READ,
    Permission.GROUP_READ,
    Permission.SYSTEM_MONITOR
  ]
};

// 数据库连接
let db;
let query;

// 初始化数据库连接
async function initDatabaseConnection() {
  const mysql = require('mysql2/promise');
  db = mysql.createPool({
    host: config.database.host,
    port: config.database.port,
    user: config.database.user,
    password: config.database.password,
    database: config.database.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
  
  // 测试连接
  const connection = await db.getConnection();
  connection.release();
  
  // MySQL 查询方法
  query = async (sql, params = []) => {
    const [rows] = await db.execute(sql, params);
    return rows;
  };
}

// 初始化用户表
async function initUserDatabase() {
  // 确保数据库连接已初始化
  if (!db) {
    await initDatabaseConnection();
  }
  
  // 创建用户表
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE,
        role VARCHAR(20) DEFAULT 'user',
        permissions TEXT,
        is_active TINYINT(1) DEFAULT 1,
        email_verified TINYINT(1) DEFAULT 0,
        last_login INT,
        failed_login_attempts INT DEFAULT 0,
        locked_until INT,
        created_at INT DEFAULT 0,
        updated_at INT DEFAULT 0
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 创建刷新token表
    await query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        token VARCHAR(255) NOT NULL,
        expires_at INT NOT NULL,
        created_at INT DEFAULT 0,
        revoked TINYINT(1) DEFAULT 0,
        revoked_at INT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, token)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 创建登录审计表
    await query(`
      CREATE TABLE IF NOT EXISTS login_audit (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36),
        username VARCHAR(255),
        ip VARCHAR(255),
        user_agent TEXT,
        success TINYINT(1) DEFAULT 0,
        failure_reason TEXT,
        created_at INT DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 创建索引
    try {
      await query(`CREATE INDEX idx_users_username ON users(username)`);
      await query(`CREATE INDEX idx_users_email ON users(email)`);
      await query(`CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id)`);
      await query(`CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token)`);
      await query(`CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at)`);
      await query(`CREATE INDEX idx_login_audit_user_id ON login_audit(user_id)`);
      await query(`CREATE INDEX idx_login_audit_created ON login_audit(created_at)`);
    } catch (error) {
      // 忽略索引创建失败（索引可能已存在）
      console.warn('[警告] 无法创建索引:', error.message);
    }

    // 创建默认管理员账户（如果不存在）
    await createDefaultAdmin();

    console.log('[认证系统] 用户数据库初始化完成');
  } catch (error) {
    console.error('[认证系统] 数据库初始化失败:', error.message);
    throw error;
  }
}

// 创建默认管理员
async function createDefaultAdmin() {
  const users = await query('SELECT id FROM users WHERE username = ?', ['admin']);
  const adminExists = users.length > 0;
  
  if (!adminExists) {
    const adminId = crypto.randomUUID();
    const passwordHash = bcrypt.hashSync('admin123', CONFIG.BCRYPT_ROUNDS);
    
    await query(`
      INSERT INTO users (id, username, password_hash, email, role, permissions, is_active, email_verified)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      adminId,
      'admin',
      passwordHash,
      'admin@localhost',
      Role.ADMIN,
      JSON.stringify(RolePermissions[Role.ADMIN]),
      1,
      1
    ]);
    
    console.log('[认证系统] 默认管理员账户已创建');
    console.log('[认证系统] 用户名: admin');
    console.log('[认证系统] 密码: admin123');
    console.log('[认证系统] ⚠️  请立即修改默认密码！');
  }
}

// 用户认证
async function register(username, email, password, role = Role.USER) {
  // 验证输入
  if (!username || !email || !password) {
    throw new Error('用户名、邮箱和密码不能为空');
  }

  // 验证用户名格式
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  if (!usernameRegex.test(username)) {
    throw new Error('用户名只能包含字母、数字和下划线，长度3-20位');
  }

  // 验证邮箱格式
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('邮箱格式不正确');
  }

  // 验证密码强度
  if (password.length < 8) {
    throw new Error('密码长度至少8位');
  }

  // 检查用户名是否已存在
  const existingUsers = await query('SELECT id FROM users WHERE username = ?', [username]);
  if (existingUsers.length > 0) {
    throw new Error('用户名已存在');
  }

  // 检查邮箱是否已存在
  const existingEmails = await query('SELECT id FROM users WHERE email = ?', [email]);
  if (existingEmails.length > 0) {
    throw new Error('邮箱已被使用');
  }

  // 验证角色
  if (!Object.values(Role).includes(role)) {
    throw new Error('无效的用户角色');
  }

  // 加密密码
  const passwordHash = bcrypt.hashSync(password, CONFIG.BCRYPT_ROUNDS);
  const userId = crypto.randomUUID();

  // 创建用户
  await query(`
    INSERT INTO users (id, username, password_hash, email, role, permissions, is_active, email_verified)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    userId,
    username,
    passwordHash,
    email,
    role,
    JSON.stringify(RolePermissions[role] || []),
    1,
    0
  ]);

  // 记录注册日志
  await logAudit(userId, username, 'user_register', true);

  return {
    id: userId,
    username,
    email,
    role
  };
}

// 用户登录
async function login(username, password, ip, userAgent) {
  // 验证输入
  if (!username || !password) {
    throw new Error('用户名和密码不能为空');
  }

  // 查找用户
  const users = await query('SELECT * FROM users WHERE username = ?', [username]);
  const user = users[0];
  if (!user) {
    await logAudit(null, username, 'user_login', false, ip, userAgent, '用户不存在');
    throw new Error('用户名或密码错误');
  }

  // 检查账户是否被锁定
  if (user.locked_until && user.locked_until > Date.now() / 1000) {
    const lockedTime = new Date(user.locked_until * 1000);
    throw new Error(`账户已被锁定，请在 ${lockedTime.toLocaleString()} 后再试`);
  }

  // 检查账户是否激活
  if (!user.is_active) {
    await logAudit(user.id, username, 'user_login', false, ip, userAgent, '账户未激活');
    throw new Error('账户未激活，请联系管理员');
  }

  // 验证密码
  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    // 增加失败次数
    const failedAttempts = (user.failed_login_attempts || 0) + 1;
    const lockedUntil = failedAttempts >= 5 ? Math.floor(Date.now() / 1000) + 1800 : null; // 5次失败锁定30分钟

    await query(`
      UPDATE users SET
        failed_login_attempts = ?,
        locked_until = ?,
        updated_at = ?
      WHERE id = ?
    `, [failedAttempts, lockedUntil, Math.floor(Date.now() / 1000), user.id]);

    await logAudit(user.id, username, 'user_login', false, ip, userAgent, '密码错误');

    if (lockedUntil) {
      throw new Error('密码错误次数过多，账户已被锁定30分钟');
    }

    throw new Error('用户名或密码错误');
  }

  // 重置失败次数
  await query(`
    UPDATE users SET
      failed_login_attempts = 0,
      locked_until = NULL,
      last_login = ?,
      updated_at = ?
    WHERE id = ?
  `, [Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000), user.id]);

  // 生成JWT tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = await generateRefreshToken(user.id);

  // 记录成功登录
  await logAudit(user.id, username, 'user_login', true, ip, userAgent);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      permissions: JSON.parse(user.permissions || '[]')
    }
  };
}

// 生成访问token
function generateAccessToken(user) {
  try {
    if (process.env.NODE_ENV === 'development') {
      console.log('Generating access token for user:', user.username);
    }
    
    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        role: user.role,
        permissions: JSON.parse(user.permissions || '[]')
      },
      CONFIG.JWT_SECRET,
      {
        expiresIn: CONFIG.JWT_ACCESS_TOKEN_EXPIRES_IN
      }
    );
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Token generated successfully');
    }
    return token;
  } catch (error) {
    console.error('Error generating access token:', error);
    throw error;
  }
}

// 生成刷新token
async function generateRefreshToken(userId) {
  const token = crypto.randomUUID();
  const expiresAt = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60); // 7天后

  await query(`
    INSERT INTO refresh_tokens (id, user_id, token, expires_at)
    VALUES (?, ?, ?, ?)
  `, [crypto.randomUUID(), userId, token, expiresAt]);

  return token;
}

// 验证访问token
function verifyAccessToken(token) {
  try {
    return jwt.verify(token, CONFIG.JWT_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('访问token已过期');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('无效的访问token');
    }
    throw new Error('token验证失败');
  }
}

// 验证刷新token
async function verifyRefreshToken(token) {
  try {
    // 检查token是否存在于数据库中
    const refreshTokens = await query(`
      SELECT * FROM refresh_tokens 
      WHERE token = ? AND revoked = 0 AND expires_at > ?
    `, [token, Math.floor(Date.now() / 1000)]);

    const refreshToken = refreshTokens[0];
    if (!refreshToken) {
      throw new Error('无效的刷新token');
    }

    return refreshToken;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('刷新token已过期');
    }
    throw error;
  }
}

// 刷新访问token
async function refreshAccessToken(refreshToken) {
  const tokenData = await verifyRefreshToken(refreshToken);
  
  // 获取用户信息
  const users = await query('SELECT * FROM users WHERE id = ?', [tokenData.user_id]);
  const user = users[0];
  if (!user) {
    throw new Error('用户不存在');
  }

  // 生成新的访问token
  const accessToken = generateAccessToken(user);

  // 记录token刷新
  logAudit(user.id, user.username, 'token_refresh', true);

  return {
    accessToken,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      permissions: JSON.parse(user.permissions || '[]')
    }
  };
}

// 登出
async function logout(refreshToken) {
  const tokenData = await verifyRefreshToken(refreshToken);
  
  // 撤销刷新token
  await query(`
    UPDATE refresh_tokens SET
      revoked = 1,
      revoked_at = ?
    WHERE token = ?
  `, [Math.floor(Date.now() / 1000), refreshToken]);

  // 记录登出日志
  const users = await query('SELECT * FROM users WHERE id = ?', [tokenData.user_id]);
  const user = users[0];
  if (user) {
    await logAudit(user.id, user.username, 'user_logout', true);
  }

  return { success: true };
}

// 撤销所有token
async function revokeAllTokens(userId) {
  await query(`
    UPDATE refresh_tokens SET
      revoked = 1,
      revoked_at = ?
    WHERE user_id = ?
  `, [Math.floor(Date.now() / 1000), userId]);

  return { success: true };
}

// 检查权限
function hasPermission(user, permission) {
  if (!user || !user.permissions) {
    return false;
  }

  // 管理员拥有所有权限
  if (user.role === Role.ADMIN) {
    return true;
  }

  return user.permissions.includes(permission);
}

// 检查角色
function hasRole(user, role) {
  if (!user) {
    return false;
  }

  return user.role === role;
}

// 修改密码
async function changePassword(userId, oldPassword, newPassword, ip, userAgent) {
  if (!userId || !oldPassword || !newPassword) {
    throw new Error('用户ID、旧密码和新密码不能为空');
  }

  // 验证新密码强度
  if (newPassword.length < 8) {
    throw new Error('新密码长度至少8位');
  }

  // 获取用户信息
  const users = await query('SELECT * FROM users WHERE id = ?', [userId]);
  const user = users[0];
  if (!user) {
    throw new Error('用户不存在');
  }

  // 验证旧密码
  const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password_hash);
  if (!isOldPasswordValid) {
    await logAudit(userId, user.username, 'password_change', false, ip, userAgent, '旧密码错误');
    throw new Error('旧密码不正确');
  }

  // 加密新密码
  const newPasswordHash = bcrypt.hashSync(newPassword, CONFIG.BCRYPT_ROUNDS);

  // 更新密码
  await query(`
    UPDATE users SET
      password_hash = ?,
      updated_at = ?
    WHERE id = ?
  `, [newPasswordHash, Math.floor(Date.now() / 1000), userId]);

  // 撤销所有token（强制重新登录）
  await revokeAllTokens(userId);

  // 记录密码修改日志
  await logAudit(userId, user.username, 'password_change', true, ip, userAgent);

  return { success: true };
}

// 重置密码（管理员操作）
async function resetPassword(userId, newPassword) {
  if (!userId || !newPassword) {
    throw new Error('用户ID和新密码不能为空');
  }

  // 验证新密码强度
  if (newPassword.length < 8) {
    throw new Error('新密码长度至少8位');
  }

  // 获取用户信息
  const users = await query('SELECT * FROM users WHERE id = ?', [userId]);
  const user = users[0];
  if (!user) {
    throw new Error('用户不存在');
  }

  // 加密新密码
  const newPasswordHash = bcrypt.hashSync(newPassword, CONFIG.BCRYPT_ROUNDS);

  // 更新密码
  await query(`
    UPDATE users SET
      password_hash = ?,
      failed_login_attempts = 0,
      locked_until = NULL,
      updated_at = ?
    WHERE id = ?
  `, [newPasswordHash, Math.floor(Date.now() / 1000), userId]);

  // 撤销所有token
  await revokeAllTokens(userId);

  // 记录密码重置日志
  await logAudit(userId, user.username, 'password_reset', true);

  return { success: true };
}

// 获取用户信息
async function getUserById(userId) {
  const users = await query('SELECT * FROM users WHERE id = ?', [userId]);
  const user = users[0];
  if (!user) {
    return null;
  }

  // 不返回密码哈希
  const { password_hash, ...userInfo } = user;
  return {
    ...userInfo,
    permissions: JSON.parse(userInfo.permissions || '[]')
  };
}

// 获取所有用户（仅管理员）
async function getAllUsers() {
  const users = await query('SELECT id, username, email, role, permissions, is_active, email_verified, last_login, created_at, updated_at FROM users');

  return users.map(user => ({
    ...user,
    permissions: JSON.parse(user.permissions || '[]')
  }));
}

// 更新用户信息
async function updateUser(userId, updates) {
  const allowedFields = ['username', 'email', 'role', 'permissions', 'is_active', 'email_verified'];
  const updatesList = [];
  const updatesValues = [];

  allowedFields.forEach(field => {
    if (updates[field] !== undefined) {
      updatesList.push(`${field} = ?`);
      updatesValues.push(
        field === 'permissions' ? JSON.stringify(updates[field]) : updates[field]
      );
    }
  });

  if (updatesList.length === 0) {
    throw new Error('没有需要更新的字段');
  }

  updatesList.push('updated_at = ?');
  updatesValues.push(Math.floor(Date.now() / 1000));

  const sql = `
    UPDATE users SET
      ${updatesList.join(', ')}
    WHERE id = ?
  `;

  await query(sql, [...updatesValues, userId]);

  return await getUserById(userId);
}

// 删除用户
async function deleteUser(userId) {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error('用户不存在');
  }

  // 不能删除最后一个管理员
  const adminCounts = await query('SELECT COUNT(*) as count FROM users WHERE role = ?', [Role.ADMIN]);
  const adminCount = adminCounts[0].count;
  if (adminCount === 1 && user.role === Role.ADMIN) {
    throw new Error('不能删除最后一个管理员账户');
  }

  await query('DELETE FROM users WHERE id = ?', [userId]);

  // 记录删除日志
  await logAudit(userId, user.username, 'user_delete', true);

  return { success: true };
}

// 记录审计日志
async function logAudit(userId, username, action, success, ip = '', userAgent = '', failureReason = '') {
  await query(`
    INSERT INTO login_audit (id, user_id, username, ip, user_agent, success, failure_reason, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    crypto.randomUUID(),
    userId,
    username,
    ip,
    userAgent,
    success ? 1 : 0,
    failureReason,
    Math.floor(Date.now() / 1000)
  ]);
}

// 获取审计日志
async function getAuditLogs(limit = 100, userId = null) {
  let sql = 'SELECT * FROM login_audit';
  const params = [];

  if (userId) {
    sql += ' WHERE user_id = ?';
    params.push(userId);
  }

  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  return await query(sql, params);
}

// 清理过期的refresh token
async function cleanupExpiredTokens() {
  const result = await query(`
    DELETE FROM refresh_tokens
    WHERE expires_at < ? OR revoked = 1
  `, [Math.floor(Date.now() / 1000)]);

  console.log(`[认证系统] 已清理 ${result.affectedRows || 0} 个过期或撤销的token`);
}

// 定期清理过期的token
setInterval(cleanupExpiredTokens, 24 * 60 * 60 * 1000); // 每天

module.exports = {
  initUserDatabase,
  // 认证相关
  register,
  login,
  logout,
  refreshAccessToken,
  verifyAccessToken,
  verifyRefreshToken,
  revokeAllTokens,
  // 用户管理
  changePassword,
  resetPassword,
  getUserById,
  getAllUsers,
  updateUser,
  deleteUser,
  // 权限相关
  Role,
  Permission,
  RolePermissions,
  hasPermission,
  hasRole,
  // 审计日志
  getAuditLogs,
  cleanupExpiredTokens
};
