/* Shared, dependency-free UI primitives for Instagram content scripts. */
(() => {
  if (globalThis.EagleUI) return;

  const downloadPath = 'M12 3v12m-5-5 5 5 5-5M3 15v5a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-5';
  const batchPath = 'M7 3h12a2 2 0 0 1 2 2v12M5 7h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Zm5 3v8m-3-3 3 3 3-3';
  const ownedSelector = '[data-eagle-control],[data-eagle-group],[data-eagle-profile-tile],#instagram-eagle-status';
  let dismissToast = null;

  function icon(path, className = '') {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    if (className) svg.setAttribute('class', className);
    const shape = document.createElementNS(svg.namespaceURI, 'path');
    shape.setAttribute('d', path);
    svg.append(shape);
    return svg;
  }

  function downloadIcon() {
    return icon(downloadPath);
  }

  // Centered prompt, a third of the way down the window, for a closed Eagle. It shares the toast's slot, so any later notice replaces it.
  function offlineDialog() {
    const box = document.createElement('div');
    box.id = 'instagram-eagle-status';
    box.style.cssText = 'all:initial;position:fixed;inset:33vh auto auto 50%;transform:translateX(-50%);z-index:2147483647;display:block;width:min(380px,calc(100vw - 32px));box-sizing:border-box;color-scheme:dark';
    const shadow = box.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = `
      .dialog{padding:18px 18px 16px;border:1px solid #ffffff2e;border-radius:12px;background:#232627;color:#f0f1f1;box-shadow:0 10px 36px #0006;font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;animation:eagle-dialog-in 160ms ease-out}
      h2{margin:0 0 6px;font:600 16px/1.3 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      p{margin:0;color:#c9cdce;overflow-wrap:anywhere}
      .actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;margin-top:14px}
      a,button{all:unset;box-sizing:border-box;padding:7px 14px;border-radius:7px;font-weight:600;cursor:pointer}
      a{background:#a5d5b7;color:#16201a}a:hover{background:#bce3ca}
      button{color:#f0f1f1;background:#ffffff14}button:hover{background:#ffffff24}
      a:focus-visible,button:focus-visible{outline:2px solid #a5d5b7;outline-offset:2px}
      @keyframes eagle-dialog-in{from{opacity:0;margin-top:-6px}to{opacity:1;margin-top:0}}
      @media(prefers-reduced-motion:reduce){.dialog{animation:none}}
    `;
    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialog.setAttribute('role', 'alertdialog');
    dialog.setAttribute('aria-labelledby', 'title');
    dialog.setAttribute('aria-describedby', 'description');
    const title = document.createElement('h2');
    title.id = 'title';
    title.textContent = "Eagle isn't open";
    const description = document.createElement('p');
    description.id = 'description';
    description.append(document.createElement('slot'));
    // A real link keeps the click's user gesture, and needs no permission or frame on Instagram's page.
    const open = document.createElement('a');
    open.href = 'eagle://open';
    open.textContent = 'Open Eagle';
    const later = document.createElement('button');
    later.type = 'button';
    later.textContent = 'Not now';
    const actions = document.createElement('div');
    actions.className = 'actions';
    actions.append(later, open);
    dialog.append(title, description, actions);
    shadow.append(style, dialog);
    let timer;
    const onKey = event => {
      if (event.key !== 'Escape') return;
      // Escape belongs to this prompt, not to an Instagram post viewer underneath it.
      event.preventDefault();
      event.stopPropagation();
      dismiss();
    };
    const dismiss = () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKey, true);
      box.remove();
      if (dismissToast === dismiss) dismissToast = null;
    };
    // Instagram must not treat clicks here as clicks outside its post viewer.
    dialog.addEventListener('click', event => event.stopPropagation());
    later.addEventListener('click', dismiss);
    open.addEventListener('click', () => {
      setTimeout(() => {
        if (dismissToast !== dismiss) return;
        title.textContent = 'Opening Eagle…';
        box.textContent = 'If your browser asks, allow it. Click download again once Eagle has loaded.';
        open.remove();
        later.textContent = 'Dismiss';
        later.focus({ preventScroll: true });
        timer = setTimeout(dismiss, 10000);
      });
    });
    window.addEventListener('keydown', onKey, true);
    dismissToast = dismiss;
    document.documentElement.append(box);
    box.textContent = 'Open Eagle to save this to your library. Once it has loaded, click download again.';
    open.focus({ preventScroll: true });
  }

  function toast(text, failed = false, code = '') {
    // The early prompt already answered this click; the user may have acted on it.
    if (code === 'eagle-prompted') return;
    dismissToast?.();
    document.getElementById('instagram-eagle-status')?.remove();
    if (code === 'eagle-offline') return offlineDialog();
    const box = document.createElement('div');
    box.id = 'instagram-eagle-status';
    box.style.cssText = 'all:initial;position:fixed;inset:auto 16px 16px auto;z-index:2147483647;display:block;width:max-content;max-width:min(320px,calc(100vw - 32px));box-sizing:border-box;color-scheme:dark';
    const shadow = box.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = `
      .notice{display:flex;align-items:flex-start;gap:9px;padding:11px 10px 11px 12px;border:1px solid #ffffff24;border-radius:10px;background:#232627;color:#f0f1f1;box-shadow:0 4px 18px #0003;font:13px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;animation:eagle-notice-in 140ms ease-out}
      .status{width:17px;height:17px;flex:none;margin-top:1px;color:${failed ? '#f0ac9c' : '#a5d5b7'}}
      .message{min-width:0;flex:1;overflow-wrap:anywhere;max-height:min(240px,50vh);overflow:auto}
      button{all:unset;display:grid;place-items:center;box-sizing:border-box;flex:none;width:24px;height:24px;margin:-3px -3px -3px 1px;border-radius:5px;color:#a5abad;cursor:pointer}
      button:hover{color:#fff;background:#ffffff12}button:focus-visible{outline:2px solid #a5d5b7;outline-offset:1px}
      button svg{width:14px;height:14px}svg{fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
      @keyframes eagle-notice-in{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
      @media(prefers-reduced-motion:reduce){.notice{animation:none}}
    `;
    const notice = document.createElement('div');
    notice.className = 'notice';
    const message = document.createElement('div');
    message.className = 'message';
    message.setAttribute('role', 'status');
    message.setAttribute('aria-live', 'polite');
    message.setAttribute('aria-atomic', 'true');
    message.append(document.createElement('slot'));
    const close = document.createElement('button');
    close.type = 'button';
    close.setAttribute('aria-label', 'Dismiss Eagle notification');
    close.append(icon('M6 6l12 12M18 6 6 18'));
    notice.append(
      icon(failed ? 'M12 8v5m0 3h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18' : 'M5 12l4 4L19 6', 'status'),
      message,
      close
    );
    shadow.append(style, notice);
    let timer;
    let hovering = false;
    let focused = false;
    const dismiss = () => {
      clearTimeout(timer);
      box.remove();
      if (dismissToast === dismiss) dismissToast = null;
    };
    const arm = () => {
      clearTimeout(timer);
      if (!hovering && !focused) timer = setTimeout(dismiss, failed ? 8000 : 3000);
    };
    close.addEventListener('click', event => {
      event.stopPropagation();
      dismiss();
    });
    box.addEventListener('pointerenter', () => {
      hovering = true;
      clearTimeout(timer);
    });
    box.addEventListener('pointerleave', () => {
      hovering = false;
      arm();
    });
    box.addEventListener('focusin', () => {
      focused = true;
      clearTimeout(timer);
    });
    box.addEventListener('focusout', () => {
      focused = false;
      arm();
    });
    dismissToast = dismiss;
    document.documentElement.append(box);
    box.textContent = String(text);
    arm();
  }

  globalThis.EagleUI = { toast, icon, downloadIcon, downloadPath, batchPath, ownedSelector };
})();
