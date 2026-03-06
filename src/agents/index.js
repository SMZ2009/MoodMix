/**
 * Agents Module - 多智能体系统统一导出
 * 
 * 使用示例:
 * ```javascript
 * import { executeRecommendationPipeline, extractRecommendationResult } from './agents';
 * 
 * const result = await executeRecommendationPipeline('今天很开心', {
 *   inventory: ['金酒', '柠檬汁'],
 *   allDrinks: drinks
 * });
 * 
 * const recommendation = extractRecommendationResult(result.context);
 * ```
 */

// 核心基础设施
export { 
  BaseAgent, 
  AgentContext, 
  AgentOrchestrator,
  executeRecommendationPipeline,
  extractRecommendationResult 
} from './core';

// 专用Agent
export {
  SemanticDistiller,
  PatternAnalyzer,
  VectorTranslator,
  CreativeCopywriter,
  ValidatorOptimizer
} from './specialized';
