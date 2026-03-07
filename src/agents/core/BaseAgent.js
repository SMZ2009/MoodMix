/**
 * BaseAgent - 所有Agent的基类
 * 
 * 职责：
 * 1. 定义Agent生命周期：validateInput → process → validateOutput
 * 2. 提供统一的日志记录
 * 3. 实现超时控制和错误处理
 * 4. 支持重试机制
 */

export class BaseAgent {
  constructor(config = {}) {
    this.name = config.name || this.constructor.name;
    this.timeout = config.timeout || 10000; // 默认10秒超时
    this.maxRetries = config.maxRetries || 2;
    this.retryDelay = config.retryDelay || 1000;
  }

  /**
   * 执行Agent的主要逻辑
   * @param {AgentContext} context - 共享上下文
   * @returns {Promise<Object>} 执行结果
   */
  async execute(context) {
    const startTime = Date.now();
    
    try {
      this.log('START', `Agent ${this.name} started execution`);
      
      // 前置检查
      const validation = this.validateInput(context);
      if (!validation.valid) {
        this.log('VALIDATION_FAILED', validation.reason);
        return {
          success: false,
          agent: this.name,
          duration: 0,
          error: validation.reason,
          userMessage: validation.userMessage || '输入格式不正确，请重新输入',
          requiresReinput: true
        };
      }

      // 执行核心逻辑（带超时控制）
      const result = await this.executeWithTimeout(context);
      
      // 后置验证
      const outputValidation = this.validateOutput(result);
      if (!outputValidation.valid) {
        throw new Error(`Output validation failed: ${outputValidation.reason}`);
      }

      const duration = Date.now() - startTime;
      this.log('SUCCESS', `Agent ${this.name} completed in ${duration}ms`);
      
      return {
        success: true,
        agent: this.name,
        duration,
        data: result
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      this.log('ERROR', `Agent ${this.name} failed after ${duration}ms: ${error.message}`);
      
      // 尝试错误恢复
      const recovery = await this.handleError(error, context);
      if (recovery) {
        return {
          success: true,
          agent: this.name,
          duration,
          data: recovery,
          recovered: true
        };
      }

      return {
        success: false,
        agent: this.name,
        duration,
        error: error.message,
        userMessage: this.getErrorMessage(error)
      };
    }
  }

  /**
   * 带超时控制的执行
   */
  async executeWithTimeout(context) {
    return Promise.race([
      this.process(context),
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Agent ${this.name} timeout after ${this.timeout}ms`));
        }, this.timeout);
      })
    ]);
  }

  /**
   * 输入验证 - 子类可重写
   */
  validateInput(context) {
    // 默认通过，子类可重写
    return { valid: true };
  }

  /**
   * 核心处理逻辑 - 子类必须实现
   */
  async process(context) {
    throw new Error(`Agent ${this.name} must implement process() method`);
  }

  /**
   * 输出验证 - 子类可重写
   */
  validateOutput(result) {
    // 默认通过，子类可重写
    return { valid: true };
  }

  /**
   * 错误处理与恢复 - 子类可重写
   */
  async handleError(error, context) {
    // 默认不恢复，子类可重写实现降级逻辑
    return null;
  }

  /**
   * 获取用户友好的错误消息
   */
  getErrorMessage(error) {
    if (error.message.includes('timeout')) {
      return '分析服务响应较慢，请稍后重试';
    }
    return '处理过程中出现错误，请重试';
  }

  /**
   * 结构化日志输出
   */
  log(level, message, data = null) {
    const prefix = `[${this.name}]`;
    
    switch (level) {
      case 'START':
        console.log(`🟦 ${prefix} ${message}`);
        break;
      case 'SUCCESS':
        console.log(`🟩 ${prefix} ${message}`);
        break;
      case 'ERROR':
        console.error(`🟥 ${prefix} ${message}`);
        break;
      case 'VALIDATION_FAILED':
        console.warn(`🟨 ${prefix} ${message}`);
        break;
      default:
        console.log(`${prefix} ${message}`);
    }

    if (data) {
      console.log(`   📊 Data:`, data);
    }
  }
}

export default BaseAgent;
