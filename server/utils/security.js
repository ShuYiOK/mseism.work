/**
 * 安全工具模块
 * 提供密码哈希、CSRF保护等安全功能
 */

const bcrypt = require('bcrypt');
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
   * 验证CSRF token
   * @param {string} token CSRF token
   * @param {string} storedToken 存储的CSRF token
   * @returns {boolean} 是否有效
   */
  static verifyCsrfToken(token, storedToken) {
    return token === storedToken;
  }

  /**
   * 生成随机字符串
   * @param {number} length 长度
   * @returns {string} 随机字符串
   */
  static generateRandomString(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * 加密数据
   * @param {string} data 数据
   * @param {string} secret 密钥
   * @returns {string} 加密后的数据
   */
  static encrypt(data, secret) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(secret), iv);
    let encrypted = cipher.update(data);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  }

  /**
   * 解密数据
   * @param {string} encryptedData 加密后的数据
   * @param {string} secret 密钥
   * @returns {string} 解密后的数据
   */
  static decrypt(encryptedData, secret) {
    const textParts = encryptedData.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(secret), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
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
