# MseisM 设备监控系统 - 修复计划

## [x] 任务 1: 修复后端配置读取错误
- **优先级**: P0
- **Depends On**: None
- **Description**: 
  - 修复 server.js 中 CONFIG 对象使用错误的配置属性问题
  - 确保正确读取设备 API 地址和同步配置
- **Success Criteria**: 后端能够正确读取配置，启动时显示正确的设备数据源地址
- **Test Requirements**:
  - `programmatic` TR-1.1: 服务器启动时日志显示正确的设备 API 地址
  - `programmatic` TR-1.2: 配置验证通过，无配置错误
- **Notes**: 检查 config.js 中的导出结构，确保 server.js 正确引用配置项

## [x] 任务 2: 优化设备数据同步逻辑
- **优先级**: P0
- **Depends On**: 任务 1
- **Description**:
  - 优化 syncDevicesFromApi 函数中的数据格式处理
  - 改进 storage 字段的解析逻辑，处理非数字值
  - 增强错误处理和日志记录
- **Success Criteria**: 能够成功从外部 API 获取并解析设备数据
- **Test Requirements**:
  - `programmatic` TR-2.1: 同步过程无错误日志
  - `programmatic` TR-2.2: 数据库中正确存储设备数据
- **Notes**: 处理 API 返回的特殊字符和异常数据格式

## [x] 任务 3: 清理重复的路由定义
- **优先级**: P1
- **Depends On**: 任务 1
- **Description**:
  - 移除 server.js 中重复的设备路由定义
  - 统一使用 device-routes.js 中的路由
  - 确保路由配置正确
- **Success Criteria**: 路由定义无重复，API 访问正常
- **Test Requirements**:
  - `programmatic` TR-3.1: API 路由测试通过
  - `programmatic` TR-3.2: 无路由冲突错误
- **Notes**: 注意路由顺序，避免参数路由被提前匹配

## [x] 任务 4: 优化前端 WebSocket 连接
- **优先级**: P1
- **Depends On**: 任务 2
- **Description**:
  - 检查前端 WebSocket 连接配置
  - 确保正确连接到后端 WebSocket 服务
  - 优化 Socket 事件处理
- **Success Criteria**: 前端能够接收实时设备数据更新
- **Test Requirements**:
  - `programmatic` TR-4.1: WebSocket 连接成功建立
  - `programmatic` TR-4.2: 能够接收设备更新事件
- **Notes**: 检查 CORS 配置和 WebSocket 路径

## [x] 任务 5: 精简前端代码
- **优先级**: P2
- **Depends On**: 任务 4
- **Description**:
  - 移除不必要的 Web Worker 逻辑
  - 简化动态同步管理器
  - 优化设备列表组件代码
- **Success Criteria**: 前端代码更简洁，性能更好
- **Test Requirements**:
  - `human-judgement` TR-5.1: 代码可读性良好
  - `programmatic` TR-5.2: 前端加载速度提升
- **Notes**: 保留核心功能，移除过度设计的部分

## [x] 任务 6: 测试和验证
- **优先级**: P0
- **Depends On**: 任务 1-5
- **Description**:
  - 启动前后端服务
  - 测试设备数据同步
  - 验证前端展示
  - 检查系统性能
- **Success Criteria**: 系统能够正常运行，设备数据正确显示
- **Test Requirements**:
  - `programmatic` TR-6.1: 后端服务正常启动 ✓
  - `programmatic` TR-6.2: 前端页面正常加载 ✓
  - `programmatic` TR-6.3: 设备数据正确同步和显示 ✓
- **Notes**: 测试不同网络环境下的同步性能

## 测试结果总结
- 后端服务成功启动，设备数据同步正常
- 前端服务成功启动，页面可以访问
- 设备数据从外部 API 成功同步并在前端显示
- 系统运行稳定，无严重错误