/**
 * 安全工具模块
 * 提供密码哈希、输入验证等安全功能
 */

const bcrypt = require('bcryptjs');
const crypto = require('crypto');

class SecurityUtils {
  /**
   * 哈希密码
   * @param {string} password 原始密码
   * @returns {Promise<string>} 哈希后的密码
   */
  static async hashPassword(password) {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
  }

  /**
   * 验证密码
   * @param {string} password 原始密码
   * @param {string} hash 哈希后的密码
   * @returns {Promise<boolean>} 是否匹配
   */
  static async verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
  }

  /**
   * 生成CSRF token
   * @returns {string} CSRF token
   */
  static generateCsrfToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * 验证输入是否安全
   * @param {string} input 输入
   * @returns {boolean} 是否安全
   */
  static isInputSafe(input) {
    if (typeof input !== 'string') {
      return true;
    }
    // 检查是否包含危险字符
    const dangerousPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /<iframe[^>]*>.*?<\/iframe>/gi,
      /on\w+\s*=\s*["']?[^"']*["']?/gi
    ];
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(input)) {
        return false;
      }
    }
    return true;
  }

  /**
   * 清理输入
   * @param {string} input 输入
   * @returns {string} 清理后的输入
   */
  static sanitizeInput(input) {
    if (typeof input !== 'string') {
      return input;
    }
    // 转义HTML特殊字符
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

module.exports = SecurityUtils;
