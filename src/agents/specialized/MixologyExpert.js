/**
 * Agent: MixologyExpert - 调饮专家
 * 
 * 职责：
 * 1. 深度分析饮品风味维度与向量
 * 2. 解决制作过程中的突发问题（原料替代、口味调整）
 * 3. 提供专业的调饮指导
 * 
 * 工作模式：
 * - ANALYZE: 分析自定义饮品
 * - ASSIST: 提供制作建议
 */

import { BaseAgent } from '../core/BaseAgent';

export class MixologyExpert extends BaseAgent {
    constructor(config = {}) {
        super({
            name: 'MixologyExpert',
            timeout: 35000, // 给予更充裕的分析时间
            maxRetries: 2,
            ...config
        });
    }

    /**
     * 输入验证
     */
    validateInput(context) {
        const taskType = context.getIntermediate('mixologyTaskType');
        const data = context.getIntermediate('mixologyData');

        if (!taskType) {
            return { valid: false, reason: 'MISSING_TASK_TYPE', userMessage: '未指定专家任务类型' };
        }

        if (!data) {
            return { valid: false, reason: 'MISSING_DATA', userMessage: '未提供任务所需数据' };
        }

        if (taskType === 'ANALYZE' && !data.name) {
            return { valid: false, reason: 'MISSING_DRINK_NAME', userMessage: '分析需要饮品名称' };
        }

        if (taskType === 'ASSIST' && (!data.drink || !data.question)) {
            return { valid: false, reason: 'MISSING_ASSIST_PARAMS', userMessage: '助手任务缺少饮品信息或问题' };
        }

        return { valid: true };
    }

    /**
     * 核心处理逻辑
     */
    async process(context) {
        const taskType = context.getIntermediate('mixologyTaskType');
        const data = context.getIntermediate('mixologyData');

        this.log('INFO', `Executing mixology task: ${taskType}`);

        if (taskType === 'ANALYZE') {
            return await this.fetchAnalysis(data);
        } else if (taskType === 'ASSIST') {
            return await this.fetchAssistance(data);
        }

        throw new Error(`Unknown task type: ${taskType}`);
    }

    /**
     * 调用风味分析 API
     */
    async fetchAnalysis(data) {
        const response = await fetch('/api/generate-drink-dimensions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error(`分析服务响应异常: ${response.status}`);
        }

        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || '分析失败');
        }

        return result;
    }

    /**
     * 调用制作助手 API
     */
    async fetchAssistance(data) {
        const response = await fetch('/api/drink-assistant', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error(`制作助手服务响应异常: ${response.status}`);
        }

        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || '获取建议失败');
        }

        return {
            answer: result.answer,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * 错误处理与降级
     */
    async handleError(error, context) {
        const taskType = context.getIntermediate('mixologyTaskType');

        if (taskType === 'ANALYZE') {
            this.log('WARN', 'Analysis failed, providing neutral default dimensions');
            // 降级：返回标准中性值
            return {
                success: true,
                isDegraded: true,
                vector: [5, 0, 0, 3, 12, 5, 0, 2], // 预设的中性平衡向量
                dimensions: {
                    sweetness: { value: 5, label: "适中" },
                    sourness: { value: 3, label: "轻微" },
                    bitterness: { value: 1, label: "极低" },
                    temperature: { value: 0, label: "常温" },
                    aroma: { value: 5, label: "清香" },
                    texture: { value: 0, label: "平衡" },
                    strength: { value: 0, label: "无酒精" }
                },
                reasoning: "AI 老师开小差了，已为您应用经典平衡配比，您可以稍后手动微调。"
            };
        }

        return null; // ASSIST 模式暂不提供自动降级，由 UI 处理
    }
}

export default MixologyExpert;
