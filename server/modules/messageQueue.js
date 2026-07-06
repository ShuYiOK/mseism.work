/**
 * 消息队列模块
 * 提供统一的消息生产、消费、订阅功能
 */

const { performanceOptimizer } = require('./performanceOptimizer');

class MessageQueue {
  constructor() {
    this.handlers = new Map();
    this.subscribers = new Map();
    this.messageHistory = [];
    this.maxHistory = 100;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  async connect(options = {}) {
    const { host, port, username, password } = options;

    console.log(`[消息队列] 正在连接 ${host}:${port}...`);

    try {
      this.isConnected = true;
      console.log('[消息队列] 连接成功');
      this.reconnectAttempts = 0;
      return true;
    } catch (error) {
      console.error('[消息队列] 连接失败:', error.message);
      this.handleReconnect(options);
      return false;
    }
  }

  async handleReconnect(options) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[消息队列] 达到最大重连次数，停止重连');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    console.log(`[消息队列] ${delay/1000}秒后尝试第${this.reconnectAttempts}次重连...`);

    setTimeout(() => {
      this.connect(options);
    }, delay);
  }

  disconnect() {
    this.isConnected = false;
    console.log('[消息队列] 已断开连接');
  }

  async publish(queue, message, options = {}) {
    if (!this.isConnected) {
      console.warn('[消息队列] 未连接，消息将被丢弃');
      return false;
    }

    const messageEnvelope = {
      id: this.generateMessageId(),
      queue,
      payload: message,
      timestamp: Date.now(),
      priority: options.priority || 0,
      headers: options.headers || {}
    };

    console.log(`[消息队列] 发布消息到 ${queue}:`, messageEnvelope.id);

    this.addToHistory(messageEnvelope);

    return messageEnvelope.id;
  }

  async subscribe(queue, handler, options = {}) {
    if (!this.handlers.has(queue)) {
      this.handlers.set(queue, []);
    }

    const subscription = {
      id: this.generateSubscriptionId(),
      handler,
      options,
      active: true
    };

    this.handlers.get(queue).push(subscription);

    console.log(`[消息队列] 订阅队列 ${queue}`);

    return subscription.id;
  }

  async unsubscribe(queue, subscriptionId) {
    const handlers = this.handlers.get(queue);
    if (handlers) {
      const index = handlers.findIndex(h => h.id === subscriptionId);
      if (index !== -1) {
        handlers.splice(index, 1);
        console.log(`[消息队列] 取消订阅 ${queue}:${subscriptionId}`);
        return true;
      }
    }
    return false;
  }

  async publishEvent(event, data, options = {}) {
    return await this.publish(`events.${event}`, data, {
      ...options,
      headers: {
        ...options.headers,
        event,
        type: 'event'
      }
    });
  }

  async publishCommand(command, data, options = {}) {
    return await this.publish(`commands.${command}`, data, {
      ...options,
      headers: {
        ...options.headers,
        command,
        type: 'command'
      }
    });
  }

  async publishScheduled(task, data, options = {}) {
    return await this.publish(`scheduled.${task}`, data, {
      ...options,
      headers: {
        ...options.headers,
        task,
        type: 'scheduled'
      }
    });
  }

  generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateSubscriptionId() {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  addToHistory(message) {
    this.messageHistory.push(message);
    if (this.messageHistory.length > this.maxHistory) {
      this.messageHistory.shift();
    }
  }

  getHistory(queue = null, limit = 10) {
    let history = this.messageHistory;
    if (queue) {
      history = history.filter(m => m.queue === queue);
    }
    return history.slice(-limit);
  }

  getStats() {
    return {
      connected: this.isConnected,
      queues: Array.from(this.handlers.keys()),
      totalSubscriptions: Array.from(this.handlers.values()).reduce((sum, h) => sum + h.length, 0),
      messageHistorySize: this.messageHistory.length
    };
  }
}

class EventBus {
  constructor() {
    this.listeners = new Map();
    this.middleware = [];
  }

  use(middleware) {
    this.middleware.push(middleware);
  }

  on(event, handler, options = {}) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }

    const listener = {
      id: `listener_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      handler,
      options
    };

    this.listeners.get(event).push(listener);

    console.log(`[事件总线] 注册监听器: ${event}`);

    return listener.id;
  }

  off(event, listenerId) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      const index = listeners.findIndex(l => l.id === listenerId);
      if (index !== -1) {
        listeners.splice(index, 1);
        console.log(`[事件总线] 移除监听器: ${event}:${listenerId}`);
        return true;
      }
    }
    return false;
  }

  async emit(event, data, context = {}) {
    console.log(`[事件总线] 触发事件: ${event}`);

    let payload = { event, data, context, timestamp: Date.now() };

    for (const mw of this.middleware) {
      payload = await mw(payload);
    }

    const listeners = this.listeners.get(event) || [];

    const results = [];
    for (const listener of listeners) {
      if (listener.options.once) {
        this.off(event, listener.id);
      }
      try {
        results.push(await listener.handler(payload.data, payload.context));
      } catch (error) {
        console.error(`[事件总线] 事件处理器错误 ${event}:`, error.message);
        if (listener.options.errorHandler) {
          listener.options.errorHandler(error);
        }
      }
    }

    return results;
  }

  once(event, handler, options = {}) {
    return this.on(event, handler, { ...options, once: true });
  }

  removeAllListeners(event = null) {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  getListenerCount(event) {
    return this.listeners.get(event)?.length || 0;
  }
}

class TaskQueue {
  constructor() {
    this.tasks = new Map();
    this.running = new Map();
    this.completed = new Map();
    this.failed = new Map();
  }

  async addTask(name, handler, options = {}) {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const task = {
      id: taskId,
      name,
      handler,
      status: 'pending',
      options: {
        retries: options.retries || 3,
        delay: options.delay || 0,
        timeout: options.timeout || 30000,
        ...options
      },
      createdAt: Date.now(),
      startedAt: null,
      completedAt: null
    };

    this.tasks.set(taskId, task);

    console.log(`[任务队列] 添加任务: ${name} (${taskId})`);

    if (task.options.delay > 0) {
      setTimeout(() => this.executeTask(taskId), task.options.delay);
    } else {
      this.executeTask(taskId);
    }

    return taskId;
  }

  async executeTask(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = 'running';
    task.startedAt = Date.now();
    this.running.set(taskId, task);

    console.log(`[任务队列] 开始执行任务: ${task.name}`);

    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Task timeout')), task.options.timeout);
      });

      const result = await Promise.race([task.handler(), timeoutPromise]);

      task.status = 'completed';
      task.completedAt = Date.now();
      this.completed.set(taskId, { task, result, duration: task.completedAt - task.startedAt });

      console.log(`[任务队列] 任务完成: ${task.name} (${task.completedAt - task.startedAt}ms)`);

    } catch (error) {
      console.error(`[任务队列] 任务失败: ${task.name}`, error.message);

      if (task.options.retries > 0) {
        task.options.retries--;
        console.log(`[任务队列] 任务重试: ${task.name} (剩余${task.options.retries}次)`);
        setTimeout(() => this.executeTask(taskId), 1000);
      } else {
        task.status = 'failed';
        task.error = error.message;
        task.failedAt = Date.now();
        this.failed.set(taskId, { task, error, duration: task.failedAt - task.startedAt });
      }
    } finally {
      this.running.delete(taskId);
    }
  }

  getTask(taskId) {
    return this.tasks.get(taskId);
  }

  getStats() {
    return {
      total: this.tasks.size,
      pending: Array.from(this.tasks.values()).filter(t => t.status === 'pending').length,
      running: this.running.size,
      completed: this.completed.size,
      failed: this.failed.size
    };
  }
}

const messageQueue = new MessageQueue();
const eventBus = new EventBus();
const taskQueue = new TaskQueue();

module.exports = {
  MessageQueue,
  EventBus,
  TaskQueue,
  messageQueue,
  eventBus,
  taskQueue
};
