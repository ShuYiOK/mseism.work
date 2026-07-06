/**
 * 错误处理模块单元测试
 */
const {
  AppError,
  ValidationError,
  AuthenticationError,
  NotFoundError,
  RateLimitError,
  DatabaseError,
  validateRequired,
  validateType,
  validateRange,
  validateEnum
} = require('../middlewares/errorHandler');

describe('错误类测试', () => {
  describe('AppError', () => {
    test('应该创建带有正确属性的错误', () => {
      const error = new AppError('测试错误', 500, 'TEST_ERROR');

      expect(error.message).toBe('测试错误');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('TEST_ERROR');
      expect(error.isOperational).toBe(true);
      expect(error instanceof Error).toBe(true);
    });

    test('应该使用默认状态码和错误码', () => {
      const error = new AppError('测试错误');

      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('ValidationError', () => {
    test('应该创建验证错误', () => {
      const details = { field: 'email', issue: '格式错误' };
      const error = new ValidationError('验证失败', details);

      expect(error.message).toBe('验证失败');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details).toEqual(details);
    });
  });

  describe('AuthenticationError', () => {
    test('应该创建认证错误', () => {
      const error = new AuthenticationError();

      expect(error.message).toBe('认证失败');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('AUTH_ERROR');
    });

    test('应该支持自定义消息', () => {
      const error = new AuthenticationError('Token已过期');

      expect(error.message).toBe('Token已过期');
    });
  });

  describe('NotFoundError', () => {
    test('应该创建404错误', () => {
      const error = new NotFoundError('设备');

      expect(error.message).toBe('设备不存在');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
    });

    test('应该使用默认资源名称', () => {
      const error = new NotFoundError();

      expect(error.message).toBe('资源不存在');
    });
  });

  describe('RateLimitError', () => {
    test('应该创建限流错误', () => {
      const error = new RateLimitError();

      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('RATE_LIMIT');
    });
  });

  describe('DatabaseError', () => {
    test('应该创建数据库错误', () => {
      const error = new DatabaseError('连接失败');

      expect(error.message).toBe('连接失败');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('DB_ERROR');
    });
  });
});

describe('验证函数测试', () => {
  describe('validateRequired', () => {
    test('应该通过所有字段都存在的情况', () => {
      const obj = { name: 'test', age: 25 };

      expect(() => validateRequired(obj, ['name', 'age'])).not.toThrow();
    });

    test('应该抛出缺少字段的错误', () => {
      const obj = { name: 'test' };

      expect(() => validateRequired(obj, ['name', 'age'])).toThrow(ValidationError);
      expect(() => validateRequired(obj, ['name', 'age'])).toThrow('缺少必要字段: age');
    });

    test('应该检测空字符串', () => {
      const obj = { name: '', age: 25 };

      expect(() => validateRequired(obj, ['name', 'age'])).toThrow();
    });

    test('应该检测null值', () => {
      const obj = { name: null, age: 25 };

      expect(() => validateRequired(obj, ['name', 'age'])).toThrow();
    });
  });

  describe('validateType', () => {
    test('应该通过类型匹配的情况', () => {
      expect(() => validateType('test', 'string', 'name')).not.toThrow();
      expect(() => validateType(123, 'number', 'age')).not.toThrow();
      expect(() => validateType(true, 'boolean', 'active')).not.toThrow();
    });

    test('应该抛出类型不匹配的错误', () => {
      expect(() => validateType(123, 'string', 'name')).toThrow(ValidationError);
      expect(() => validateType('test', 'number', 'age')).toThrow(ValidationError);
    });
  });

  describe('validateRange', () => {
    test('应该通过在范围内的值', () => {
      expect(() => validateRange(5, 1, 10, 'value')).not.toThrow();
      expect(() => validateRange(1, 1, 10, 'value')).not.toThrow();
      expect(() => validateRange(10, 1, 10, 'value')).not.toThrow();
    });

    test('应该抛出超出范围的错误', () => {
      expect(() => validateRange(0, 1, 10, 'value')).toThrow();
      expect(() => validateRange(11, 1, 10, 'value')).toThrow();
    });
  });

  describe('validateEnum', () => {
    const allowedValues = ['pending', 'active', 'inactive'];

    test('应该通过在枚举中的值', () => {
      expect(() => validateEnum('active', allowedValues, 'status')).not.toThrow();
    });

    test('应该抛出不在枚举中的错误', () => {
      expect(() => validateEnum('unknown', allowedValues, 'status')).toThrow(ValidationError);
    });
  });
});
