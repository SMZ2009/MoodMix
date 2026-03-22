/**
 * 调试埋点：本地 Cursor ingest + 远程同源 API + 浏览器控制台（可复制）
 * Session ID 未提供时不传 sessionId。
 */

const INGEST_LOCAL = 'http://127.0.0.1:7693/ingest/adc81e44-f8f0-44ea-8bd0-d1a31dbda974';

export function debugIngest(payload) {
  const line = JSON.stringify({
    ...payload,
    timestamp: typeof payload.timestamp === 'number' ? payload.timestamp : Date.now(),
  });

  if (typeof window !== 'undefined') {
    console.log('__MM_DEBUG_NDJSON__', line);
  }

  fetch(INGEST_LOCAL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: line,
  }).catch(() => {});

  if (typeof window !== 'undefined' && window.location?.origin) {
    fetch(`${window.location.origin}/api/debug-ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: line,
    }).catch(() => {});
  }
}
