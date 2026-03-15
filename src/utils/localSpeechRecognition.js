// 语音转文字功能已迁移到后端 API
// 使用 Qwen-2.5-7B-Instruct 模型进行语音识别
// 详见 server/llmProxy.js 中的 /api/speech-to-text 端点

export function isTranscriberReady() {
  return true;
}

export function isTranscriberLoading() {
  return false;
}
