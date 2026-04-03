/* ============================================================
   BrowserMCP Agent — background.js
   Service worker: runs the OpenAI agent loop.
   ============================================================ */

'use strict';

const MAX_ITERATIONS = 15;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// ─── OpenAI tool definitions ──────────────────────────────────────────────────

const BROWSER_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_page_content',
      description: 'Get the current page URL, title, visible text, and all interactive elements (buttons, links, inputs). Call this to understand what is on screen before acting.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'click',
      description: 'Click an element on the page. Provide selector (CSS) and/or text to identify it.',
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector of the element to click' },
          text: { type: 'string', description: 'Visible text of the element (used as fallback if selector fails)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'type_text',
      description: 'Type text into an input, search box, or textarea. Clears the field first by default.',
      parameters: {
        type: 'object',
        properties: {
          selector: { type: 'string', description: 'CSS selector of the input field' },
          text_hint: { type: 'string', description: 'Placeholder or label text to help find the field if selector fails' },
          text: { type: 'string', description: 'Text to type' },
          clear_first: { type: 'boolean', description: 'Whether to clear existing text first (default true)' },
        },
        required: ['text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'press_key',
      description: 'Press a keyboard key on the currently focused element.',
      parameters: {
        type: 'object',
        properties: {
          key: {
            type: 'string',
            enum: ['Enter', 'Tab', 'Escape', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Backspace', 'Space'],
            description: 'Key to press',
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
      description: 'Scroll the page in a direction.',
      parameters: {
        type: 'object',
        properties: {
          direction: { type: 'string', enum: ['up', 'down', 'top', 'bottom'], description: 'Scroll direction' },
          amount: { type: 'number', description: 'Pixels to scroll (default 400)' },
        },
        required: ['direction'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'navigate',
      description: 'Navigate the browser to a specific URL.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'Full URL to navigate to' },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'wait',
      description: 'Wait for a specified duration (useful after clicks that trigger loading).',
      parameters: {
        type: 'object',
        properties: {
          ms: { type: 'number', description: 'Milliseconds to wait (e.g. 1500)' },
        },
        required: ['ms'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'finish',
      description: 'Call this when the task is complete or you cannot proceed further.',
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Summary of what was accomplished or why the task stopped.' },
          success: { type: 'boolean', description: 'Whether the task was completed successfully.' },
        },
        required: ['message', 'success'],
      },
    },
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sendToPopup(tabId, type, payload) {
  chrome.runtime.sendMessage({ type, tabId, ...payload }).catch(() => {});
}

async function getTabContent(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      // Inline minimal version in case content script isn't injected yet
      const isVisible = el => {
        const s = window.getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden') return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      const elText = el => (el.innerText || el.textContent || el.value || el.placeholder || el.getAttribute('aria-label') || '').trim().slice(0, 100);
      const getSelector = el => {
        if (el.id) return `#${el.id}`;
        const parts = [];
        let cur = el;
        while (cur && cur !== document.body && parts.length < 4) {
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
      ['a', 'button', 'input', 'select', 'textarea', '[role="button"]'].forEach(tag => {
        document.querySelectorAll(tag).forEach(el => {
          if (seen.has(el) || !isVisible(el)) return;
          seen.add(el);
          const text = elText(el);
          if (!text && !el.placeholder) return;
          elements.push({
            tag: el.tagName.toLowerCase(),
            type: el.type || null,
            text,
            placeholder: el.placeholder || null,
            ariaLabel: el.getAttribute('aria-label') || null,
            selector: getSelector(el),
            value: ['INPUT','SELECT'].includes(el.tagName) ? el.value : null,
          });
        });
      });

      return {
        url: location.href,
        title: document.title,
        pageText: document.body?.innerText?.slice(0, 3000) || '',
        elements: elements.slice(0, 120),
        webmcpTools: [],
      };
    },
  });
  return results?.[0]?.result;
}

async function executeAction(tabId, tool, params) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (tool, params) => {
      // This runs in page context — content.js handles it via message
      // We use a direct function here for reliability
      async function findEl(selector, text) {
        if (selector) {
          try { const e = document.querySelector(selector); if (e) return e; } catch (_) {}
        }
        if (text) {
          const lower = text.toLowerCase();
          for (const tag of ['button','a','input','[role="button"]']) {
            for (const el of document.querySelectorAll(tag)) {
              const t = (el.innerText || el.textContent || el.value || el.placeholder || el.getAttribute('aria-label') || '').trim().toLowerCase();
              if (t.includes(lower)) return el;
            }
          }
        }
        return null;
      }

      function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

      async function run() {
        switch (tool) {
          case 'click': {
            const el = await findEl(params.selector, params.text);
            if (!el) return { success: false, error: `Not found: ${params.selector || params.text}` };
            el.scrollIntoView({ block: 'center' });
            await sleep(200);
            el.click();
            el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            return { success: true, message: `Clicked "${(el.innerText || el.textContent || '').trim().slice(0,60)}"` };
          }
          case 'type_text': {
            const el = await findEl(params.selector, params.text_hint);
            if (!el) return { success: false, error: `Input not found: ${params.selector}` };
            el.scrollIntoView({ block: 'center' });
            el.focus();
            await sleep(100);
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
            if (setter) setter.call(el, params.text);
            else el.value = params.text;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return { success: true, message: `Typed "${params.text}"` };
          }
          case 'press_key': {
            const el = document.activeElement || document.body;
            const k = params.key;
            ['keydown','keypress','keyup'].forEach(e => el.dispatchEvent(new KeyboardEvent(e, { key: k, bubbles: true })));
            return { success: true, message: `Pressed ${k}` };
          }
          case 'scroll': {
            const amt = params.amount || 400;
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
            await sleep(params.ms || 1000);
            return { success: true, message: `Waited ${params.ms}ms` };
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

// ─── OpenAI call ─────────────────────────────────────────────────────────────

async function callOpenAI(apiKey, messages, extraTools = []) {
  const tools = [...BROWSER_TOOLS, ...extraTools];
  const resp = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages,
      tools,
      tool_choice: 'auto',
      max_tokens: 1024,
    }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.error?.message || `OpenAI error ${resp.status}`);
  }
  return resp.json();
}

// ─── Agent loop ───────────────────────────────────────────────────────────────

async function runAgentLoop(tabId, prompt, apiKey) {
  const notify = (status, message, data) => sendToPopup(tabId, 'AGENT_UPDATE', { status, message, data });

  notify('thinking', 'Getting page content...');

  let pageContent;
  try {
    pageContent = await getTabContent(tabId);
  } catch (e) {
    notify('error', `Could not access page: ${e.message}`);
    return;
  }

  // Build dynamic WebMCP tools if page exposes them
  const extraTools = (pageContent.webmcpTools || []).map(t => ({
    type: 'function',
    function: { name: `webmcp_${t.name}`, description: t.description, parameters: t.schema || { type: 'object', properties: {} } },
  }));

  const systemPrompt = `You are an AI browser agent. You control a web browser by calling tools to click, type, scroll, and navigate.

The current page is:
URL: ${pageContent.url}
Title: ${pageContent.title}

Page text (first 2000 chars):
${pageContent.pageText.slice(0, 2000)}

Interactive elements on the page:
${JSON.stringify(pageContent.elements, null, 2)}

Instructions:
- Always call get_page_content first if you need to re-check the current state after an action
- Use CSS selectors from the elements list for clicking and typing
- After navigation or clicking something that loads new content, call wait (1000-2000ms) then get_page_content
- For search boxes, type_text first then press_key Enter
- Call finish when the task is done or if you cannot complete it
- Be efficient: don't repeat actions unnecessarily`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt },
  ];

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    notify('thinking', `Thinking... (step ${iter + 1})`);

    let response;
    try {
      response = await callOpenAI(apiKey, messages, extraTools);
    } catch (e) {
      notify('error', `OpenAI error: ${e.message}`);
      return;
    }

    const choice = response.choices?.[0];
    const msg = choice?.message;
    if (!msg) { notify('error', 'Empty response from OpenAI'); return; }

    messages.push(msg);

    // No tool calls → model gave a plain text response
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      notify('done', msg.content || 'Task complete.');
      return;
    }

    // Process tool calls
    for (const tc of msg.tool_calls) {
      const toolName = tc.function.name;
      let params = {};
      try { params = JSON.parse(tc.function.arguments); } catch (_) {}

      if (toolName === 'finish') {
        notify(params.success ? 'done' : 'error', params.message);
        return;
      }

      if (toolName === 'get_page_content') {
        notify('acting', 'Reading page content...');
        try {
          await sleep(500);
          const fresh = await getTabContent(tabId);
          messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(fresh) });
        } catch (e) {
          messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify({ error: e.message }) });
        }
        continue;
      }

      // WebMCP tool passthrough
      if (toolName.startsWith('webmcp_')) {
        const realName = toolName.replace(/^webmcp_/, '');
        notify('acting', `Calling WebMCP tool: ${realName}`);
        const result = await executeAction(tabId, 'call_webmcp_tool', { tool_name: realName, arguments: params });
        messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result || { error: 'no result' }) });
        continue;
      }

      // Browser action
      notify('acting', formatActionMessage(toolName, params));
      let result;
      try {
        result = await executeAction(tabId, toolName, params);
        // Wait after navigate/click for page to settle
        if (toolName === 'navigate' || toolName === 'click') {
          await sleep(1500);
        }
      } catch (e) {
        result = { success: false, error: e.message };
      }

      messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result || {}) });
    }
  }

  notify('error', 'Reached maximum steps without completing the task.');
}

function formatActionMessage(tool, params) {
  switch (tool) {
    case 'click': return `Clicking "${params.text || params.selector}"`;
    case 'type_text': return `Typing "${params.text}" into ${params.text_hint || params.selector || 'field'}`;
    case 'press_key': return `Pressing ${params.key}`;
    case 'scroll': return `Scrolling ${params.direction}`;
    case 'navigate': return `Navigating to ${params.url}`;
    case 'wait': return `Waiting ${params.ms}ms...`;
    default: return `Running: ${tool}`;
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Message handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'RUN_AGENT') {
    const { tabId, prompt, apiKey } = msg;
    runAgentLoop(tabId, prompt, apiKey)
      .catch(err => sendToPopup(tabId, 'AGENT_UPDATE', { status: 'error', message: err.message }));
    sendResponse({ started: true });
    return false;
  }
});
