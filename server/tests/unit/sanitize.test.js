/**
 * XSS 防护单元测试
 */

const { sanitizer, sanitizeMiddleware, validateAndSanitize } = require('../../middlewares/sanitize');

describe('XSS Sanitizer', () => {
  describe('sanitizer.isSafeInput()', () => {
    test('should reject script tags', () => {
      expect(sanitizer.isSafeInput('<script>alert(1)</script>')).toBe(false);
    });

    test('should reject javascript protocol', () => {
      expect(sanitizer.isSafeInput('javascript:alert(1)')).toBe(false);
    });

    test('should reject iframe tags', () => {
      expect(sanitizer.isSafeInput('<iframe src="evil.com"></iframe>')).toBe(false);
    });

    test('should reject on* event handlers in HTML context', () => {
      expect(sanitizer.isSafeInput('<img onerror="alert(1)">')).toBe(false);
      expect(sanitizer.isSafeInput('<div onmouseover="alert(1)">')).toBe(false);
    });

    test('should accept safe input', () => {
      expect(sanitizer.isSafeInput('Hello World')).toBe(true);
      expect(sanitizer.isSafeInput('<p>Safe paragraph</p>')).toBe(true);
    });
  });

  describe('sanitizer.sanitize()', () => {
    test('should sanitize simple XSS attack', () => {
      const input = '<script>alert("XSS")</script>';
      const result = sanitizer.sanitize(input);
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert');
    });

    test('should sanitize javascript: protocol', () => {
      const input = '<a href="javascript:alert(1)">click</a>';
      const result = sanitizer.sanitize(input);
      expect(result).not.toContain('javascript:');
    });

    test('should sanitize event handlers', () => {
      const input = '<img src=x onerror="alert(1)">';
      const result = sanitizer.sanitize(input);
      expect(result).not.toContain('onerror');
    });

    test('should handle nested objects', () => {
      const input = {
        name: '<script>alert(1)</script>',
        profile: {
          bio: '<iframe src="evil.com"></iframe>'
        }
      };
      const result = sanitizer.sanitize(input);
      expect(result.name).not.toContain('<script>');
      expect(result.profile.bio).not.toContain('<iframe>');
    });

    test('should handle arrays', () => {
      const input = [
        '<script>alert(1)</script>',
        '<img onerror="alert(1)">'
      ];
      const result = sanitizer.sanitize(input);
      expect(result[0]).not.toContain('<script>');
      expect(result[1]).not.toContain('onerror');
    });

    test('should handle null and undefined', () => {
      expect(sanitizer.sanitize(null)).toBe(null);
      expect(sanitizer.sanitize(undefined)).toBe(undefined);
    });

    test('should preserve non-string values', () => {
      const input = {
        count: 42,
        active: true,
        nested: { value: 'safe' }
      };
      const result = sanitizer.sanitize(input);
      expect(result.count).toBe(42);
      expect(result.active).toBe(true);
      expect(result.nested.value).toBe('safe');
    });
  });

  describe('sanitizer.stripAllTags()', () => {
    test('should remove all HTML tags', () => {
      const input = '<p>Hello <strong>World</strong></p>';
      const result = sanitizer.stripAllTags(input);
      expect(result).toBe('Hello World');
    });

    test('should handle input that is not a string', () => {
      expect(sanitizer.stripAllTags(123)).toBe(123);
    });
  });

  describe('sanitizer.sanitizeAttribute()', () => {
    test('should escape attribute values', () => {
      const input = '"><script>alert(1)</script>';
      const result = sanitizer.sanitizeAttribute(input);
      expect(result).toContain('&quot;');
    });
  });
});

describe('sanitizeMiddleware', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = {
      body: {},
      query: {},
      params: {}
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
  });

  test('should sanitize request body', () => {
    mockReq.body = {
      name: '<script>alert(1)</script>',
      description: '<img onerror="alert(1)">'
    };

    const middleware = sanitizeMiddleware();
    middleware(mockReq, mockRes, mockNext);

    expect(mockReq.body.name).not.toContain('<script>');
    expect(mockReq.body.description).not.toContain('onerror');
    expect(mockNext).toHaveBeenCalled();
  });

  test('should sanitize query parameters', () => {
    mockReq.query = {
      search: '<script>alert(1)</script>'
    };

    const middleware = sanitizeMiddleware();
    middleware(mockReq, mockRes, mockNext);

    expect(mockReq.query.search).not.toContain('<script>');
    expect(mockNext).toHaveBeenCalled();
  });

  test('should sanitize params', () => {
    mockReq.params = {
      id: '<script>alert(1)</script>'
    };

    const middleware = sanitizeMiddleware();
    middleware(mockReq, mockRes, mockNext);

    expect(mockReq.params.id).not.toContain('<script>');
    expect(mockNext).toHaveBeenCalled();
  });

  test('should handle empty body', () => {
    mockReq.body = null;

    const middleware = sanitizeMiddleware();
    middleware(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });
});

describe('validateAndSanitize', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = {
      body: {}
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
  });

  test('should pass safe input', () => {
    mockReq.body = {
      name: 'John Doe',
      email: 'john@example.com'
    };

    validateAndSanitize(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  test('should reject dangerous input with 400', () => {
    mockReq.body = {
      name: '<script>alert(1)</script>'
    };

    validateAndSanitize(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: expect.objectContaining({
        code: 'INPUT_VALIDATION_ERROR'
      })
    }));
  });

  test('should reject dangerous input with 400', () => {
      mockReq.body = {
        name: '<script>alert(1)</script>'
      };

      validateAndSanitize(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'INPUT_VALIDATION_ERROR'
        })
      }));
    });

    test('should sanitize non-dangerous input', () => {
      mockReq.body = {
        name: '<strong>Bold</strong>'
      };

      validateAndSanitize(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    test('should preserve safe HTML tags', () => {
      mockReq.body = {
        name: '<p>Safe paragraph</p>'
      };

      validateAndSanitize(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.body.name).toContain('<p>');
    });
});
