/* ============================================================
   BrowserMCP Agent — popup.js
   ============================================================ */

'use strict';

// ─── DOM refs ────────────────────────────────────────────────────────────────
const log          = document.getElementById('log');
const promptInput  = document.getElementById('promptInput');
const btnRun       = document.getElementById('btnRun');
const btnSettings  = document.getElementById('btnSettings');
const settingsPanel= document.getElementById('settingsPanel');
const apiKeyInput  = document.getElementById('apiKeyInput');
const btnSaveKey   = document.getElementById('btnSaveKey');
const statusBadge  = document.getElementById('statusBadge');
const runIcon      = document.getElementById('runIcon');

let isRunning = false;
let currentTabId = null;

// ─── Init ────────────────────────────────────────────────────────────────────

async function init() {
  // Load saved API key
  const { openaiKey } = await chrome.storage.local.get('openaiKey');
  if (openaiKey) {
    apiKeyInput.value = openaiKey;
  } else {
    // Show settings on first use
    settingsPanel.removeAttribute('hidden');
    showNoKeyWarning();
  }

  // Side panel is attached to the current window — active tab is always correct
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabId = tab?.id || null;

  promptInput.focus();
}

function showNoKeyWarning() {
  const existing = document.querySelector('.no-key-warn');
  if (existing) return;
  const warn = document.createElement('div');
  warn.className = 'no-key-warn';
  warn.textContent = '⚠ Enter your OpenAI API key in Settings to get started.';
  const inputArea = document.querySelector('.input-area');
  inputArea.parentNode.insertBefore(warn, inputArea);
}

function removeNoKeyWarning() {
  document.querySelector('.no-key-warn')?.remove();
}

// ─── Settings ────────────────────────────────────────────────────────────────

btnSettings.addEventListener('click', () => {
  if (settingsPanel.hasAttribute('hidden')) {
    settingsPanel.removeAttribute('hidden');
  } else {
    settingsPanel.setAttribute('hidden', '');
  }
});

btnSaveKey.addEventListener('click', async () => {
  const key = apiKeyInput.value.trim();
  if (!key) return;
  await chrome.storage.local.set({ openaiKey: key });
  settingsPanel.setAttribute('hidden', '');
  removeNoKeyWarning();
  addLogEntry('done', '✓ API key saved.', 'System');
});

apiKeyInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') btnSaveKey.click();
});

// ─── Log entries ─────────────────────────────────────────────────────────────

const iconMap = {
  user:     '💬',
  thinking: '🧠',
  acting:   '⚡',
  done:     '✅',
  error:    '❌',
};

function addLogEntry(type, text, role, withSpinner = false) {
  // Remove welcome message on first real entry
  const welcome = log.querySelector('.log-welcome');
  if (welcome) welcome.remove();

  const entry = document.createElement('div');
  entry.className = `log-entry entry-${type}`;

  const roleLabel = role || ({
    user: 'You', thinking: 'Agent', acting: 'Agent', done: 'Done', error: 'Error',
  }[type] || type);

  entry.innerHTML = `
    <div class="log-icon">${iconMap[type] || '•'}</div>
    <div class="log-content">
      <div class="log-role">${roleLabel}</div>
      <div class="log-text">${escHtml(text)}${withSpinner ? '<span class="spinner"></span>' : ''}</div>
    </div>`;

  log.appendChild(entry);
  log.scrollTop = log.scrollHeight;
  return entry;
}

function updateLastEntry(entry, text, removeSpinner = true) {
  const textEl = entry.querySelector('.log-text');
  if (!textEl) return;
  textEl.innerHTML = escHtml(text) + (removeSpinner ? '' : '<span class="spinner"></span>');
  log.scrollTop = log.scrollHeight;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Status ──────────────────────────────────────────────────────────────────

function setStatus(s) {
  statusBadge.className = `badge badge-${s}`;
  const labels = { idle: 'Idle', thinking: 'Thinking', acting: 'Acting', done: 'Done', error: 'Error' };
  statusBadge.textContent = labels[s] || s;
}

// ─── Run agent ───────────────────────────────────────────────────────────────

let agentEntry = null;

async function runAgent() {
  if (isRunning) return;

  const prompt = promptInput.value.trim();
  if (!prompt) return;

  const { openaiKey } = await chrome.storage.local.get('openaiKey');
  if (!openaiKey) {
    settingsPanel.removeAttribute('hidden');
    addLogEntry('error', 'Please set your OpenAI API key first.');
    return;
  }

  if (!currentTabId) {
    addLogEntry('error', 'No active tab found. Please reload the extension.');
    return;
  }

  isRunning = true;
  btnRun.disabled = true;
  runIcon.textContent = '⏹';
  promptInput.value = '';

  addLogEntry('user', prompt);
  agentEntry = addLogEntry('thinking', 'Starting...', 'Agent', true);
  setStatus('thinking');

  chrome.runtime.sendMessage({
    type: 'RUN_AGENT',
    tabId: currentTabId,
    prompt,
    apiKey: openaiKey,
  });
}

// ─── Receive updates from background ─────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== 'AGENT_UPDATE') return;

  const { status, message } = msg;

  if (status === 'thinking') {
    if (agentEntry) updateLastEntry(agentEntry, message, false);
    else agentEntry = addLogEntry('thinking', message, 'Agent', true);
    setStatus('thinking');
  } else if (status === 'acting') {
    if (agentEntry) {
      updateLastEntry(agentEntry, message, false);
      agentEntry.className = 'log-entry entry-acting';
      agentEntry.querySelector('.log-role').textContent = 'Agent';
    }
    setStatus('acting');
  } else if (status === 'done') {
    if (agentEntry) {
      updateLastEntry(agentEntry, message, true);
      agentEntry.className = 'log-entry entry-done';
      agentEntry.querySelector('.log-role').textContent = 'Done';
    } else {
      addLogEntry('done', message);
    }
    agentEntry = null;
    setStatus('done');
    resetRunButton();
  } else if (status === 'error') {
    if (agentEntry) {
      updateLastEntry(agentEntry, message, true);
      agentEntry.className = 'log-entry entry-error';
      agentEntry.querySelector('.log-role').textContent = 'Error';
    } else {
      addLogEntry('error', message);
    }
    agentEntry = null;
    setStatus('error');
    resetRunButton();
  }
});

function resetRunButton() {
  isRunning = false;
  btnRun.disabled = false;
  runIcon.textContent = '▶';
}

// ─── Keyboard shortcuts ───────────────────────────────────────────────────────

btnRun.addEventListener('click', runAgent);

promptInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    runAgent();
  }
  // Auto-resize textarea
  setTimeout(() => {
    promptInput.style.height = 'auto';
    promptInput.style.height = Math.min(promptInput.scrollHeight, 100) + 'px';
  }, 0);
});

// ─── Boot ────────────────────────────────────────────────────────────────────

init();
