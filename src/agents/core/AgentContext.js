/**
 * AgentContext - Agent间共享上下文
 * 
 * 职责：
 * 1. 存储工作流执行过程中的中间状态
 * 2. 提供类型安全的get/set接口
 * 3. 记录完整的执行轨迹（用于调试和验证）
 * 4. 支持执行元数据（时间戳、性能指标等）
 */

export class AgentContext {
  constructor(initialData = {}) {
    // 用户原始输入
    this.userInput = initialData.userInput || '';
    
    // 用户库存原料
    this.inventory = initialData.inventory || [];
    
    // 所有可用饮品
    this.allDrinks = initialData.allDrinks || [];
    
    // 当前时间（用于时序分析）
    this.currentTime = initialData.currentTime || new Date().toISOString();
    
    // Agent中间输出存储
    this.intermediate = new Map();
    
    // Agent输出结果存储
    this.outputs = new Map();
    
    // 执行轨迹记录
    this.executionTrace = [];
    
    // 性能指标
    this.metrics = {
      startTime: Date.now(),
      agentDurations: new Map(),
      totalDuration: 0
    };
  }

  /**
   * 存储Agent中间输出（供后续Agent使用）
   */
  setIntermediate(key, value) {
    this.intermediate.set(key, value);
    this.recordTrace('SET_INTERMEDIATE', key, value);
  }

  /**
   * 获取Agent中间输出
   */
  getIntermediate(key, defaultValue = null) {
    return this.intermediate.get(key) || defaultValue;
  }

  /**
   * 存储Agent最终输出
   */
  setOutput(agentName, result) {
    this.outputs.set(agentName, result);
    if (result.duration) {
      this.metrics.agentDurations.set(agentName, result.duration);
    }
    this.recordTrace('SET_OUTPUT', agentName, result);
  }

  /**
   * 获取Agent输出
   */
  getOutput(agentName) {
    return this.outputs.get(agentName);
  }

  /**
   * 记录执行轨迹
   */
  recordTrace(action, key, data = null) {
    this.executionTrace.push({
      timestamp: Date.now(),
      action,
      key,
      data: data ? JSON.stringify(data).substring(0, 500) : null // 限制大小
    });
  }

  /**
   * 获取执行摘要
   */
  getExecutionSummary() {
    const endTime = Date.now();
    this.metrics.totalDuration = endTime - this.metrics.startTime;
    
    return {
      userInput: this.userInput,
      totalDuration: this.metrics.totalDuration,
      agentDurations: Object.fromEntries(this.metrics.agentDurations),
      outputs: Object.fromEntries(this.outputs),
      trace: this.executionTrace
    };
  }

  /**
   * 获取推荐结果（提取最终结果）
   */
  getRecommendationResult() {
    const moodData = this.getIntermediate('moodData');
    const analysis = this.getIntermediate('patternAnalysis');
    const vectorResult = this.getIntermediate('vectorResult');
    const matches = this.getIntermediate('matches');
    const copy = this.getIntermediate('creativeCopy');
    const validation = this.getIntermediate('validationReport');

    return {
      moodData,
      analysis,
      vectorResult,
      matches,
      copy,
      validation,
      executionSummary: this.getExecutionSummary()
    };
  }
}

export default AgentContext;
