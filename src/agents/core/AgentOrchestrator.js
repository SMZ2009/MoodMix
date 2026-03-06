/**
 * AgentOrchestrator - Agent编排器
 * 
 * 职责：
 * 1. 管理Agent执行顺序和依赖关系
 * 2. 协调Agent间的数据流转
 * 3. 提供工作流级别的错误处理
 * 4. 收集和报告执行指标
 */

import { AgentContext } from './AgentContext';

export class AgentOrchestrator {
  constructor() {
    this.agents = new Map();
    this.workflow = [];
  }

  /**
   * 注册Agent
   */
  register(agent) {
    this.agents.set(agent.name, agent);
    return this;
  }

  /**
   * 定义工作流（Agent执行顺序）
   */
  defineWorkflow(agentNames) {
    this.workflow = agentNames.filter(name => this.agents.has(name));
    return this;
  }

  /**
   * 执行完整工作流
   */
  async execute(context) {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║              MoodMix Multi-Agent Workflow Started            ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log(`\n📋 Workflow: ${this.workflow.join(' → ')}\n`);

    const results = [];

    for (const agentName of this.workflow) {
      const agent = this.agents.get(agentName);
      if (!agent) {
        console.warn(`Agent ${agentName} not found, skipping...`);
        continue;
      }

      // 执行Agent
      const result = await agent.execute(context);
      results.push(result);

      // 存储输出到上下文
      context.setOutput(agentName, result);

      // 如果Agent失败且不可恢复，中断工作流
      if (!result.success && !result.recovered) {
        console.error(`\n❌ Workflow interrupted at ${agentName}`);
        break;
      }

      // 打印阶段结果
      this.printStageResult(agentName, result, context);
    }

    // 打印工作流摘要
    this.printWorkflowSummary(context, results);

    return {
      success: results.every(r => r.success || r.recovered),
      results,
      context
    };
  }

  /**
   * 打印阶段执行结果
   */
  printStageResult(agentName, result, context) {
    console.log(`\n┌─ ${agentName} ─${'─'.repeat(50 - agentName.length)}┐`);
    
    if (result.success) {
      console.log(`│ ✅ Success (${result.duration}ms)`);
      
      // 根据Agent类型打印关键输出
      switch (agentName) {
        case 'SemanticDistiller':
          console.log('│ 📊 六维分析结果:');
          const moodData = result.data;
          if (moodData?.emotion?.physical?.state) {
            console.log(`│    - 情绪: ${moodData.emotion.physical.state}`);
          }
          if (moodData?.emotion?.philosophy?.wuxing) {
            console.log(`│    - 五行: ${moodData.emotion.phosophy.wuxing}`);
          }
          break;
          
        case 'PatternAnalyzer':
          console.log('│ 🔮 辨证分析:');
          const analysis = result.data;
          if (analysis?.diagnosis) {
            console.log(`│    - 诊断: ${analysis.diagnosis}`);
          }
          if (analysis?.strategy) {
            console.log(`│    - 策略: ${analysis.strategy}`);
          }
          break;
          
        case 'VectorTranslator':
          console.log('│ 📐 向量映射:');
          const vector = result.data;
          if (vector?.targetVector) {
            console.log(`│    - 目标向量: [${vector.targetVector.slice(0, 4).join(', ')}...]`);
          }
          if (vector?.weights) {
            console.log(`│    - 动态权重: [${vector.weights.slice(0, 4).join(', ')}...]`);
          }
          break;
          
        case 'CreativeCopywriter':
          console.log('│ ✍️ 创意文案:');
          const copy = result.data;
          if (copy?.quote) {
            console.log(`│    - 推荐语: ${copy.quote.substring(0, 30)}...`);
          }
          break;
          
        case 'ValidatorOptimizer':
          console.log('│ ✅ 验证报告:');
          const validation = result.data;
          if (validation?.score !== undefined) {
            console.log(`│    - 质量评分: ${validation.score}/100`);
          }
          if (validation?.issues?.length > 0) {
            console.log(`│    - 发现问题: ${validation.issues.length}个`);
          }
          break;
        
        default:
          break;
      }
    } else {
      console.log(`│ ❌ Failed: ${result.error}`);
      if (result.userMessage) {
        console.log(`│ 💬 ${result.userMessage}`);
      }
    }
    
    console.log(`└${'─'.repeat(56)}┘`);
  }

  /**
   * 打印工作流摘要
   */
  printWorkflowSummary(context, results) {
    const summary = context.getExecutionSummary();
    
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    Workflow Summary                          ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log(`║ 总耗时: ${summary.totalDuration}ms`);
    console.log(`║ Agent执行: ${results.filter(r => r.success).length}/${results.length} 成功`);
    
    // 检查是否有降级/超时情况
    const usedFallback = context.getIntermediate('usedFallback');
    const timeoutOccurred = context.getIntermediate('timeoutOccurred');
    if (usedFallback || timeoutOccurred) {
      console.log('╠══════════════════════════════════════════════════════════════╣');
      console.log('║ 🔧 降级情况:');
      if (timeoutOccurred) {
        console.log('║    - API响应超时，已使用本地降级分析');
      }
      if (usedFallback) {
        console.log('║    - 部分Agent使用了降级方案');
      }
    }
    
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
  }
}

/**
 * 快速执行推荐流程的辅助函数
 */
export async function executeRecommendationPipeline(userInput, options = {}) {
  const { 
    SemanticDistiller 
  } = await import('../specialized/SemanticDistiller');
  const { 
    PatternAnalyzer 
  } = await import('../specialized/PatternAnalyzer');
  const { 
    VectorTranslator 
  } = await import('../specialized/VectorTranslator');
  const { 
    CreativeCopywriter 
  } = await import('../specialized/CreativeCopywriter');
  const { 
    ValidatorOptimizer 
  } = await import('../specialized/ValidatorOptimizer');

  // 创建上下文
  const context = new AgentContext({
    userInput,
    inventory: options.inventory || [],
    allDrinks: options.allDrinks || [],
    currentTime: options.currentTime || new Date().toISOString()
  });

  // 创建编排器
  const orchestrator = new AgentOrchestrator();
  
  // 注册所有Agent
  orchestrator
    .register(new SemanticDistiller())
    .register(new PatternAnalyzer())
    .register(new VectorTranslator())
    .register(new CreativeCopywriter())
    .register(new ValidatorOptimizer());

  // 定义工作流
  orchestrator.defineWorkflow([
    'SemanticDistiller',
    'PatternAnalyzer', 
    'VectorTranslator',
    'CreativeCopywriter',
    'ValidatorOptimizer'
  ]);

  // 执行工作流前3个Agent
  const result = await orchestrator.execute(context);
  
  // 如果前3个Agent成功，执行向量搜索（纯数学计算，非Agent）
  if (result.success) {
    console.log('\n┌─ Vector Search ──────────────────────────────────────────────┐');
    console.log('│ 🔍 执行加权余弦相似度计算...');
    
    try {
      const { evaluateAndSortDrinks } = await import('../../engine/vectorEngine');
      const moodData = context.getIntermediate('moodData');
      const allDrinks = context.allDrinks;
      const inventory = context.inventory;
      
      if (moodData && allDrinks && allDrinks.length > 0) {
        const pool = evaluateAndSortDrinks(moodData, allDrinks, inventory);
        
        // 转换为matches格式
        const matches = pool.map((drink, idx) => ({
          drink,
          similarity: drink.similarity || (1 - idx * 0.05),
          rank: idx + 1,
          matchDetails: {
            weightedScore: drink.similarity,
            bonus: drink.bonus || 0
          }
        }));
        
        context.setIntermediate('matches', matches);
        console.log(`│ ✅ 找到 ${matches.length} 个匹配饮品`);
        if (matches.length > 0) {
          console.log(`│    - 最佳匹配: ${matches[0].drink.name} (${Math.round(matches[0].similarity * 100)}%)`);
        }
      } else {
        console.log('│ ⚠️ 缺少数据，跳过向量搜索');
        context.setIntermediate('matches', []);
      }
    } catch (error) {
      console.error('│ ❌ 向量搜索失败:', error.message);
      context.setIntermediate('matches', []);
    }
    
    console.log(`└${'─'.repeat(56)}┘`);
    
    // 继续执行剩余Agent
    const remainingWorkflow = ['CreativeCopywriter', 'ValidatorOptimizer'];
    for (const agentName of remainingWorkflow) {
      const agent = orchestrator.agents.get(agentName);
      if (agent) {
        const agentResult = await agent.execute(context);
        context.setOutput(agentName, agentResult);
        orchestrator.printStageResult(agentName, agentResult, context);
      }
    }
  }
  
  return result;
}

/**
 * 提取推荐结果
 */
export function extractRecommendationResult(context) {
  return context.getRecommendationResult();
}

export default AgentOrchestrator;
