/**
 * 安全性架构模块
 * 提供认证、授权、加密和审计功能
 */

const crypto = require('crypto');

class SecurityManager {
  constructor() {
    this.algorithms = {
      hash: 'sha256',
      hmac: 'sha256',
      cipher: 'aes-256-gcm'
    };
  }

  hash(data) {
    return crypto.createHash(this.algorithms.hash)
      .update(data)
      .digest('hex');
  }

  hmac(data, secret) {
    return crypto.createHmac(this.algorithms.hmac, secret)
      .update(data)
      .digest('hex');
  }

  encrypt(data, key) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithms.cipher, Buffer.from(key, 'hex'), iv);

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      iv: iv.toString('hex'),
      data: encrypted,
      authTag: authTag.toString('hex')
    };
  }

  decrypt(encryptedData, key, iv, authTag) {
    const decipher = crypto.createDecipheriv(
      this.algorithms.cipher,
      Buffer.from(key, 'hex'),
      Buffer.from(iv, 'hex')
    );

    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  generateApiKey(prefix = 'sk') {
    const key = crypto.randomBytes(32).toString('hex');
    return `${prefix}_${key}`;
  }
}

class RateLimiter {
  constructor() {
    this.requests = new Map();
    this.blocked = new Map();
  }

  check(identifier, options = {}) {
    const {
      maxRequests = 100,
      windowMs = 60000,
      blockDuration = 300000
    } = options;

    if (this.isBlocked(identifier)) {
      return {
        allowed: false,
        reason: 'blocked',
        retryAfter: this.getBlockedTime(identifier)
      };
    }

    const now = Date.now();
    const key = `rate:${identifier}`;
    const record = this.requests.get(key);

    if (!record || now - record.windowStart > windowMs) {
      this.requests.set(key, {
        count: 1,
        windowStart: now
      });

      return {
        allowed: true,
        remaining: maxRequests - 1,
        reset: Math.ceil((record?.windowStart || now) + windowMs / 1000)
      };
    }

    record.count++;

    if (record.count > maxRequests) {
      this.blocked.set(identifier, {
        until: now + blockDuration
      });

      return {
        allowed: false,
        reason: 'rate_limit',
        retryAfter: Math.ceil(blockDuration / 1000)
      };
    }

    return {
      allowed: true,
      remaining: maxRequests - record.count,
      reset: Math.ceil(record.windowStart + windowMs / 1000)
    };
  }

  isBlocked(identifier) {
    const block = this.blocked.get(identifier);
    if (!block) return false;

    if (Date.now() > block.until) {
      this.blocked.delete(identifier);
      return false;
    }

    return true;
  }

  getBlockedTime(identifier) {
    const block = this.blocked.get(identifier);
    if (!block) return 0;

    return Math.ceil((block.until - Date.now()) / 1000);
  }

  cleanup() {
    const now = Date.now();
    const maxAge = 3600000;

    for (const [key, record] of this.requests.entries()) {
      if (now - record.windowStart > maxAge) {
        this.requests.delete(key);
      }
    }
  }
}

class AuditLogger {
  constructor() {
    this.logs = [];
    this.maxLogs = 10000;
  }

  log(action, details = {}) {
    const entry = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      action,
      userId: details.userId || null,
      ip: details.ip || null,
      userAgent: details.userAgent || null,
      resource: details.resource || null,
      method: details.method || null,
      status: details.status || null,
      error: details.error || null,
      metadata: details.metadata || {}
    };

    this.logs.push(entry);

    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    console.log(`[审计] ${entry.timestamp} ${action}:`, {
      userId: entry.userId,
      resource: entry.resource,
      status: entry.status
    });

    return entry;
  }

  query(options = {}) {
    let results = [...this.logs];

    if (options.userId) {
      results = results.filter(l => l.userId === options.userId);
    }

    if (options.action) {
      results = results.filter(l => l.action === options.action);
    }

    if (options.resource) {
      results = results.filter(l => l.resource === options.resource);
    }

    if (options.startDate) {
      results = results.filter(l => new Date(l.timestamp) >= new Date(options.startDate));
    }

    if (options.endDate) {
      results = results.filter(l => new Date(l.timestamp) <= new Date(options.endDate));
    }

    if (options.limit) {
      results = results.slice(0, options.limit);
    }

    if (options.offset) {
      results = results.slice(options.offset);
    }

    return results;
  }

  getStats() {
    const actions = {};
    const statusCounts = { success: 0, failure: 0 };

    for (const log of this.logs) {
      actions[log.action] = (actions[log.action] || 0) + 1;

      if (log.status === 'success' || log.status === 200) {
        statusCounts.success++;
      } else {
        statusCounts.failure++;
      }
    }

    return {
      total: this.logs.length,
      actions,
      statusCounts
    };
  }

  generateId() {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  export(format = 'json') {
    if (format === 'json') {
      return JSON.stringify(this.logs, null, 2);
    }

    if (format === 'csv') {
      const headers = ['id', 'timestamp', 'action', 'userId', 'ip', 'resource', 'status'];
      const rows = this.logs.map(log =>
        headers.map(h => log[h] || '').join(',')
      );
      return [headers.join(','), ...rows].join('\n');
    }

    return this.logs;
  }
}

class InputValidator {
  static sanitize(str) {
    if (typeof str !== 'string') return str;

    return str
      .replace(/[<>]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+=/gi, '')
      .trim();
  }

  static validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  static validateIpAddress(ip) {
    const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Pattern = /^([0-9a-f]{0,4}:){2}[0-9a-f]{0,4}$/i;

    if (ipv4Pattern.test(ip)) {
      const parts = ip.split('.');
      return parts.every(part => parseInt(part) <= 255);
    }

    return ipv6Pattern.test(ip);
  }

  static validateMacAddress(mac) {
    const pattern = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    return pattern.test(mac);
  }

  static validateJson(str) {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  }

  static escapeHtml(str) {
    if (typeof str !== 'string') return str;

    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;'
    };

    return str.replace(/[&<>"'/]/g, char => map[char]);
  }
}

const securityManager = new SecurityManager();
const rateLimiter = new RateLimiter();
const auditLogger = new AuditLogger();

setInterval(() => rateLimiter.cleanup(), 60000);

module.exports = {
  SecurityManager,
  RateLimiter,
  AuditLogger,
  InputValidator,
  securityManager,
  rateLimiter,
  auditLogger
};
