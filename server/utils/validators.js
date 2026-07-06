/**
 * 输入验证规则
 * 使用 Joi 定义所有 API 请求的验证规则
 */

const Joi = require('joi');

const authSchemas = {
  login: Joi.object({
    username: Joi.string()
      .alphanum()
      .min(3)
      .max(32)
      .required()
      .messages({
        'string.alphanum': '用户名只能包含字母和数字',
        'string.min': '用户名至少 3 个字符',
        'string.max': '用户名最多 32 个字符',
        'any.required': '用户名不能为空'
      }),
    password: Joi.string()
      .min(6)
      .max(128)
      .required()
      .messages({
        'string.min': '密码至少 6 个字符',
        'any.required': '密码不能为空'
      })
  }),

  refresh: Joi.object({
    refresh_token: Joi.string()
      .required()
      .messages({
        'any.required': '刷新 token 不能为空'
      })
  })
};

const deviceSchemas = {
  create: Joi.object({
    name: Joi.string()
      .min(1)
      .max(100)
      .required()
      .messages({
        'string.min': '设备名称不能为空',
        'string.max': '设备名称最多 100 个字符',
        'any.required': '设备名称不能为空'
      }),
    type: Joi.string()
      .valid('sensor', 'gateway', 'station')
      .required()
      .messages({
        'any.only': '设备类型必须是 sensor、gateway 或 station',
        'any.required': '设备类型不能为空'
      }),
    location: Joi.string()
      .max(200)
      .allow('', null)
      .optional(),
    group_id: Joi.number()
      .integer()
      .positive()
      .allow(null)
      .optional()
  }),

  update: Joi.object({
    name: Joi.string()
      .min(1)
      .max(100)
      .optional(),
    type: Joi.string()
      .valid('sensor', 'gateway', 'station')
      .optional(),
    location: Joi.string()
      .max(200)
      .allow('', null)
      .optional(),
    group_id: Joi.number()
      .integer()
      .positive()
      .allow(null)
      .optional()
  }),

  batch: Joi.object({
    requests: Joi.array()
      .items(
        Joi.object({
          method: Joi.string().valid('GET', 'POST', 'PUT', 'DELETE').required(),
          path: Joi.string().pattern(/^\/devices/).required(),
          data: Joi.object().optional()
        })
      )
      .min(1)
      .max(10)
      .required()
      .messages({
        'array.min': '批量请求数量至少 1 个',
        'array.max': '批量请求数量不能超过 10 个',
        'any.required': '请求列表不能为空'
      })
  }),

  query: Joi.object({
    fields: Joi.string()
      .pattern(/^[a-zA-Z_,]*$/)
      .optional()
      .messages({
        'string.pattern.base': 'fields 参数格式不正确'
      }),
    limit: Joi.number()
      .integer()
      .min(1)
      .max(1000)
      .optional()
      .messages({
        'number.min': 'limit 最小值为 1',
        'number.max': 'limit 最大值为 1000'
      }),
    offset: Joi.number()
      .integer()
      .min(0)
      .optional()
      .messages({
        'number.min': 'offset 不能为负数'
      }),
    sort: Joi.string()
      .pattern(/^-?[a-zA-Z_]+$/)
      .optional()
      .messages({
        'string.pattern.base': 'sort 参数格式不正确'
      }),
    status: Joi.string()
      .valid('online', 'offline', 'warning', 'error')
      .optional()
  })
};

const groupSchemas = {
  create: Joi.object({
    name: Joi.string()
      .min(1)
      .max(100)
      .required()
      .messages({
        'string.min': '分组名称不能为空',
        'string.max': '分组名称最多 100 个字符',
        'any.required': '分组名称不能为空'
      }),
    description: Joi.string()
      .max(500)
      .allow('', null)
      .optional(),
    color: Joi.string()
      .pattern(/^#[0-9A-Fa-f]{6}$/)
      .allow('', null)
      .optional()
      .messages({
        'string.pattern.base': '颜色必须是有效的十六进制颜色代码'
      }),
    sort_order: Joi.number()
      .integer()
      .min(0)
      .allow(null)
      .optional()
  }),

  update: Joi.object({
    name: Joi.string()
      .min(1)
      .max(100)
      .optional(),
    description: Joi.string()
      .max(500)
      .allow('', null)
      .optional(),
    color: Joi.string()
      .pattern(/^#[0-9A-Fa-f]{6}$/)
      .allow('', null)
      .optional()
      .messages({
        'string.pattern.base': '颜色必须是有效的十六进制颜色代码'
      }),
    sort_order: Joi.number()
      .integer()
      .min(0)
      .allow(null)
      .optional()
  }),

  addDevice: Joi.object({
    deviceId: Joi.number()
      .integer()
      .positive()
      .required()
      .messages({
        'any.required': '设备 ID 不能为空'
      })
  }),

  removeDevice: Joi.object({
    deviceId: Joi.number()
      .integer()
      .positive()
      .required()
      .messages({
        'any.required': '设备 ID 不能为空'
      })
  })
};

const configSchemas = {
  update: Joi.object({
    key: Joi.string()
      .min(1)
      .max(100)
      .required()
      .messages({
        'any.required': '配置键不能为空'
      }),
    value: Joi.any()
      .required()
      .messages({
        'any.required': '配置值不能为空'
      })
  }),

  validate: Joi.object({
    config: Joi.object()
      .required()
      .messages({
        'any.required': '配置对象不能为空'
      })
  })
};

const adminSchemas = {
  loadPlugin: Joi.object({
    pluginPath: Joi.string()
      .min(1)
      .required()
      .messages({
        'any.required': '插件路径不能为空'
      })
  }),

  unloadPlugin: Joi.object({
    pluginName: Joi.string()
      .min(1)
      .required()
      .messages({
        'any.required': '插件名称不能为空'
      })
  }),

  reloadPlugin: Joi.object({
    pluginName: Joi.string()
      .min(1)
      .required()
      .messages({
        'any.required': '插件名称不能为空'
      })
  }),

  setConfig: Joi.object({
    key: Joi.string()
      .min(1)
      .required(),
    value: Joi.any()
      .required()
  })
};

function validateBody(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        error: {
          code: 'INPUT_VALIDATION_ERROR',
          message: '输入验证失败',
          details
        }
      });
    }

    req.body = value;
    next();
  };
}

function validateQuery(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        error: {
          code: 'INPUT_VALIDATION_ERROR',
          message: '查询参数验证失败',
          details
        }
      });
    }

    req.query = value;
    next();
  };
}

function validateParams(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        error: {
          code: 'INPUT_VALIDATION_ERROR',
          message: '路径参数验证失败',
          details
        }
      });
    }

    req.params = value;
    next();
  };
}

module.exports = {
  authSchemas,
  deviceSchemas,
  groupSchemas,
  configSchemas,
  adminSchemas,
  validateBody,
  validateQuery,
  validateParams
};
