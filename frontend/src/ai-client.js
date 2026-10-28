// Shared chat rules, independent of rendering; no credentials are stored here.
export function canSendMessage(question, busy, capabilities) {
  return !busy && (capabilities?.configured === true || capabilities?.system_reports === true) && Boolean(question?.trim());
}

export function conversationHistory(messages) {
  return messages.filter(m => !m.failed && !m.pending && m.text?.trim())
    .slice(-10).map(m => ({role: m.role, content: m.text}));
}

export function apiErrorMessage(detail, status) {
  if (detail && typeof detail.message === 'string') return detail.message;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const messages = detail.map(e => e?.msg).filter(m => typeof m === 'string');
    if (messages.length) return messages.join('; ');
  }
  return `Yêu cầu không thành công (HTTP ${status}). Vui lòng thử lại.`;
}

export async function fetchJson(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {...options, signal: options.signal || controller.signal});
    let body;
    try { body = await response.json(); } catch {
      throw new Error('Máy chủ trả về dữ liệu không hợp lệ. Vui lòng kiểm tra kết nối backend.');
    }
    if (!response.ok) {
      const error = new Error(apiErrorMessage(body.detail, response.status));
      error.status = response.status;
      error.code = typeof body.detail?.code==='string' ? body.detail.code : undefined;
      error.retryable = body.detail?.retryable===true;
      throw error;
    }
    return body;
  } catch (error) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      throw new Error('Kết nối quá thời gian chờ. Bạn có thể gửi lại câu hỏi.');
    }
    if (error instanceof TypeError) throw new Error('Không kết nối được backend. Vui lòng kiểm tra mạng và máy chủ.');
    throw error;
  } finally { clearTimeout(timer); }
}

export function resolveApiUrl(configuredUrl, location) {
  return (configuredUrl || `${location.protocol}//${location.hostname}:8000/api`).replace(/\/$/,'');
}
