/**
 * Agent: ComprehensiveAnalyzer - 全链路聚合分析师 (性能优化核心)
 * 
 * 职责：
 * 1. 一次性请求后端聚合接口 (/api/comprehensive_analyze)
 * 2. 同时获得：六维语义数据 + 中医辨证结论 + 八维特征向量
 * 3. 将结果透明地分发到上下文中间件中，模拟原有的级联产出
 */

import { BaseAgent } from '../core/BaseAgent';

export class ComprehensiveAnalyzer extends BaseAgent {
    constructor(config = {}) {
        super({
            name: 'ComprehensiveAnalyzer',
            timeout: 45000, // 聚合推理耗时较长，给足余量
            ...config
        });
    }

    /**
     * 输入验证
     */
    validateInput(context) {
        if (!context.userInput) {
            return { valid: false, reason: 'Missing userInput' };
        }
        return { valid: true };
    }

    /**
     * 核心处理：一次往返获取全部关键数据
     */
    async process(context) {
        const { userInput, currentTime } = context;

        try {
            this.log('INFO', '正在执行全链路聚合推理 (语义/辨证/向量)...');

            const response = await fetch('/api/comprehensive_analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_input: userInput,
                    current_time: currentTime
                })
            });

            if (!response.ok) {
                throw new Error(`聚合分析服务错误: ${response.status}`);
            }

            const result = await response.json();
            if (!result.success || !result.data) {
                throw new Error(result.error || '聚合分析失败');
            }

            const { moodData, patternAnalysis, vectorResult } = result.data;

            // 重要：将分析结果透明映射到上下文，模拟原有 Agent 链的产出
            // 这里的 Key 必须与原有 AgentOrchestrator 中预期的 Key 保持一致
            context.setIntermediate('moodData', moodData);
            context.setIntermediate('patternAnalysis', patternAnalysis);
            context.setIntermediate('vectorResult', vectorResult);

            this.log('SUCCESS', '全链路聚合推理完成，已提取所有关键维度数据');

            return result.data;

        } catch (error) {
            this.log('ERROR', `聚合推理失败: ${error.message}，系统将尝试回通原有流程或抛出异常`);
            throw error; // 交给编排器处理或触发全局降级
        }
    }

    /**
     * 输出验证：确保三核俱全
     */
    validateOutput(data) {
        if (!data || !data.moodData || !data.patternAnalysis || !data.vectorResult) {
            return { valid: false, reason: '聚合输出不完整' };
        }
        return { valid: true };
    }
}

export default ComprehensiveAnalyzer;
