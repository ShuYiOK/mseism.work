# 后端系统编码规范

## 1. 代码风格规范

### 1.1 缩进和空白

- 使用 2 空格缩进，不使用 Tab
- 在操作符前后添加空格：`const sum = a + b`
- 在逗号后面添加空格：`fn(a, b, c)`
- 块级语句前后添加空行
- 禁止在行尾添加多余空白字符

### 1.2 命名规范

#### 变量和函数命名

| 类型 | 规范 | 示例 |
|------|------|------|
| 变量 | camelCase | `userName`, `deviceList` |
| 常量 | UPPER_SNAKE | `MAX_CONNECTIONS`, `API_TIMEOUT` |
| 函数 | camelCase | `getUserById`, `syncDevices` |
| 类 | PascalCase | `DeviceService`, `CacheManager` |
| 私有变量 | _camelCase | `_internalCache` |

#### 文件命名

- JavaScript 文件：使用 camelCase 或 kebab-case
- 配置文件：使用 camelCase
- 测试文件：`*.test.js` 或 `*.spec.js`

### 1.3 引号和分号

- 字符串使用单引号：`const name = '张三'`
- 始终使用分号结束语句
- 模板字符串用于多行字符串和变量插值

### 1.4 注释规范

```javascript
/**
 * 函数说明（使用 JSDoc 格式）
 * @param {string} paramName - 参数说明
 * @param {number} [optionalParam] - 可选参数
 * @returns {Promise<Object>} 返回值说明
 */
async function myFunction(paramName, optionalParam) {
  // 单行注释用于解释复杂逻辑
  const result = doSomething();

  /*
   * 多行注释用于解释复杂的算法
   * 或业务逻辑
   */
  return result;
}
```

## 2. 函数设计规范

### 2.1 函数长度

- 每个函数不超过 50 行
- 每个函数只做一件事
- 函数参数不超过 5 个

### 2.2 异步处理

```javascript
// 使用 async/await，避免回调地狱
async function fetchData() {
  try {
    const result = await api.getData();
    return result;
  } catch (error) {
    console.error('获取数据失败:', error);
    throw error;
  }
}
```

### 2.3 错误处理

```javascript
// 使用自定义错误类
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

// 错误处理中间件
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: err.message
  });
}
```

## 3. 模块组织规范

### 3.1 模块结构

```javascript
/**
 * 模块说明
 */

// 导入
const fs = require('fs');

// 常量定义
const MAX_SIZE = 100;

// 私有函数
function privateFunction() {}

// 导出
module.exports = {
  publicFunction
};
```

### 3.2 导入顺序

1. Node.js 内置模块
2. 第三方模块
3. 项目模块
4. 相对路径模块

```javascript
const fs = require('fs');
const path = require('path');

const express = require('express');
const axios = require('axios');

const config = require('../config');
const db = require('./database');
```

## 4. 数据库规范

### 4.1 SQL 编写

- 使用参数化查询防止 SQL 注入
- 表名和列名使用反引号
- 关键字大写

```javascript
const sql = `
  SELECT \`id\`, \`name\`, \`status\`
  FROM \`devices\`
  WHERE \`status\` = ?
  ORDER BY \`name\`
`;

await db.query(sql, [status]);
```

### 4.2 事务处理

```javascript
async function transactionExample() {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    await connection.execute('INSERT INTO ...', [...]);
    await connection.execute('UPDATE ...', [...]);

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
```

## 5. API 设计规范

### 5.1 RESTful URL

- 使用名词而非动词：`/devices` 而非 `/getDevices`
- 使用 HTTP 方法：`GET` 获取，`POST` 创建，`PUT` 更新，`DELETE` 删除
- 使用复数名词：`/devices` 而非 `/device`

### 5.2 响应格式

```javascript
// 成功响应
res.json({
  success: true,
  data: { ... },
  meta: { ... }
});

// 错误响应
res.status(400).json({
  success: false,
  error: '错误信息'
});
```

## 6. 日志规范

### 6.1 日志级别

| 级别 | 使用场景 |
|------|---------|
| ERROR | 错误异常，需要调查 |
| WARN | 警告，可能存在问题 |
| INFO | 重要业务事件 |
| DEBUG | 开发调试信息 |

### 6.2 日志格式

```javascript
console.log(`[${new Date().toISOString()}] [INFO] 消息内容`, {
  metadata: '额外信息'
});
```

## 7. 安全规范

### 7.1 输入验证

```javascript
function validateInput(data) {
  if (typeof data.id !== 'string' || data.id.length === 0) {
    throw new Error('无效的ID');
  }
  return true;
}
```

### 7.2 敏感信息

- 禁止在日志中记录密码、Token 等敏感信息
- 使用环境变量存储敏感配置
- 定期轮换密钥

## 8. Git 提交规范

### 8.1 提交信息格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### 8.2 Type 类型

| Type | 说明 |
|------|------|
| feat | 新功能 |
| fix | 修复 Bug |
| docs | 文档更新 |
| style | 代码格式 |
| refactor | 重构 |
| test | 测试 |
| chore | 构建/工具 |

### 8.3 示例

```
feat(device): 添加设备批量操作接口

- 支持批量删除设备
- 支持批量更新设备状态
- 添加批量操作限流

Closes #123
```
