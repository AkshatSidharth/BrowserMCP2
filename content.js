/* ============================================================
   BrowserMCP Agent — content.js
   Runs on every page. Captures page state + executes actions.
   ============================================================ */

'use strict';

// ─── Helpers ────────────────────────────────────────────────────────────────

function isVisible(el) {
  if (!el) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function getSelector(el) {
  if (el.id) return `#${CSS.escape(el.id)}`;
  const parts = [];
  let cur = el;
  while (cur && cur !== document.body) {
    let seg = cur.tagName.toLowerCase();
    if (cur.id) { seg = `#${CSS.escape(cur.id)}`; parts.unshift(seg); break; }
    const siblings = Array.from(cur.parentNode?.children || []).filter(c => c.tagName === cur.tagName);
    if (siblings.length > 1) seg += `:nth-of-type(${siblings.indexOf(cur) + 1})`;
    parts.unshift(seg);
    cur = cur.parentNode;
    if (parts.length > 5) break;
  }
  return parts.join(' > ');
}

function elText(el) {
  return (el.innerText || el.textContent || el.value || el.placeholder || el.getAttribute('aria-label') || el.getAttribute('title') || '').trim().slice(0, 120);
}

function elDescribe(el) {
  return {
    tag: el.tagName.toLowerCase(),
    type: el.type || null,
    text: elText(el),
    placeholder: el.placeholder || null,
    ariaLabel: el.getAttribute('aria-label') || null,
    name: el.name || null,
    href: el.href || null,
    selector: getSelector(el),
    value: el.tagName === 'INPUT' || el.tagName === 'SELECT' ? (el.value || null) : null,
  };
}

// ─── Page state capture ──────────────────────────────────────────────────────

function getPageContent() {
  const interactive = [];

  const tags = ['a', 'button', 'input', 'select', 'textarea', '[role="button"]', '[role="link"]', '[role="menuitem"]', '[role="option"]', '[tabindex]'];
  const seen = new Set();

  for (const tag of tags) {
    document.querySelectorAll(tag).forEach(el => {
      if (seen.has(el)) return;
      seen.add(el);
      if (!isVisible(el)) return;
      const desc = elDescribe(el);
      if (!desc.text && !desc.placeholder && !desc.ariaLabel) return;
      interactive.push(desc);
    });
  }

  // Limit to 120 elements to stay within token budget
  const trimmed = interactive.slice(0, 120);

  // Also get WebMCP tools if available
  let webmcpTools = [];
  try {
    if (navigator.modelContext && typeof navigator.modelContext.getTools === 'function') {
      webmcpTools = navigator.modelContext.getTools().map(t => ({
        name: t.name,
        description: t.description,
        schema: t.inputSchema,
      }));
    }
  } catch (_) {}

  return {
    url: location.href,
    title: document.title,
    pageText: document.body?.innerText?.slice(0, 3000) || '',
    elements: trimmed,
    webmcpTools,
  };
}

// ─── Action executor ─────────────────────────────────────────────────────────

async function findElement(selector, text) {
  // Try CSS selector first
  if (selector) {
    try {
      const el = document.querySelector(selector);
      if (el && isVisible(el)) return el;
    } catch (_) {}
  }

  // Fall back to text search across interactive elements
  if (text) {
    const tags = ['button', 'a', 'input', 'label', '[role="button"]'];
    for (const tag of tags) {
      const els = document.querySelectorAll(tag);
      for (const el of els) {
        if (!isVisible(el)) continue;
        const t = elText(el).toLowerCase();
        if (t.includes(text.toLowerCase())) return el;
      }
    }
    // Broader search
    const all = document.querySelectorAll('*');
    for (const el of all) {
      if (!isVisible(el)) continue;
      const t = elText(el).toLowerCase();
      if (t.includes(text.toLowerCase()) && ['A','BUTTON','INPUT','SELECT','TEXTAREA','SPAN','DIV'].includes(el.tagName)) {
        return el;
      }
    }
  }
  return null;
}

async function executeAction(action) {
  const { tool, params } = action;

  switch (tool) {

    case 'click': {
      const el = await findElement(params.selector, params.text);
      if (!el) return { success: false, error: `Element not found: selector="${params.selector}" text="${params.text}"` };
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(300);
      el.click();
      // Also dispatch mouse events for SPAs
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return { success: true, message: `Clicked: ${elText(el) || params.selector}` };
    }

    case 'type_text': {
      const el = await findElement(params.selector, params.text_hint);
      if (!el) return { success: false, error: `Input not found: ${params.selector}` };
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.focus();
      await sleep(200);
      if (params.clear_first !== false) {
        el.value = '';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
      // Simulate typing for React/Vue inputs
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(el, params.text);
      } else {
        el.value = params.text;
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return { success: true, message: `Typed "${params.text}" into ${params.selector}` };
    }

    case 'press_key': {
      const el = document.activeElement || document.body;
      const keyMap = {
        Enter: 'Enter', Tab: 'Tab', Escape: 'Escape',
        ArrowDown: 'ArrowDown', ArrowUp: 'ArrowUp',
        ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight',
        Backspace: 'Backspace', Space: ' ',
      };
      const key = keyMap[params.key] || params.key;
      el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      el.dispatchEvent(new KeyboardEvent('keypress', { key, bubbles: true }));
      el.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
      if (params.key === 'Enter' && el.form) el.form.dispatchEvent(new Event('submit', { bubbles: true }));
      return { success: true, message: `Pressed ${params.key}` };
    }

    case 'scroll': {
      const dir = params.direction;
      const amount = params.amount || 400;
      if (dir === 'top') window.scrollTo({ top: 0, behavior: 'smooth' });
      else if (dir === 'bottom') window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      else if (dir === 'down') window.scrollBy({ top: amount, behavior: 'smooth' });
      else if (dir === 'up') window.scrollBy({ top: -amount, behavior: 'smooth' });
      return { success: true, message: `Scrolled ${dir}` };
    }

    case 'navigate': {
      window.location.href = params.url;
      return { success: true, message: `Navigating to ${params.url}` };
    }

    case 'wait': {
      await sleep(params.ms || 1000);
      return { success: true, message: `Waited ${params.ms || 1000}ms` };
    }

    case 'get_page_content': {
      return { success: true, data: getPageContent() };
    }

    case 'call_webmcp_tool': {
      try {
        if (!navigator.modelContext) return { success: false, error: 'navigator.modelContext not available' };
        const result = await navigator.modelContext.callTool(params.tool_name, params.arguments);
        return { success: true, data: result };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }

    default:
      return { success: false, error: `Unknown action: ${tool}` };
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─── Message listener ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'GET_PAGE_CONTENT') {
    sendResponse({ success: true, data: getPageContent() });
    return false;
  }

  if (msg.type === 'EXECUTE_ACTION') {
    executeAction(msg.action)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // async
  }
});
