/* ============================================================
   Awesome WebMCP — script.js
   Interactivity + WebMCP tool registration
   ============================================================ */

'use strict';

// ─── Resource Data (mirrors the HTML content) ──────────────────────────────

const RESOURCES = [
  // Section 1 – Official Specs & Documentation
  {
    id: 'webmcp-spec',
    section: 'specs',
    sectionName: 'Official Specs & Documentation',
    title: 'WebMCP Spec (W3C Community Group Draft)',
    description: 'Full IDL, tool registration, schemas, and security model.',
    url: 'https://webmachinelearning.github.io/webmcp',
    tags: ['official', 'spec'],
  },
  {
    id: 'webmcp-github-repo',
    section: 'specs',
    sectionName: 'Official Specs & Documentation',
    title: 'WebMCP GitHub Repo',
    description: 'Spec source, issues, and the declarative explainer PR.',
    url: 'https://github.com/webmachinelearning/webmcp',
    tags: ['official', 'spec'],
  },
  {
    id: 'awesome-webmcp-official',
    section: 'specs',
    sectionName: 'Official Specs & Documentation',
    title: 'Awesome WebMCP (Official)',
    description: 'Curated list maintained by the Web Machine Learning Community Group.',
    url: 'https://github.com/webmachinelearning/awesome-webmcp',
    tags: ['official', 'community'],
  },
  {
    id: 'chrome-epp',
    section: 'specs',
    sectionName: 'Official Specs & Documentation',
    title: 'Chrome Early Preview Announcement',
    description: 'How WebMCP fits into Chrome 146+.',
    url: 'https://developer.chrome.com/blog/webmcp-epp',
    tags: ['official', 'chrome'],
  },
  {
    id: 'chrome-usage',
    section: 'specs',
    sectionName: 'Official Specs & Documentation',
    title: 'Chrome WebMCP Usage Guide',
    description: 'Agent integration details and practical usage patterns.',
    url: 'https://developer.chrome.com/blog/webmcp-mcp-usage',
    tags: ['official', 'chrome'],
  },
  {
    id: 'mcp-core-spec',
    section: 'specs',
    sectionName: 'Official Specs & Documentation',
    title: 'Model Context Protocol (MCP) Core Spec',
    description: 'The server-side counterpart that WebMCP brings to the browser.',
    url: 'https://modelcontextprotocol.io/specification/latest',
    tags: ['official', 'mcp', 'spec'],
  },

  // Section 2 – Getting Started & Browser Setup
  {
    id: 'mct-inspector-ext',
    section: 'setup',
    sectionName: 'Getting Started & Browser Setup',
    title: 'Model Context Tool Inspector',
    description: 'Official GoogleChromeLabs tool for debugging schemas, testing tool calls, and visualizing registered tools.',
    url: 'https://chromewebstore.google.com/detail/model-context-tool-inspec/gbpdfapgefenggkahomfgkhfehlcenpd',
    tags: ['official', 'chrome', 'extension', 'tool'],
  },
  {
    id: 'mcp-b-extension',
    section: 'setup',
    sectionName: 'Getting Started & Browser Setup',
    title: 'MCP-B Chrome Extension',
    description: 'Bridges desktop MCP agents with in-browser WebMCP tools + polyfill support.',
    url: 'https://chromewebstore.google.com/detail/mcp-b-extension/daohopfhkdelnpemnhlekblhnikhdhfa',
    tags: ['extension', 'mcp', 'chrome'],
  },

  // Section 3 – Tutorials & Hands-On Guides
  {
    id: 'mcpb-tutorials',
    section: 'tutorials',
    sectionName: 'Tutorials & Hands-On Guides',
    title: 'MCP-B Tutorials',
    description: 'Best practical series: vanilla HTML, React (useWebMCP hook), native Chrome preview, desktop agent relay.',
    url: 'https://docs.mcp-b.ai/tutorials',
    tags: ['tutorial', 'react'],
  },
  {
    id: 'codely-tutorial',
    section: 'tutorials',
    sectionName: 'Tutorials & Hands-On Guides',
    title: 'Codely: What is WebMCP and How to Use It',
    description: 'Excellent declarative + imperative breakdown with real-site examples.',
    url: 'https://codely.com/en/blog/what-is-webmcp-and-how-to-use-it',
    tags: ['tutorial'],
  },
  {
    id: 'betterstack-guide',
    section: 'tutorials',
    sectionName: 'Tutorials & Hands-On Guides',
    title: 'BetterStack Complete Guide',
    description: 'Deep dive with a flight-booking example app.',
    url: 'https://betterstack.com/community/guides/ai/webmcp-ai-web/',
    tags: ['tutorial', 'ai'],
  },
  {
    id: 'mcpb-howto',
    section: 'tutorials',
    sectionName: 'Tutorials & Hands-On Guides',
    title: 'MCP-B How-To Guides',
    description: 'Adoption strategies, existing app integration, runtimes (native vs polyfill vs global).',
    url: 'https://docs.mcp-b.ai/how-to',
    tags: ['tutorial'],
  },

  // Section 4 – Libraries, SDKs & Polyfills
  {
    id: 'mcpb-docs',
    section: 'libraries',
    sectionName: 'Libraries, SDKs & Polyfills',
    title: 'MCP-B Documentation',
    description: 'Polyfill, types, React hooks, transports, and iframe bridging.',
    url: 'https://docs.mcp-b.ai/',
    tags: ['library', 'react', 'mcp'],
  },
  {
    id: 'mcpb-npm',
    section: 'libraries',
    sectionName: 'Libraries, SDKs & Polyfills',
    title: 'MCP-B npm Packages',
    description: 'Source for @mcp-b/webmcp-polyfill, @mcp-b/webmcp-types, usewebmcp, @mcp-b/global.',
    url: 'https://github.com/WebMCP-org/npm-packages',
    tags: ['library', 'react'],
  },
  {
    id: 'webmcp-react',
    section: 'libraries',
    sectionName: 'Libraries, SDKs & Polyfills',
    title: 'webmcp-react',
    description: 'React hooks for exposing typed tools via navigator.modelContext. Zod-first schemas, built-in polyfill, SSR-compatible, StrictMode-safe.',
    url: 'https://github.com/MCPCat/webmcp-react',
    tags: ['library', 'react', 'typescript'],
  },
  {
    id: 'webmcp-kit',
    section: 'libraries',
    sectionName: 'Libraries, SDKs & Polyfills',
    title: 'webmcp-kit',
    description: 'Zod-typed tool definitions, ideal for modern TypeScript/React apps.',
    url: 'https://github.com/victorhuangwq/webmcp-kit',
    tags: ['library', 'typescript'],
  },
  {
    id: 'webmcp-next',
    section: 'libraries',
    sectionName: 'Libraries, SDKs & Polyfills',
    title: 'webmcp-next',
    description: 'Next.js plugin that auto-exposes API routes and server actions as WebMCP tools. Zero-config withWebMCP() wrapper.',
    url: 'https://github.com/dankelleher/next-webmcp',
    tags: ['library', 'nextjs'],
  },
  {
    id: 'webmcp-widget',
    section: 'libraries',
    sectionName: 'Libraries, SDKs & Polyfills',
    title: 'WebMCP Widget Library',
    description: 'One-line script tag for quick demos and prototyping.',
    url: 'https://webmcp.dev',
    tags: ['library'],
  },

  // Section 5 – Demos & Example Projects
  {
    id: 'demo-bistro',
    section: 'demos',
    sectionName: 'Demos & Example Projects',
    title: 'Le Petit Bistro',
    description: 'Restaurant booking demo using the declarative API.',
    url: 'https://googlechromelabs.github.io/webmcp-tools/demos/french-bistro/',
    tags: ['demo', 'official'],
  },
  {
    id: 'demo-flights',
    section: 'demos',
    sectionName: 'Demos & Example Projects',
    title: 'React Flight Search',
    description: 'Flight search with imperative tool registration.',
    url: 'https://googlechromelabs.github.io/webmcp-tools/demos/react-flightsearch/',
    tags: ['demo', 'official', 'react'],
  },
  {
    id: 'demo-pizza',
    section: 'demos',
    sectionName: 'Demos & Example Projects',
    title: 'ZaMaker Pizza Builder',
    description: 'Custom pizza ordering via imperative API.',
    url: 'https://googlechromelabs.github.io/webmcp-tools/demos/pizza-maker/',
    tags: ['demo', 'official'],
  },
  {
    id: 'demo-maze',
    section: 'demos',
    sectionName: 'Demos & Example Projects',
    title: 'WebMCP Maze',
    description: 'Full agent-driven maze navigation game.',
    url: 'https://googlechromelabs.github.io/webmcp-tools/demos/webmcp-maze/',
    tags: ['demo', 'official', 'game', 'ai'],
  },
  {
    id: 'demo-doors',
    section: 'demos',
    sectionName: 'Demos & Example Projects',
    title: 'Mystery Doors',
    description: 'Interactive puzzle with AI agent collaboration.',
    url: 'https://googlechromelabs.github.io/webmcp-tools/demos/doors/',
    tags: ['demo', 'official', 'ai'],
  },
  {
    id: 'demo-airbird',
    section: 'demos',
    sectionName: 'Demos & Example Projects',
    title: 'Air Bird Booking',
    description: 'Agent-native flight + accommodation booking. 10x fewer tokens than DOM scraping.',
    url: 'https://github.com/hugozanini/air-bird-booking-web-mcp',
    tags: ['demo', 'ai'],
  },
  {
    id: 'demo-shoe',
    section: 'demos',
    sectionName: 'Demos & Example Projects',
    title: 'Shoe Store',
    description: 'React e-commerce storefront with full WebMCP integration.',
    url: 'https://andreinwald.github.io/webmcp-demo',
    tags: ['demo', 'react'],
  },
  {
    id: 'demo-blackjack',
    section: 'demos',
    sectionName: 'Demos & Example Projects',
    title: 'WebMCP Blackjack',
    description: 'Multi-agent blackjack game.',
    url: 'https://webmcp-blackjack.heejae.dev',
    tags: ['demo', 'game', 'ai'],
  },
  {
    id: 'demo-excalidraw',
    section: 'demos',
    sectionName: 'Demos & Example Projects',
    title: 'Excalidraw + WebMCP',
    description: 'Diagram generation driven by AI agents.',
    url: 'https://shidh.in/demo/webmcp-excalidraw',
    tags: ['demo', 'ai'],
  },
  {
    id: 'demo-flow',
    section: 'demos',
    sectionName: 'Demos & Example Projects',
    title: 'Architecture Flow Builder',
    description: 'Visual architecture diagramming with agent assistance.',
    url: 'https://webmcp-flow.vercel.app',
    tags: ['demo', 'ai'],
  },

  // Section 6 – Developer Tools & Utilities
  {
    id: 'chromelabs-tools',
    section: 'tools',
    sectionName: 'Developer Tools & Utilities',
    title: 'GoogleChromeLabs/webmcp-tools',
    description: 'Official toolkit: Model Context Tool Inspector extension, CLI utilities, and demo suite.',
    url: 'https://github.com/GoogleChromeLabs/webmcp-tools',
    tags: ['official', 'tool', 'chrome'],
  },
  {
    id: 'webmcp-inspector',
    section: 'tools',
    sectionName: 'Developer Tools & Utilities',
    title: 'WebMCP Inspector',
    description: 'Online inspector for testing and debugging WebMCP tool registrations.',
    url: 'https://webmcpinspector.com/',
    tags: ['tool'],
  },
  {
    id: 'wordlift-audit',
    section: 'tools',
    sectionName: 'Developer Tools & Utilities',
    title: 'WordLift AI Readiness Audit',
    description: 'Scan your site for WebMCP / agent readiness.',
    url: 'https://audit.wordlift.io/',
    tags: ['tool', 'ai'],
  },
  {
    id: 'cheatsheet',
    section: 'tools',
    sectionName: 'Developer Tools & Utilities',
    title: 'WebMCP Cheat Sheet',
    description: 'Quick-reference for declarative and imperative APIs, schemas, and common patterns.',
    url: 'https://www.webfuse.com/webmcp-cheat-sheet',
    tags: ['tool'],
  },

  // Section 7 – Videos & Talks
  {
    id: 'video-khushal',
    section: 'videos',
    sectionName: 'Videos & Talks',
    title: "Don't let AI agents push your buttons - use WebMCP instead!",
    description: "Khushal Sagar (Chrome Staff Engineer) on why WebMCP replaces button-clicking agents.",
    url: 'https://www.youtube.com/watch?v=p1l8nkQAoUw',
    tags: ['video', 'official', 'chrome'],
  },
  {
    id: 'video-awesome',
    section: 'videos',
    sectionName: 'Videos & Talks',
    title: "WebMCP - Why it's awesome & How to use it",
    description: 'Full setup walkthrough with inspector and React integration.',
    url: 'https://www.youtube.com/watch?v=xQAYZBDV5jg',
    tags: ['video', 'tutorial', 'react'],
  },
  {
    id: 'video-syntax',
    section: 'videos',
    sectionName: 'Videos & Talks',
    title: 'Syntax.fm WebMCP Deep Dive',
    description: 'In-depth discussion + live demo.',
    url: 'https://www.youtube.com/watch?v=sOPhVSeimtI',
    tags: ['video'],
  },
  {
    id: 'video-alex',
    section: 'videos',
    sectionName: 'Videos & Talks',
    title: 'Alex Nahas (MCP-B creator) Interview',
    description: 'Origin story and vision for the MCP-B ecosystem.',
    url: 'https://www.youtube.com/watch?v=6Po39iD6Pfs',
    tags: ['video', 'mcp'],
  },

  // Section 8 – Community
  {
    id: 'reddit',
    section: 'community',
    sectionName: 'Community & Contributing',
    title: 'r/WebMCP_Developers',
    description: 'Dedicated subreddit for WebMCP developers.',
    url: 'https://www.reddit.com/r/WebMCP_Developers/',
    tags: ['community'],
  },
  {
    id: 'w3c-group',
    section: 'community',
    sectionName: 'Community & Contributing',
    title: 'Web Machine Learning Community Group',
    description: 'Join to shape the spec.',
    url: 'https://www.w3.org/community/webmachinelearning/',
    tags: ['community', 'official', 'spec'],
  },
  {
    id: 'github-issues',
    section: 'community',
    sectionName: 'Community & Contributing',
    title: 'WebMCP GitHub Issues & Discussions',
    description: 'Report bugs, request features, discuss the spec.',
    url: 'https://github.com/webmachinelearning/webmcp/issues',
    tags: ['community', 'official'],
  },

  // Section 9 – Related MCP Ecosystem
  {
    id: 'mcp-official',
    section: 'mcp',
    sectionName: 'Related: MCP Ecosystem',
    title: 'Model Context Protocol',
    description: 'Official MCP spec, SDKs, and quickstart guides.',
    url: 'https://modelcontextprotocol.io/',
    tags: ['mcp', 'official', 'spec'],
  },
  {
    id: 'mcpb-relay',
    section: 'mcp',
    sectionName: 'Related: MCP Ecosystem',
    title: 'MCP-B Desktop Agent Relay',
    description: 'Connect desktop MCP agents to in-browser WebMCP tools.',
    url: 'https://docs.mcp-b.ai/tutorials',
    tags: ['mcp', 'tutorial'],
  },
];

const SECTIONS = [
  { id: 'specs',     name: 'Official Specs & Documentation',  icon: '📋' },
  { id: 'setup',     name: 'Getting Started & Browser Setup', icon: '🚀' },
  { id: 'tutorials', name: 'Tutorials & Hands-On Guides',     icon: '📚' },
  { id: 'libraries', name: 'Libraries, SDKs & Polyfills',     icon: '📦' },
  { id: 'demos',     name: 'Demos & Example Projects',        icon: '🎮' },
  { id: 'tools',     name: 'Developer Tools & Utilities',     icon: '🔧' },
  { id: 'videos',    name: 'Videos & Talks',                  icon: '🎥' },
  { id: 'community', name: 'Community & Contributing',        icon: '🤝' },
  { id: 'mcp',       name: 'Related: MCP Ecosystem',         icon: '🔗' },
];

// ─── Search / Filter ────────────────────────────────────────────────────────

const searchInput = document.getElementById('searchInput');
const resultsCount = document.getElementById('resultsCount');
const noResults = document.getElementById('noResults');

function normalise(str) {
  return str.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').trim();
}

function filterResources(query) {
  const q = normalise(query);
  const cards = document.querySelectorAll('[data-searchable]');
  let visible = 0;

  cards.forEach(card => {
    const text = normalise(card.dataset.searchable || '');
    const match = !q || text.includes(q);
    card.style.display = match ? '' : 'none';
    if (match) visible++;
  });

  // Show/hide section wrappers if all their cards are hidden
  document.querySelectorAll('.section').forEach(sec => {
    const secCards = sec.querySelectorAll('[data-searchable]');
    const anyVisible = Array.from(secCards).some(c => c.style.display !== 'none');
    sec.style.display = anyVisible || secCards.length === 0 ? '' : 'none';
  });

  if (q) {
    resultsCount.textContent = `${visible} result${visible !== 1 ? 's' : ''} for "${query}"`;
    noResults.classList.toggle('visible', visible === 0);
  } else {
    resultsCount.textContent = '';
    noResults.classList.remove('visible');
  }
}

if (searchInput) {
  let debounceTimer;
  searchInput.addEventListener('input', e => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => filterResources(e.target.value), 180);
  });
}

// ─── Scroll spy (active nav link) ───────────────────────────────────────────

function initScrollSpy() {
  const sections = document.querySelectorAll('.section[id]');
  const navLinks = document.querySelectorAll('.nav-link[data-target]');

  const obs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        navLinks.forEach(l => l.classList.remove('active'));
        const active = document.querySelector(`.nav-link[data-target="${entry.target.id}"]`);
        if (active) active.classList.add('active');
      }
    });
  }, { rootMargin: '-20% 0px -70% 0px', threshold: 0 });

  sections.forEach(s => obs.observe(s));
}

// ─── Fade-in on scroll ───────────────────────────────────────────────────────

function initFadeIn() {
  const els = document.querySelectorAll('.fade-in');
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.06 });
  els.forEach(el => obs.observe(el));
}

// ─── Back-to-top button ──────────────────────────────────────────────────────

function initBackToTop() {
  const btn = document.getElementById('backToTop');
  if (!btn) return;
  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 400);
  }, { passive: true });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

// ─── Smooth scroll for nav links ─────────────────────────────────────────────

function initNavLinks() {
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', e => {
      const target = document.querySelector(link.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

// ─── Keyboard shortcut (/) to focus search ───────────────────────────────────

document.addEventListener('keydown', e => {
  if (e.key === '/' && document.activeElement !== searchInput) {
    e.preventDefault();
    searchInput?.focus();
  }
  if (e.key === 'Escape' && document.activeElement === searchInput) {
    searchInput.value = '';
    filterResources('');
    searchInput.blur();
  }
});

// ─── WebMCP Tool Registration ────────────────────────────────────────────────

async function registerWebMCPTools() {
  if (!navigator.modelContext) {
    // navigator.modelContext not available — silently skip (non-Chrome or flag not enabled)
    console.info('[WebMCP] navigator.modelContext not available. Enable chrome://flags/#webmcp-for-testing to use WebMCP tools.');
    return;
  }

  try {
    // Tool 1: search_resources
    await navigator.modelContext.registerTool({
      name: 'search_resources',
      description: 'Search the Awesome WebMCP curated resource list by keyword. Returns matching resources with their titles, descriptions, URLs, and tags.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The keyword or phrase to search for in resource titles, descriptions, and tags.',
          },
        },
        required: ['query'],
      },
      handler: async ({ query }) => {
        const q = query.toLowerCase().trim();
        const results = RESOURCES.filter(r =>
          r.title.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.tags.some(t => t.toLowerCase().includes(q)) ||
          r.sectionName.toLowerCase().includes(q)
        );
        return {
          query,
          count: results.length,
          results: results.map(r => ({
            id: r.id,
            title: r.title,
            description: r.description,
            url: r.url,
            section: r.sectionName,
            tags: r.tags,
          })),
        };
      },
    });

    // Tool 2: list_sections
    await navigator.modelContext.registerTool({
      name: 'list_sections',
      description: 'List all sections in the Awesome WebMCP resource directory, with their IDs, names, icons, and resource counts.',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
      handler: async () => {
        return {
          count: SECTIONS.length,
          sections: SECTIONS.map(s => ({
            id: s.id,
            name: s.name,
            icon: s.icon,
            resourceCount: RESOURCES.filter(r => r.section === s.id).length,
          })),
        };
      },
    });

    // Tool 3: get_resources_by_section
    await navigator.modelContext.registerTool({
      name: 'get_resources_by_section',
      description: 'Get all resources for a specific section of the Awesome WebMCP list. Use list_sections first to get valid section IDs.',
      inputSchema: {
        type: 'object',
        properties: {
          section_id: {
            type: 'string',
            description: 'The section ID. Valid values: specs, setup, tutorials, libraries, demos, tools, videos, community, mcp.',
            enum: SECTIONS.map(s => s.id),
          },
        },
        required: ['section_id'],
      },
      handler: async ({ section_id }) => {
        const section = SECTIONS.find(s => s.id === section_id);
        if (!section) {
          throw new Error(`Unknown section: "${section_id}". Valid sections: ${SECTIONS.map(s => s.id).join(', ')}`);
        }
        const resources = RESOURCES.filter(r => r.section === section_id);
        return {
          section: { id: section.id, name: section.name, icon: section.icon },
          count: resources.length,
          resources: resources.map(r => ({
            id: r.id,
            title: r.title,
            description: r.description,
            url: r.url,
            tags: r.tags,
          })),
        };
      },
    });

    console.info('[WebMCP] ✓ Tools registered: search_resources, list_sections, get_resources_by_section');

    // Update the WebMCP indicator in the UI
    const indicator = document.getElementById('webmcpIndicator');
    if (indicator) {
      indicator.style.display = 'inline-flex';
    }

  } catch (err) {
    console.warn('[WebMCP] Tool registration failed:', err);
  }
}

// ─── Boot ────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initScrollSpy();
  initFadeIn();
  initBackToTop();
  initNavLinks();
  registerWebMCPTools();

  // Add search hint
  if (searchInput && !('ontouchstart' in window)) {
    searchInput.placeholder = 'Search resources… (press / to focus)';
  }
});
