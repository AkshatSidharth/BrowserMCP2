/* ============================================================
   BrowserMCP Agent — background.js
   Service worker: runs the OpenAI agent loop with vision.
   ============================================================ */

'use strict';

const MAX_ITERATIONS = 20;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// ─── OpenAI tool definitions ──────────────────────────────────────────────────

const BROWSER_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'screenshot',
      description: 'Take a screenshot of the current page and analyze it visually. Use this to understand what is on screen — especially when the page has popups, redirects, dialogs, or dynamic content that is hard to parse from DOM alone. Always take a screenshot at the start and after any major action.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_page_content',
      description: 'Get the current page URL, title, visible text, and all interactive elements (buttons, links, inputs) with their CSS selectors. Use this to get exact selectors for clicking and typing.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'click',
      description: 'Click an element. Provide the CSS selector from get_page_content, and optionally visible text as a fallback.',
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector of the element' },
          text: { type: 'string', description: 'Visible text of the element (fallback if selector fails)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'type_text',
      description: 'Type text into an input or search box. Always focus the field first by clicking it, then call type_text.',
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector of the input' },
          text_hint: { type: 'string', description: 'Placeholder or label text to find field by' },
          text: { type: 'string', description: 'Text to type' },
          clear_first: { type: 'boolean', description: 'Clear existing text first (default true)' },
        },
        required: ['text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'press_key',
      description: 'Press a keyboard key on the focused element.',
      parameters: {
        type: 'object',
        properties: {
          key: {
            type: 'string',
            enum: ['Enter', 'Tab', 'Escape', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Backspace', 'Space'],
          },
        },
        required: ['key'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'scroll',
      description: 'Scroll the page.',
      parameters: {
        type: 'object',
        properties: {
          direction: { type: 'string', enum: ['up', 'down', 'top', 'bottom'] },
          amount: { type: 'number', description: 'Pixels (default 400)' },
        },
        required: ['direction'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'navigate',
      description: 'Navigate to a URL.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string' },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'wait',
      description: 'Wait for the page to load or animations to finish.',
      parameters: {
        type: 'object',
        properties: {
          ms: { type: 'number', description: 'Milliseconds to wait' },
        },
        required: ['ms'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'dismiss_dialog',
      description: 'Dismiss any modal, popup, overlay, location dialog, notification prompt, or cookie banner visible on the page.',
      parameters: {
        type: 'object',
        properties: {
          strategy: {
            type: 'string',
            enum: ['escape', 'close_button', 'skip_button', 'backdrop_click'],
            description: 'How to dismiss: press Escape, click a close/X button, click a skip/cancel button, or click the backdrop behind the dialog.',
          },
        },
        required: ['strategy'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'finish',
      description: 'Call when the task is done or truly cannot be completed.',
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          success: { type: 'boolean' },
        },
        required: ['message', 'success'],
      },
    },
  },
];

// ─── Screenshot ───────────────────────────────────────────────────────────────

async function captureScreenshot(tabId) {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 75 });
    return dataUrl; // base64 data URL
  } catch (e) {
    return null;
  }
}

// ─── Page content ─────────────────────────────────────────────────────────────

async function getTabContent(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const isVisible = el => {
        const s = window.getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) < 0.1) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };

      const elText = el => (
        el.innerText || el.textContent || el.value || el.placeholder ||
        el.getAttribute('aria-label') || el.getAttribute('title') || ''
      ).trim().slice(0, 120);

      const getSelector = el => {
        if (el.id) return `#${CSS.escape(el.id)}`;
        // Try data-testid attributes common on e-commerce sites
        for (const attr of ['data-testid', 'data-test', 'data-id', 'data-component-id']) {
          const val = el.getAttribute(attr);
          if (val) return `[${attr}="${CSS.escape(val)}"]`;
        }
        const parts = [];
        let cur = el;
        while (cur && cur !== document.body && parts.length < 5) {
          if (cur.id) { parts.unshift(`#${CSS.escape(cur.id)}`); break; }
          let seg = cur.tagName.toLowerCase();
          const sibs = Array.from(cur.parentNode?.children || []).filter(c => c.tagName === cur.tagName);
          if (sibs.length > 1) seg += `:nth-of-type(${sibs.indexOf(cur) + 1})`;
          parts.unshift(seg);
          cur = cur.parentNode;
        }
        return parts.join(' > ');
      };

      const elements = [];
      const seen = new Set();
      const tags = ['a[href]', 'button', 'input', 'select', 'textarea',
                    '[role="button"]', '[role="link"]', '[role="menuitem"]',
                    '[role="option"]', '[role="tab"]', '[role="checkbox"]'];

      for (const tag of tags) {
        document.querySelectorAll(tag).forEach(el => {
          if (seen.has(el) || !isVisible(el)) return;
          seen.add(el);
          const text = elText(el);
          if (!text && !el.placeholder && !el.getAttribute('aria-label')) return;
          elements.push({
            tag: el.tagName.toLowerCase(),
            type: el.type || null,
            text: text.slice(0, 80),
            placeholder: el.placeholder || null,
            ariaLabel: el.getAttribute('aria-label') || null,
            href: el.href ? el.href.slice(0, 100) : null,
            selector: getSelector(el),
            value: ['INPUT','SELECT'].includes(el.tagName) ? el.value : null,
          });
        });
      }

      return {
        url: location.href,
        title: document.title,
        pageText: document.body?.innerText?.slice(0, 4000) || '',
        elements: elements.slice(0, 150),
      };
    },
  });
  return results?.[0]?.result;
}

// ─── Action executor ──────────────────────────────────────────────────────────

async function executeAction(tabId, tool, params) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (tool, params) => {
      function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

      function isVisible(el) {
        if (!el) return false;
        const s = window.getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden') return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      }

      function elText(el) {
        return (el.innerText || el.textContent || el.value || el.placeholder || el.getAttribute('aria-label') || '').trim();
      }

      async function findEl(selector, textFallback) {
        // 1. Try exact CSS selector
        if (selector) {
          try {
            const el = document.querySelector(selector);
            if (el && isVisible(el)) return el;
          } catch (_) {}
        }

        // 2. Text search across interactive elements
        if (textFallback) {
          const lower = textFallback.toLowerCase().trim();
          const candidates = [
            ...document.querySelectorAll('button'),
            ...document.querySelectorAll('a'),
            ...document.querySelectorAll('[role="button"]'),
            ...document.querySelectorAll('input'),
            ...document.querySelectorAll('[role="link"]'),
          ];
          // Exact match first
          for (const el of candidates) {
            if (!isVisible(el)) continue;
            if (elText(el).toLowerCase() === lower) return el;
          }
          // Partial match
          for (const el of candidates) {
            if (!isVisible(el)) continue;
            if (elText(el).toLowerCase().includes(lower)) return el;
          }
          // Broader: any visible element
          const all = document.querySelectorAll('*');
          for (const el of all) {
            if (!isVisible(el)) continue;
            const children = el.children.length;
            if (children > 3) continue; // skip containers
            if (elText(el).toLowerCase().includes(lower)) return el;
          }
        }
        return null;
      }

      // Robust React-compatible typing
      function reactType(el, text) {
        el.focus();
        // Clear
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set ||
                             Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
        if (nativeSetter) {
          nativeSetter.call(el, '');
          el.dispatchEvent(new Event('input', { bubbles: true }));
          nativeSetter.call(el, text);
        } else {
          el.value = text;
        }
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
      }

      async function run() {
        switch (tool) {

          case 'click': {
            const el = await findEl(params.selector, params.text);
            if (!el) return { success: false, error: `Element not found — selector: "${params.selector}", text: "${params.text}"` };
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await sleep(300);
            // Fire full mouse event sequence
            const rect = el.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            ['mouseover','mouseenter','mousemove','mousedown','mouseup','click'].forEach(type => {
              el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: cx, clientY: cy }));
            });
            el.click();
            return { success: true, message: `Clicked: "${elText(el).slice(0, 60)}"` };
          }

          case 'type_text': {
            const el = await findEl(params.selector, params.text_hint);
            if (!el) return { success: false, error: `Input not found — selector: "${params.selector}"` };
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await sleep(200);
            reactType(el, params.text);
            return { success: true, message: `Typed "${params.text}"` };
          }

          case 'press_key': {
            const el = document.activeElement || document.body;
            const key = params.key;
            const code = { Enter: 'Enter', Tab: 'Tab', Escape: 'Escape', Space: 'Space',
                           ArrowDown: 'ArrowDown', ArrowUp: 'ArrowUp',
                           ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight',
                           Backspace: 'Backspace' }[key] || key;
            ['keydown','keypress','keyup'].forEach(t =>
              el.dispatchEvent(new KeyboardEvent(t, { key, code, bubbles: true, cancelable: true }))
            );
            // Submit form on Enter
            if (key === 'Enter') {
              const form = el.closest('form');
              if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
            }
            return { success: true, message: `Pressed ${key}` };
          }

          case 'scroll': {
            const amt = params.amount || 500;
            if (params.direction === 'top') window.scrollTo({ top: 0, behavior: 'smooth' });
            else if (params.direction === 'bottom') window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            else if (params.direction === 'down') window.scrollBy({ top: amt, behavior: 'smooth' });
            else window.scrollBy({ top: -amt, behavior: 'smooth' });
            return { success: true, message: `Scrolled ${params.direction}` };
          }

          case 'navigate': {
            window.location.href = params.url;
            return { success: true, message: `Navigating to ${params.url}` };
          }

          case 'wait': {
            await sleep(params.ms || 1500);
            return { success: true, message: `Waited ${params.ms}ms` };
          }

          case 'dismiss_dialog': {
            const strategy = params.strategy;

            if (strategy === 'escape') {
              document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
              return { success: true, message: 'Pressed Escape to dismiss' };
            }

            // Look for close/X/skip buttons
            const closePatterns = ['close', '✕', '×', 'x', 'skip', 'cancel', 'no thanks', 'not now', 'dismiss', 'got it', 'ok', 'continue'];
            if (strategy === 'close_button' || strategy === 'skip_button') {
              const btns = [...document.querySelectorAll('button, [role="button"], a, [aria-label*="close" i], [aria-label*="dismiss" i]')];
              for (const pattern of closePatterns) {
                for (const btn of btns) {
                  if (!isVisible(btn)) continue;
                  const t = elText(btn).toLowerCase();
                  if (t === pattern || t.includes(pattern)) {
                    btn.click();
                    return { success: true, message: `Clicked "${elText(btn)}" to dismiss` };
                  }
                }
              }
              return { success: false, error: 'No close/skip button found' };
            }

            if (strategy === 'backdrop_click') {
              // Click center of screen where backdrop usually is
              const overlays = document.querySelectorAll('[class*="overlay" i],[class*="backdrop" i],[class*="modal" i]');
              for (const el of overlays) {
                if (!isVisible(el)) continue;
                const rect = el.getBoundingClientRect();
                // Click top-right area (where X buttons typically are)
                el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: rect.right - 20, clientY: rect.top + 20 }));
                return { success: true, message: 'Clicked backdrop to dismiss' };
              }
              // Last resort: click top of screen
              document.elementFromPoint(window.innerWidth - 30, 30)?.click();
              return { success: true, message: 'Clicked backdrop area' };
            }

            return { success: false, error: 'Unknown dismiss strategy' };
          }

          default:
            return { success: false, error: `Unknown tool: ${tool}` };
        }
      }

      return run();
    },
    args: [tool, params],
  });
  return results?.[0]?.result;
}

// ─── OpenAI call with vision ──────────────────────────────────────────────────

async function callOpenAI(apiKey, messages, extraTools = []) {
  const tools = [...BROWSER_TOOLS, ...extraTools];
  const resp = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      tools,
      tool_choice: 'auto',
      max_tokens: 1500,
    }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.error?.message || `OpenAI error ${resp.status}`);
  }
  return resp.json();
}

// ─── Agent loop ───────────────────────────────────────────────────────────────

async function runAgentLoop(tabId, prompt, apiKey, model = 'gpt-4o') {
  const notify = (status, message) => sendToPopup(tabId, 'AGENT_UPDATE', { status, message });

  notify('thinking', 'Taking screenshot of page...');

  const systemPrompt = `You are an expert AI browser agent. You control a real web browser by calling tools.

Your capabilities:
- screenshot: See the current page visually (use this often!)
- get_page_content: Get CSS selectors for elements to click/type
- click: Click buttons, links, dropdowns
- type_text: Type into search boxes and inputs
- press_key: Press Enter, Escape, Arrow keys etc.
- scroll: Scroll the page
- navigate: Go to a URL directly
- dismiss_dialog: Close popups, location dialogs, modals, cookie banners
- finish: End the task

Critical rules:
1. ALWAYS take a screenshot first to see the page
2. If you see ANY popup, dialog, modal, or overlay — dismiss it FIRST before doing anything else
3. After every action that changes the page, take another screenshot to verify
4. For search: click the search box → type_text → press_key Enter
5. For Flipkart/Amazon: if you see a location dialog, dismiss it (Escape or close button)
6. If a click fails, try with the text parameter instead of selector
7. Be persistent — if one approach fails, try another
8. Do NOT give up on redirects — navigate back or dismiss and retry
9. Only call finish when you've truly completed the task or exhausted all options`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt },
  ];

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    notify('thinking', `Step ${iter + 1} — thinking...`);

    let response;
    try {
      response = await callOpenAI(apiKey, messages);
    } catch (e) {
      notify('error', `OpenAI error: ${e.message}`);
      return;
    }

    const choice = response.choices?.[0];
    const msg = choice?.message;
    if (!msg) { notify('error', 'Empty response from OpenAI'); return; }

    messages.push(msg);

    // Plain text response (no tools)
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      notify('done', msg.content || 'Task complete.');
      return;
    }

    // Execute tool calls
    for (const tc of msg.tool_calls) {
      const toolName = tc.function.name;
      let params = {};
      try { params = JSON.parse(tc.function.arguments); } catch (_) {}

      if (toolName === 'finish') {
        notify(params.success ? 'done' : 'error', params.message);
        return;
      }

      if (toolName === 'screenshot') {
        notify('acting', 'Taking screenshot...');
        await sleep(600);
        const dataUrl = await captureScreenshot(tabId);
        if (dataUrl) {
          // Send screenshot as a vision message
          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: 'Screenshot taken.',
          });
          // Add the image as a follow-up user message so GPT-4o can see it
          messages.push({
            role: 'user',
            content: [
              { type: 'text', text: 'Here is the current screenshot of the browser:' },
              { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
            ],
          });
        } else {
          messages.push({ role: 'tool', tool_call_id: tc.id, content: 'Screenshot failed — use get_page_content instead.' });
        }
        continue;
      }

      if (toolName === 'get_page_content') {
        notify('acting', 'Reading page elements...');
        try {
          await sleep(500);
          const fresh = await getTabContent(tabId);
          messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(fresh) });
        } catch (e) {
          messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify({ error: e.message }) });
        }
        continue;
      }

      // Browser actions
      notify('acting', formatActionMessage(toolName, params));
      let result;
      try {
        result = await executeAction(tabId, toolName, params);
        if (toolName === 'navigate') await sleep(2500);
        else if (toolName === 'click') await sleep(1200);
        else if (toolName === 'dismiss_dialog') await sleep(800);
      } catch (e) {
        result = { success: false, error: e.message };
      }

      messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result || {}) });
    }
  }

  notify('error', 'Reached maximum steps. Try breaking the task into smaller steps.');
}

function formatActionMessage(tool, params) {
  switch (tool) {
    case 'click': return `Clicking "${params.text || params.selector}"`;
    case 'type_text': return `Typing "${params.text}"`;
    case 'press_key': return `Pressing ${params.key}`;
    case 'scroll': return `Scrolling ${params.direction}`;
    case 'navigate': return `Navigating to ${params.url}`;
    case 'wait': return `Waiting ${params.ms}ms...`;
    case 'dismiss_dialog': return `Dismissing dialog (${params.strategy})`;
    default: return `Running: ${tool}`;
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function sendToPopup(tabId, type, payload) {
  chrome.runtime.sendMessage({ type, tabId, ...payload }).catch(() => {});
}

// ─── Side Panel setup ─────────────────────────────────────────────────────────
// Opens the agent as a side panel docked to the right of the active tab.

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
});

// ─── Message handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'RUN_AGENT') {
    const { tabId, prompt, apiKey, model } = msg;
    runAgentLoop(tabId, prompt, apiKey, model)
      .catch(err => sendToPopup(tabId, 'AGENT_UPDATE', { status: 'error', message: err.message }));
    sendResponse({ started: true });
    return false;
  }
});
