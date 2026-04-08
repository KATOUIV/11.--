/**
 * 回溯卷宗 / 叙事汇编（交互模式参考 mhjg，案卷语义独立）
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function showSherlockLoadSave(): void {
  try {
    if (typeof getLastMessageId === 'undefined' || typeof getChatMessages === 'undefined') {
      toastr.error('回溯卷宗须接入完整案卷环境。', '伦敦博弈场');
      return;
    }

    const lastMessageId = getLastMessageId();
    const messages = getChatMessages(`0-${lastMessageId}`, { role: 'assistant' });

    if (messages.length === 0) {
      toastr.warning('案卷中尚无可回溯的节点。', '伦敦博弈场');
      return;
    }

    const saveItems = messages
      .map(msg => {
        const messageContent = msg.message || '';
        const sumMatch = messageContent.match(/<sum>([\s\S]*?)<\/sum>/i);
        const sum = sumMatch ? sumMatch[1].trim() : '';
        return {
          message_id: msg.message_id,
          sum: sum || '(无摘要)',
        };
      })
      .filter(item => item.sum !== '(无摘要)');

    if (saveItems.length === 0) {
      toastr.warning('暂无带卷末摘要的可回溯回合', '伦敦博弈场');
      return;
    }

    const dialog = document.createElement('div');
    dialog.className = 'sherlock-dialog-overlay';
    dialog.innerHTML = `
      <div class="sherlock-dialog">
        <div class="sherlock-dialog-header">
          <h2 class="sherlock-dialog-title">回溯卷宗</h2>
          <button type="button" class="sherlock-dialog-close" id="sherlock-load-close" aria-label="关闭">×</button>
        </div>
        <div class="sherlock-dialog-body">
          ${saveItems
            .map(
              item => `
            <button type="button" class="sherlock-save-item" data-message-id="${item.message_id}">
              <div class="sherlock-save-summary">${escapeHtml(item.sum)}</div>
              <div class="sherlock-save-meta">卷宗序号 · ${item.message_id}</div>
            </button>`,
            )
            .join('')}
        </div>
      </div>`;
    document.body.appendChild(dialog);

    const closeDialog = () => dialog.remove();
    dialog.querySelector('#sherlock-load-close')?.addEventListener('click', e => {
      e.stopPropagation();
      closeDialog();
    });
    dialog.addEventListener('click', e => {
      if (e.target === dialog) closeDialog();
    });

    dialog.querySelectorAll('[data-message-id]').forEach(btn => {
      btn.addEventListener('click', async e => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-message-id');
        if (!id) return;
        closeDialog();
        try {
          await triggerSlash(`/branch-create ${id}`);
          window.location.reload();
        } catch (err) {
          console.error(err);
          toastr.error('回溯未能立卷，请稍后再试。', '伦敦博弈场');
        }
      });
    });
  } catch (error) {
    console.error('[Sherlock] showSherlockLoadSave', error);
    toastr.error('回溯未能立卷，请稍后再试。', '伦敦博弈场');
  }
}

export function showSherlockReviewStory(): void {
  try {
    if (typeof getLastMessageId === 'undefined' || typeof getChatMessages === 'undefined') {
      toastr.error('正文汇编须接入完整案卷环境。', '伦敦博弈场');
      return;
    }

    const lastMessageId = getLastMessageId();
    const messages = getChatMessages(`0-${lastMessageId}`, { role: 'assistant' });
    const blocks = messages
      .map(msg => {
        const m = (msg.message || '').match(/<maintext>([\s\S]*?)<\/maintext>/i);
        return m ? m[1].trim() : '';
      })
      .filter(Boolean);

    if (blocks.length === 0) {
      toastr.warning('尚未摘录到可汇编的叙事正文。', '伦敦博弈场');
      return;
    }

    const dialog = document.createElement('div');
    dialog.className = 'sherlock-dialog-overlay';
    dialog.innerHTML = `
      <div class="sherlock-dialog sherlock-dialog-wide">
        <div class="sherlock-dialog-header">
          <h2 class="sherlock-dialog-title">叙事汇编</h2>
          <button type="button" class="sherlock-dialog-close" id="sherlock-review-close" aria-label="关闭">×</button>
        </div>
        <div class="sherlock-dialog-body sherlock-dialog-scroll">
          ${blocks.map(t => `<p class="sherlock-review-block">${escapeHtml(t).replace(/\n/g, '<br/>')}</p>`).join('')}
        </div>
      </div>`;
    document.body.appendChild(dialog);

    const closeDialog = () => dialog.remove();
    dialog.querySelector('#sherlock-review-close')?.addEventListener('click', e => {
      e.stopPropagation();
      closeDialog();
    });
    dialog.addEventListener('click', e => {
      if (e.target === dialog) closeDialog();
    });
  } catch (error) {
    console.error('[Sherlock] showSherlockReviewStory', error);
    toastr.error('汇编未能展开，请稍后再试。', '伦敦博弈场');
  }
}
