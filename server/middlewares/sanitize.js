/**
 * XSS 防护中间件
 * 使用 xss 库提供全面的 XSS 防护
 */

const xss = require('xss');

const DEFAULT_OPTIONS = {
  whiteList: {
    a: ['href', 'title', 'target'],
    img: ['src', 'alt', 'width', 'height'],
    p: ['class'],
    span: ['class'],
    div: ['class'],
    ul: ['class'],
    ol: ['class'],
    li: ['class'],
    br: [],
    strong: [],
    em: [],
    b: [],
    i: [],
    u: [],
    code: ['class'],
    pre: ['class']
  },
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style', 'textarea', 'pre', 'iframe']
};

const OPTIONS_HTML = {
  ...DEFAULT_OPTIONS
};

const OPTIONS_ATTR = {
  ...DEFAULT_OPTIONS,
  whiteList: {}
};

const sanitizer = {
  sanitize(obj, options = DEFAULT_OPTIONS) {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return xss(obj, options);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitize(item, options));
    }

    if (typeof obj === 'object') {
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
          result[key] = xss(value, options);
        } else if (typeof value === 'object' && value !== null) {
          result[key] = this.sanitize(value, options);
        } else {
          result[key] = value;
        }
      }
      return result;
    }

    return obj;
  },

  sanitizeHtml(html, options = OPTIONS_HTML) {
    return xss(html, options);
  },

  sanitizeAttribute(value) {
    return xss.escapeAttrValue(value);
  },

  stripAllTags(input) {
    if (typeof input !== 'string') return input;
    return input.replace(/<[^>]*>/g, '');
  },

  isSafeInput(input) {
    if (typeof input !== 'string') return true;

    const dangerousPatterns = [
      /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
      /<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi,
      /<object[\s\S]*?>[\s\S]*?<\/object>/gi,
      /<embed[\s\S]*?>/gi,
      /on\w+\s*=\s*["'][^"']*["']/gi,
      /javascript\s*:/gi,
      /data\s*:\s*text\/html/gi,
      /<svg[\s\S]*?>[\s\S]*?<\/svg>/gi,
      /<math[\s\S]*?>[\s\S]*?<\/math>/gi,
      /<portal[\s\S]*?>[\s\S]*?<\/portal>/gi
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(input)) {
        return false;
      }
    }

    return true;
  }
}

function sanitizeMiddleware(options = DEFAULT_OPTIONS) {
  return (req, res, next) => {
    if (req.body && typeof req.body === 'object') {
      const sanitized = sanitizer.sanitize(req.body, options);

      for (const key of Object.keys(req.body)) {
        req.body[key] = sanitized[key];
      }
    }

    if (req.query && typeof req.query === 'object') {
      const sanitized = sanitizer.sanitize(req.query, options);

      for (const key of Object.keys(req.query)) {
        req.query[key] = sanitized[key];
      }
    }

    if (req.params && typeof req.params === 'object') {
      const sanitized = sanitizer.sanitize(req.params, options);

      for (const key of Object.keys(req.params)) {
        req.params[key] = sanitized[key];
      }
    }

    next();
  };
}

function validateAndSanitize(req, res, next) {
  const errors = [];

  if (req.body && typeof req.body === 'object') {
    for (const [key, value] of Object.entries(req.body)) {
      if (typeof value === 'string') {
        if (!sanitizer.isSafeInput(value)) {
          errors.push({
            field: key,
            error: '输入包含潜在的安全内容',
            value: value.substring(0, 50) + (value.length > 50 ? '...' : '')
          });
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INPUT_VALIDATION_ERROR',
          message: '输入验证失败',
          details: errors
        }
      });
    }

    const sanitized = sanitizer.sanitize(req.body);
    for (const key of Object.keys(req.body)) {
      req.body[key] = sanitized[key];
    }
  }

  next();
}

module.exports = {
  sanitizer,
  sanitizeMiddleware,
  validateAndSanitize,
  DEFAULT_OPTIONS,
  OPTIONS_HTML,
  OPTIONS_ATTR
};
