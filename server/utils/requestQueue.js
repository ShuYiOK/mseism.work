/**
 * 请求队列管理
 * 优化请求处理，避免并发请求过多
 */

class RequestQueue {
  constructor() {
    this.queue = [];
    this.processing = new Set();
    this.maxConcurrent = 10; // 最大并发数
    this.processingInterval = 100; // 处理间隔
    this.timeout = 30000; // 请求超时时间
    
    // 启动处理循环
    this.startProcessing();
  }

  /**
   * 添加请求到队列
   * @param {Function} task 请求处理函数
   * @param {Object} options 选项
   * @returns {Promise} 处理结果
   */
  add(task, options = {}) {
    return new Promise((resolve, reject) => {
      const requestId = Date.now().toString(36) + Math.random().toString(36).substr(2);
      const timeout = options.timeout || this.timeout;
      
      const request = {
        id: requestId,
        task,
        resolve,
        reject,
        timeout,
        startTime: Date.now()
      };

      this.queue.push(request);
      this.processQueue();
    });
  }

  /**
   * 处理队列
   */
  processQueue() {
    if (this.processing.size >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const request = this.queue.shift();
    if (!request) return;

    this.processing.add(request.id);

    // 设置超时
    const timeoutId = setTimeout(() => {
      this.processing.delete(request.id);
      request.reject(new Error('请求超时'));
      this.processQueue();
    }, request.timeout);

    // 执行任务
    Promise.resolve()
      .then(() => request.task())
      .then(result => {
        clearTimeout(timeoutId);
        this.processing.delete(request.id);
        request.resolve(result);
        this.processQueue();
      })
      .catch(error => {
        clearTimeout(timeoutId);
        this.processing.delete(request.id);
        request.reject(error);
        this.processQueue();
      });
  }

  /**
   * 启动处理循环
   */
  startProcessing() {
    this.processingTimer = setInterval(() => {
      this.processQueue();
    }, this.processingInterval);
  }

  /**
   * 停止处理循环
   */
  stopProcessing() {
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
    }
  }

  /**
   * 获取队列状态
   * @returns {Object} 队列状态
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      processingCount: this.processing.size,
      maxConcurrent: this.maxConcurrent
    };
  }

  /**
   * 清空队列
   */
  clear() {
    this.queue = [];
  }
}

// 导出单例
module.exports = new RequestQueue();
