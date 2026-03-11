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
            console.log(`│    - 五行: ${moodData.emotion.philosophy.wuxing}`);
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
 * 带回调的逐步执行方法
 * 每完成一个Agent就触发回调，实现实时进度更新
 */
AgentOrchestrator.prototype.executeWithCallback = async function(context, onStepComplete, onWorkflowStart) {
  const workflow = this.workflow;
  
  onWorkflowStart?.({ workflow, context });
  
  const results = [];
  
  for (let i = 0; i < workflow.length; i++) {
    const agentName = workflow[i];
    const agent = this.agents.get(agentName);
    const nextAgent = workflow[i + 1] || null;
    
    if (!agent) continue;
    
    // 标记当前 Agent 开始
    onStepComplete?.(agentName, { status: 'running' }, context, null);
    
    const result = await agent.execute(context);
    context.setOutput(agentName, result);
    results.push({ agent: agentName, ...result });
    
    // 标记完成，传入下一个 Agent
    onStepComplete?.(agentName, result, context, nextAgent);
    
    // VectorTranslator 完成后，插入 VectorSearch 步骤
    if (agentName === 'VectorTranslator' && result.success) {
      onStepComplete?.('VectorSearch', { status: 'running' }, context, null);
      
      try {
        const { evaluateAndSortDrinks } = await import('../../engine/vectorEngine');
        const moodData = context.getIntermediate('moodData');
        const allDrinks = context.allDrinks;
        const inventory = context.inventory;
        
        if (moodData && allDrinks?.length > 0) {
          const pool = evaluateAndSortDrinks(moodData, allDrinks, inventory);
          const matches = pool.map((drink, idx) => ({
            drink,
            similarity: drink.similarity || (1 - idx * 0.05),
            rank: idx + 1,
            matchDetails: { weightedScore: drink.similarity, bonus: drink.bonus || 0 }
          }));
          context.setIntermediate('matches', matches);
        }
      } catch (err) {
        console.error('VectorSearch failed:', err);
        context.setIntermediate('matches', []);
      }
      
      onStepComplete?.('VectorSearch', { success: true, status: 'done' }, context, 'CreativeCopywriter');
    }
    
    if (!result.success && !result.recovered) break;
  }
  
  return { results, context };
};

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
  
  // 导入实体提取和池过滤模块
  const { extractEntities } = await import('../../engine/entityExtractor');
  const { filterDrinkPool } = await import('../../engine/poolFilter');

  // 检查饮品数据
  const allDrinksOriginal = options.allDrinks || [];
  if (allDrinksOriginal.length === 0) {
    console.warn('⚠️ [Pipeline] allDrinks is empty - recommendations may fail');
  }

  // ========== 前置过滤：实体提取 + 候选池筛选 ==========
  console.log('\n┌─ Entity Extraction ─────────────────────────────────────────┐');
  
  // 分离用户输入和原料信息（原料信息在换行符后）
  const [pureUserInput, inventoryInfo] = userInput.split('\n');
  const cleanUserInput = (pureUserInput || userInput).trim();
  
  // 1. 实体提取（仅对纯用户输入）
  const entities = extractEntities(cleanUserInput);
  console.log('│ 📝 实体提取结果:');
  if (entities.drinkNames.length > 0) {
    console.log(`│    - 饮品名: ${entities.drinkNames.map(e => e.matched).join(', ')}`);
  }
  if (entities.categories.length > 0) {
    console.log(`│    - 品类: ${entities.categories.map(e => e.matched).join(', ')}`);
  }
  if (entities.flavors.length > 0) {
    console.log(`│    - 风味: ${entities.flavors.map(e => e.matched).join(', ')}`);
  }
  if (entities.remainingInput) {
    console.log(`│    - 情绪描述: "${entities.remainingInput}"`);
  }
  if (entities.drinkNames.length === 0 && entities.categories.length === 0 && entities.flavors.length === 0) {
    console.log('│    - (未检测到饮品实体，将使用纯情绪匹配)');
  }
  console.log(`│    - 置信度: ${Math.round(entities.confidence * 100)}%`);
  
  // 2. 候选池过滤
  const filterResult = filterDrinkPool(allDrinksOriginal, entities);
  
  console.log('│');
  console.log(`│ 🔍 过滤结果: ${filterResult.stats?.total || allDrinksOriginal.length} → ${filterResult.filtered.length} 款`);
  if (filterResult.filterApplied) {
    console.log(`│    - 过滤原因: ${filterResult.reason}`);
    if (filterResult.stats?.topMatches) {
      console.log('│    - Top匹配:');
      filterResult.stats.topMatches.slice(0, 3).forEach(m => {
        console.log(`│      · ${m.name} (${m.score}分) ${m.reasons.join(', ')}`);
      });
    }
  } else {
    console.log(`│    - ${filterResult.reason === 'no_entities_detected' ? '无实体检测，使用全量池' : '回退到全量池'}`);
  }
  
  console.log(`└${'─'.repeat(56)}┘`);

  // 3. 决定传递给情绪分析的输入
  // 如果有剩余情绪描述，用它；否则用纯用户输入
  let inputForMoodAnalysis = entities.remainingInput || cleanUserInput;
  
  // 重新附加原料信息（如果有）
  if (inventoryInfo) {
    inputForMoodAnalysis += '\n' + inventoryInfo;
  }
  
  // 创建上下文
  const context = new AgentContext({
    userInput: inputForMoodAnalysis,           // 传递剩余情绪部分给情绪分析
    originalInput: userInput,                   // 保留原始输入
    inventory: options.inventory || [],
    allDrinks: filterResult.filtered,           // 使用过滤后的候选池
    currentTime: options.currentTime || new Date().toISOString()
  });
  
  // 存储实体提取结果到上下文，供后续Agent使用
  context.setIntermediate('extractedEntities', entities);
  context.setIntermediate('filterApplied', filterResult.filterApplied);
  context.setIntermediate('originalPoolSize', allDrinksOriginal.length);
  context.setIntermediate('filteredPoolSize', filterResult.filtered.length);

  // 创建编排器
  const orchestrator = new AgentOrchestrator();
  
  // 注册所有Agent
  orchestrator
    .register(new SemanticDistiller())
    .register(new PatternAnalyzer())
    .register(new VectorTranslator())
    .register(new CreativeCopywriter())
    .register(new ValidatorOptimizer());

  // 定义工作流（只包含前3个Agent，向量搜索后再执行剩余Agent）
  orchestrator.defineWorkflow([
    'SemanticDistiller',
    'PatternAnalyzer', 
    'VectorTranslator'
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
    
    // 继续执行剩余Agent（仅当有匹配结果时）
    const matches = context.getIntermediate('matches');
    if (matches && matches.length > 0) {
      // 执行文案生成
      const copywriter = orchestrator.agents.get('CreativeCopywriter');
      if (copywriter) {
        const copyResult = await copywriter.execute(context);
        context.setOutput('CreativeCopywriter', copyResult);
        orchestrator.printStageResult('CreativeCopywriter', copyResult, context);
      }
      
      // 执行验证优化
      const validator = orchestrator.agents.get('ValidatorOptimizer');
      if (validator) {
        let validationResult = await validator.execute(context);
        context.setOutput('ValidatorOptimizer', validationResult);
        orchestrator.printStageResult('ValidatorOptimizer', validationResult, context);
        
        // 处理验证结果 - 重试逻辑
        const validation = context.getIntermediate('validationReport');
        
        if (validation?.shouldRetry && !context.hasRetried) {
          console.log('\n┌─ Retry Attempt ──────────────────────────────────────────┐');
          console.log('│ 🔄 质量评分较低，尝试调整权重重新匹配...');
          context.hasRetried = true;
          
          // 调整权重 - 提高匹配度权重
          const vectorResult = context.getIntermediate('vectorResult');
          if (vectorResult?.weights) {
            const adjustedWeights = vectorResult.weights.map((w, i) => {
              // 提高口味和香气维度的权重
              if (i === 0 || i === 5) return Math.min(0.2, w * 1.2);
              return w * 0.95;
            });
            // 归一化
            const sum = adjustedWeights.reduce((a, b) => a + b, 0);
            vectorResult.weights = adjustedWeights.map(w => w / sum);
            context.setIntermediate('vectorResult', vectorResult);
          }
          
          // 重新执行向量搜索
          try {
            const { evaluateAndSortDrinks } = await import('../../engine/vectorEngine');
            const moodData = context.getIntermediate('moodData');
            const pool = evaluateAndSortDrinks(moodData, context.allDrinks, context.inventory);
            
            const newMatches = pool.map((drink, idx) => ({
              drink,
              similarity: drink.similarity || (1 - idx * 0.05),
              rank: idx + 1,
              matchDetails: { weightedScore: drink.similarity, bonus: drink.bonus || 0, isRetry: true }
            }));
            
            context.setIntermediate('matches', newMatches);
            console.log(`│ ✅ 重试后找到 ${newMatches.length} 个匹配饮品`);
            
            // 重新验证
            validationResult = await validator.execute(context);
            context.setOutput('ValidatorOptimizer', validationResult);
            orchestrator.printStageResult('ValidatorOptimizer', validationResult, context);
          } catch (retryError) {
            console.error('│ ❌ 重试失败:', retryError.message);
          }
          
          console.log(`└${'─'.repeat(56)}┘`);
        }
        
        // 检查是否需要降级处理
        const finalValidation = context.getIntermediate('validationReport');
        if (finalValidation?.qualityLevel === 'poor' && !finalValidation?.shouldBlock) {
          console.log('│ ⚡ 质量较低，使用降级策略 - 按相似度排序');
          // 降级策略：结果已经是按相似度排序的，只需记录状态
          finalValidation.isDegraded = true;
          context.setIntermediate('validationReport', finalValidation);
        }
      }
    } else {
      console.log('│ ⚠️ 跳过文案生成Agent，因为没有匹配结果');
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
