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

  function toast(text, failed = false) {
    dismissToast?.();
    document.getElementById('instagram-eagle-status')?.remove();
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
