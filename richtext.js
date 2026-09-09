/* ============================================================
   richtext.js — a small contenteditable rich-text editor with an
   iOS-Notes-style toolbar (bold / italic / underline, bigger /
   smaller text, bullet / numbered lists), plus auto-grow-with-cap
   and an Expand/Collapse control for long entries.
   Shared by the Today page's Notes section and the Journal entry editor.
   ============================================================ */

function stripHtmlToText(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html || '';
  // Root cause of this needing real logic at all: a plain <textarea> (what this used to be)
  // stores line breaks as literal "\n" characters in its own value — the preview could just
  // read that string as-is. Once this became a contenteditable rich-text editor, line breaks
  // stopped being characters in the string at all and became HTML structure instead (<br>, or
  // each Enter-created line getting its own wrapping <div>/<p>) — so a plain textContent read
  // silently drops every line break. Fix: reconstruct one real "\n" per line break the person
  // actually typed, so the extracted string matches what a textarea's .value would have looked
  // like, and everything downstream (the .jc-text CSS below) can stay exactly as simple as it
  // was before rich text existed. Inserted BEFORE each block (not after) specifically because
  // contenteditable often leaves line 1 as a bare, unwrapped text node ahead of the first
  // <div> — anchoring to "after a block" misses that one boundary and glues line 1 to line 2.
  tmp.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
  tmp.querySelectorAll('div, p, li').forEach(block => block.insertAdjacentText('beforebegin', '\n'));
  let text = tmp.textContent || tmp.innerText || '';
  // cap a long run of blank lines so a note with dozens of them can't blow out a preview card —
  // .jc-text's white-space:pre-wrap renders these newlines as real, visible gaps, same as a
  // textarea's value always would have
  text = text.replace(/\n{4,}/g, '\n\n\n');
  return text.trim();
}

// entries written before this rich-text editor existed are plain text, not HTML. If a
// stored entry doesn't already look like markup, escape it and turn line breaks into <br>
// so any literal <, >, or & a person actually typed still displays exactly as it did before.
function normalizeStoredHtml(raw) {
  if (!raw) return '';
  const looksLikeHtml = /<[a-z][\s\S]*>/i.test(raw);
  if (looksLikeHtml) return raw;
  const escaped = String(raw).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  return escaped.replace(/\n/g, '<br>');
}

// el: the contenteditable div. toolbarEl: optional toolbar with [data-cmd] buttons.
// opts.capPx: height (px) the editor auto-grows to before the Expand button appears.
// opts.expandStorageKey: localStorage key remembering whether it's expanded.
// opts.onInput: fires after every edit or toolbar command.
function initRichTextEditor(el, toolbarEl, opts) {
  opts = opts || {};
  const CAP = opts.capPx || 260;
  const expandKey = opts.expandStorageKey || null;
  const expandBtn = opts.expandBtnEl || null;
  let expanded = expandKey ? localStorage.getItem(expandKey) === '1' : false;

  function isEmpty() {
    return (el.textContent || '').trim() === '' && !el.querySelector('img');
  }

  // a contenteditable that's visually empty can still hold a stray <br> — clear it
  // fully so the CSS placeholder (:empty) reliably shows again
  function enforceTrueEmpty() {
    if (isEmpty() && el.innerHTML !== '') el.innerHTML = '';
  }

  function autoSize() {
    el.style.height = 'auto';
    const full = el.scrollHeight;
    const target = expanded ? full : Math.min(full, CAP);
    el.style.height = target + 'px';
    if (expandBtn) {
      if (full > CAP) {
        expandBtn.style.display = 'flex';
        expandBtn.textContent = expanded ? '▴ Collapse' : '▾ Expand';
        el.classList.add('has-expand-btn'); // squares the textarea's bottom corners to flush-fit against the button — see styles.css
      } else {
        expandBtn.style.display = 'none';
        el.classList.remove('has-expand-btn');
      }
    }
  }

  if (expandBtn) {
    expandBtn.addEventListener('click', () => {
      expanded = !expanded;
      if (expandKey) localStorage.setItem(expandKey, expanded ? '1' : '0');
      autoSize();
    });
  }

  el.addEventListener('input', () => {
    enforceTrueEmpty();
    autoSize();
    if (opts.onInput) opts.onInput();
  });

  // wraps the current selection in a span with the given inline style — used for
  // bigger/smaller text since execCommand's legacy fontSize produces messy <font> tags
  function wrapSelectionWithStyle(styleCss) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    if (!el.contains(sel.anchorNode)) return;
    const range = sel.getRangeAt(0);
    const span = document.createElement('span');
    span.style.cssText = styleCss;
    try {
      range.surroundContents(span);
    } catch (e) {
      // selection crosses element boundaries (surroundContents needs a single parent) —
      // fall back to extract-then-wrap, which handles that case too
      const contents = range.extractContents();
      span.appendChild(contents);
      range.insertNode(span);
    }
    sel.removeAllRanges();
    const newRange = document.createRange();
    newRange.selectNodeContents(span);
    sel.addRange(newRange);
  }

  if (toolbarEl) {
    toolbarEl.querySelectorAll('button[data-cmd]').forEach(btn => {
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        el.focus();
        const cmd = btn.dataset.cmd;
        if (cmd === 'bigger') wrapSelectionWithStyle('font-size:1.22em;');
        else if (cmd === 'smaller') wrapSelectionWithStyle('font-size:0.82em;');
        else document.execCommand(cmd, false, null);
        enforceTrueEmpty();
        autoSize();
        if (opts.onInput) opts.onInput();
      });
    });
  }

  return {
    getHtml: () => (isEmpty() ? '' : el.innerHTML),
    setHtml: (html) => { el.innerHTML = html || ''; enforceTrueEmpty(); autoSize(); },
    isEmpty,
    autoSize,
  };
}
