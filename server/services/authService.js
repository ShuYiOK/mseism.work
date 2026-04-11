/**
 * 认证服务
 * 处理用户认证相关的业务逻辑
 */

const jwt = require('jsonwebtoken');
const config = require('../config');
const SecurityUtils = require('../utils/security');

// 模拟用户数据（实际项目中应该从数据库获取）
const users = [
  {
    id: '1',
    username: 'admin',
    password: '$2b$10$QJ1J2X4X5X6X7X8X9X0X1X2X3X4X5X6X7X8X9X0X1X2X3X4X5', // 临时密码，后续会更新
    role: 'admin'
  }
];

// 初始化管理员密码
async function initAdminPassword() {
  const hashedPassword = await SecurityUtils.hashPassword('admin123');
  users[0].password = hashedPassword;
  console.log('管理员密码已初始化');
}

// 初始化管理员密码
initAdminPassword();

/**
 * 用户登录
 * @param {string} username 用户名
 * @param {string} password 密码
 * @returns {Promise<Object>} 登录结果
 */
async function login(username, password) {
  const user = users.find(u => u.username === username);
  if (!user) {
    throw new Error('用户名或密码错误');
  }

  const isPasswordValid = await SecurityUtils.verifyPassword(password, user.password);
  if (!isPasswordValid) {
    throw new Error('用户名或密码错误');
  }

  // 生成 JWT token
  const accessToken = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.accessTokenExpiresIn }
  );

  const refreshToken = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.refreshTokenExpiresIn }
  );

  return {
    success: true,
    data: {
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      },
      tokens: {
        access_token: accessToken,
        refresh_token: refreshToken
      }
    }
  };
}

/**
 * 验证 token
 * @param {string} token JWT token
 * @returns {Promise<Object>} 验证结果
 */
async function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    return {
      success: true,
      data: decoded
    };
  } catch (error) {
    throw new Error('无效的 token');
  }
}

/**
 * 刷新 token
 * @param {string} refreshToken 刷新 token
 * @returns {Promise<Object>} 刷新结果
 */
async function refreshToken(refreshToken) {
  try {
    const decoded = jwt.verify(refreshToken, config.jwt.secret);
    
    // 生成新的 access token
    const accessToken = jwt.sign(
      { id: decoded.id, username: decoded.username, role: decoded.role },
      config.jwt.secret,
      { expiresIn: config.jwt.accessTokenExpiresIn }
    );

    return {
      success: true,
      data: {
        tokens: {
          access_token: accessToken,
          refresh_token: refreshToken
        }
      }
    };
  } catch (error) {
    throw new Error('无效的 refresh token');
  }
}

/**
 * 获取用户信息
 * @param {string} userId 用户 ID
 * @returns {Promise<Object>} 用户信息
 */
async function getUserById(userId) {
  const user = users.find(u => u.id === userId);
  if (!user) {
    throw new Error('用户不存在');
  }

  return {
    id: user.id,
    username: user.username,
    role: user.role
  };
}

module.exports = {
  login,
  verifyToken,
  refreshToken,
  getUserById
};
