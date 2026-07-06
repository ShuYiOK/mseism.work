/**
 * 错误码定义
 * 统一项目中的错误类型和错误码
 */

const ErrorCodes = {
  AUTH: {
    TOKEN_MISSING: {
      code: 'AUTH_TOKEN_MISSING',
      status: 401,
      message: '未提供认证 token'
    },
    TOKEN_INVALID_FORMAT: {
      code: 'AUTH_TOKEN_INVALID_FORMAT',
      status: 401,
      message: 'token 格式不正确'
    },
    TOKEN_EXPIRED: {
      code: 'AUTH_TOKEN_EXPIRED',
      status: 401,
      message: 'token 已过期'
    },
    TOKEN_INVALID: {
      code: 'AUTH_TOKEN_INVALID',
      status: 401,
      message: '无效的 token'
    },
    PERMISSION_DENIED: {
      code: 'AUTH_PERMISSION_DENIED',
      status: 403,
      message: '权限不足'
    },
    ACCOUNT_DISABLED: {
      code: 'AUTH_ACCOUNT_DISABLED',
      status: 403,
      message: '账户已被禁用'
    },
    INVALID_CREDENTIALS: {
      code: 'AUTH_INVALID_CREDENTIALS',
      status: 401,
      message: '用户名或密码错误'
    }
  },
  VALIDATION: {
    INPUT_VALIDATION_ERROR: {
      code: 'INPUT_VALIDATION_ERROR',
      status: 400,
      message: '输入验证失败'
    },
    MISSING_REQUIRED_FIELD: {
      code: 'MISSING_REQUIRED_FIELD',
      status: 400,
      message: '缺少必需字段'
    },
    INVALID_FIELD_FORMAT: {
      code: 'INVALID_FIELD_FORMAT',
      status: 400,
      message: '字段格式不正确'
    }
  },
  RESOURCE: {
    NOT_FOUND: {
      code: 'RESOURCE_NOT_FOUND',
      status: 404,
      message: '资源不存在'
    },
    ALREADY_EXISTS: {
      code: 'RESOURCE_ALREADY_EXISTS',
      status: 409,
      message: '资源已存在'
    }
  },
  RATE_LIMIT: {
    TOO_MANY_REQUESTS: {
      code: 'RATE_LIMIT_EXCEEDED',
      status: 429,
      message: '请求过于频繁'
    }
  },
  SERVER: {
    INTERNAL_ERROR: {
      code: 'INTERNAL_SERVER_ERROR',
      status: 500,
      message: '服务器内部错误'
    },
    SERVICE_UNAVAILABLE: {
      code: 'SERVICE_UNAVAILABLE',
      status: 503,
      message: '服务暂不可用'
    }
  }
};

function createErrorResponse(errorDef, details = null) {
  const response = {
    success: false,
    error: {
      code: errorDef.code,
      message: errorDef.message
    }
  };

  if (details) {
    response.error.details = details;
  }

  return response;
}

function getErrorByCode(code) {
  for (const category of Object.values(ErrorCodes)) {
    for (const error of Object.values(category)) {
      if (error.code === code) {
        return error;
      }
    }
  }
  return null;
}

class AppError extends Error {
  constructor(errorDef, details = null) {
    super(errorDef.message);
    this.code = errorDef.code;
    this.status = errorDef.status;
    this.details = details;
    this.name = 'AppError';
  }

  toJSON() {
    return createErrorResponse(
      { code: this.code, status: this.status, message: this.message },
      this.details
    );
  }
}

module.exports = {
  ErrorCodes,
  createErrorResponse,
  getErrorByCode,
  AppError
};
