/**
 * 首层消息若仍显示 `<StatusPlaceHolderImpl/>`，多为酒馆「正则替换」未作用于用户消息或未启用。
 * 本脚本在加载/切换聊天时，将占位符替换为指向 Sherlock 主界面的 iframe（需配置脚本变量 URL）。
 */
function getConfiguredIframeUrl(): string | null {
  try {
    const v = getVariables({ type: 'script', script_id: getScriptId() }) as {
      sherlock_iframe_url?: string;
    };
    const u = v?.sherlock_iframe_url?.trim();
    return u || null;
  } catch {
    return null;
  }
}

function buildIframeSnippet(src: string): string {
  const safe = src.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  /* 与 global.css 中 .sherlock-mvu-embed 一致：至少 800px，避免 min(88vh,900px) 在矮聊天区变成三四百像素 */
  /* allowfullscreen：否则 iframe 内 requestFullscreen 会被浏览器拒绝 */
  return `<iframe class="sherlock-mvu-embed" allow="fullscreen" allowfullscreen="allowfullscreen" style="width:100%;min-height:max(800px,min(88vh,900px));border:0;border-radius:12px;background:#0a0a0c;" src="${safe}" title="伦敦博弈场"></iframe>`;
}

async function patchPlaceholderInMessage0(): Promise<void> {
  if (typeof getChatMessages !== 'function' || typeof setChatMessages !== 'function' || typeof getLastMessageId !== 'function') {
    return;
  }
  const src = getConfiguredIframeUrl();
  if (!src) {
    return;
  }
  const last = getLastMessageId();
  if (last < 0) {
    return;
  }
  for (let i = 0; i <= last; i++) {
    const msgs = getChatMessages(i);
    if (!msgs?.length) {
      continue;
    }
    const m = msgs[0] as { message_id: number; message: string };
    if (!m.message || !/<StatusPlaceHolderImpl\s*\/?>/i.test(m.message)) {
      continue;
    }
    const newMessage = m.message.replace(/<StatusPlaceHolderImpl\s*\/?>/gi, buildIframeSnippet(src));
    if (newMessage === m.message) {
      continue;
    }
    await setChatMessages([{ message_id: i, message: newMessage }], { refresh: 'affected' });
    console.info(`[Sherlock 状态栏占位修复] 已将第 ${i} 层 <StatusPlaceHolderImpl/> 替换为 iframe`);
    return;
  }
}

function bindEvents(): void {
  const run = () => {
    errorCatched(() => void patchPlaceholderInMessage0())();
  };
  run();
  try {
    if (typeof eventOn !== 'undefined' && typeof tavern_events !== 'undefined') {
      const subReady = eventOn(tavern_events.APP_READY, run);
      const subChat = eventOn(tavern_events.CHAT_CHANGED, run);
      $(window).on('pagehide', () => {
        subReady.stop();
        subChat.stop();
      });
    }
  } catch {
    /* 非酒馆环境 */
  }
}

$(() => {
  errorCatched(bindEvents)();
});
