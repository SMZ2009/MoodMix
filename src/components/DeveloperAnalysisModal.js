import React from 'react';
import { X, Clock, Activity, Zap, AlertTriangle, ChevronRight } from 'lucide-react';
import { Modal, InteractiveButton } from './ui';

/**
 * DeveloperAnalysisModal - 仪轨分析面板 (开发者时间线工具)
 * 
 * 展示 AgentOrchestrator 的执行轨迹、性能指标与每一步的具体动作。
 */
const DeveloperAnalysisModal = ({ isOpen, onClose, summary }) => {
    if (!isOpen || !summary) return null;

    const { totalDuration, trace = [], agentDurations = {} } = summary;

    // 整理时间线数据
    const timeline = trace.map((entry, index) => {
        const prevEntry = trace[index - 1];
        const offset = index === 0 ? 0 : entry.timestamp - trace[0].timestamp;

        // 解析具体显示逻辑
        let title = entry.key;
        let description = '';
        let duration = null;

        try {
            const data = entry.data ? JSON.parse(entry.data) : {};
            description = data.description || '';

            // 如果是 END 节点，尝试获取耗时
            if (entry.action.endsWith('_END')) {
                const startNode = [...trace].slice(0, index).reverse().find(t =>
                    t.key === entry.key && t.action.replace('_END', '_START') === t.action
                );
                if (startNode) {
                    duration = entry.timestamp - startNode.timestamp;
                }
            }
        } catch (e) {
            // 忽略解析错误
        }

        return {
            ...entry,
            offset,
            title,
            description,
            duration
        };
    });

    return (
        <Modal isOpen={isOpen} onClose={onClose} position="center">
            <div
                className="w-full max-w-2xl bg-[#fdfaf6] rounded-[2rem] overflow-hidden flex flex-col max-h-[85vh] shadow-2xl border border-[#e8dfc8]"
                style={{ fontFamily: '"Songti SC", "STKaiti", "KaiTi", serif' }}
            >
                {/* Header */}
                <div className="px-8 py-6 bg-white/50 backdrop-blur-md border-b border-[#e8dfc8] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#3c3b36] flex items-center justify-center text-[#ebdfc8]">
                            <Activity size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-[#3c3b36] tracking-wider">仪轨执行分析</h2>
                            <div className="flex items-center gap-2 mt-0.5 opacity-60">
                                <Clock size={12} />
                                <span className="text-xs">链路总耗时: {totalDuration}ms</span>
                            </div>
                        </div>
                    </div>
                    <InteractiveButton variant="icon" onClick={onClose} className="hover:bg-black/5">
                        <X size={20} />
                    </InteractiveButton>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 space-y-8">
                    {/* Summary Stats */}
                    <div className="grid grid-cols-3 gap-4">
                        <StatCard label="执行环节" value={Object.keys(agentDurations).length} unit="个" icon={<Zap className="text-amber-600" size={14} />} />
                        <StatCard label="轨迹记录" value={trace.length} unit="条" icon={<Activity className="text-blue-600" size={14} />} />
                        <StatCard label="系统负荷" value={totalDuration > 5000 ? '极高' : totalDuration > 3000 ? '偏高' : '顺畅'} unit=""
                            icon={<AlertTriangle className={totalDuration > 3000 ? 'text-red-500' : 'text-green-500'} size={14} />}
                            isWarning={totalDuration > 3000}
                        />
                    </div>

                    {/* Timeline */}
                    <div className="relative pl-6 border-l border-dashed border-[#d2c2a8] ml-2 mt-4">
                        {timeline.filter(t => t.action.includes('START') || t.action === 'PIPELINE_STEP' || t.action === 'WORKFLOW_START').map((step, idx) => {
                            const isBottleneck = step.duration > 2000;

                            return (
                                <div key={idx} className="relative mb-8 last:mb-0">
                                    {/* Dot */}
                                    <div className={`absolute -left-[31px] top-1.5 w-2.5 h-2.5 rounded-full border-2 bg-white ${isBottleneck ? 'border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'border-[#3c3b36]'}`} />

                                    <div className="flex flex-col">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-bold text-[#3c3b36] tracking-wide flex items-center gap-2">
                                                {step.title}
                                                {step.duration && (
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${isBottleneck ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                                                        {step.duration}ms
                                                    </span>
                                                )}
                                            </span>
                                            <span className="text-[10px] font-mono opacity-40">+{step.offset}ms</span>
                                        </div>

                                        {step.description && (
                                            <p className="text-xs mt-1.5 text-slate-500 leading-relaxed italic opacity-80">
                                                「 {step.description} 」
                                            </p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-8 py-4 bg-[#f7f3ed] border-t border-[#e8dfc8] flex justify-between items-center text-[10px] text-gray-400">
                    <span>MIXLAB AGENT ORCHESTRATOR v1.0.4</span>
                    <span className="flex items-center gap-1 uppercase tracking-tighter cursor-not-allowed">
                        View Full Trace <ChevronRight size={10} />
                    </span>
                </div>
            </div>
        </Modal>
    );
};

const StatCard = ({ label, value, unit, icon, isWarning }) => (
    <div className={`p-3 rounded-2xl border transition-colors ${isWarning ? 'bg-red-50 border-red-100' : 'bg-white border-[#e8dfc8]'}`}>
        <div className="flex items-center gap-1.5 opacity-60 mb-1">
            {icon}
            <span className="text-[10px] font-bold">{label}</span>
        </div>
        <div className="flex items-baseline gap-0.5">
            <span className={`text-lg font-bold ${isWarning ? 'text-red-700' : 'text-[#3c3b36]'}`}>{value}</span>
            <span className="text-[10px] opacity-40 font-bold">{unit}</span>
        </div>
    </div>
);

export default DeveloperAnalysisModal;
