const fallbackManifest = {
  product: 'MusicXR',
  prepared: '2026-06-21',
  docs: [
    {
      id: 'platform',
      title: 'Platform Plan',
      file: 'MUSICXR_PLATFORM_PLAN.md',
      href: 'plan-docs/MUSICXR_PLATFORM_PLAN.md',
      summary:
        'Product vision, user groups, asset and token model, royalty operations, compliance concerns, MVP scope, risks, and launch readiness.',
      accent: 'blue'
    },
    {
      id: 'technology',
      title: 'Technology Plan',
      file: 'MUSICXR_TECHNOLOGY_PLAN.md',
      href: 'plan-docs/MUSICXR_TECHNOLOGY_PLAN.md',
      summary:
        'Flutter, Firebase, Firestore, Cloud Functions, security model, vendor stack, design system, CI/CD, testing, and app-store readiness.',
      accent: 'green'
    },
    {
      id: 'implementation-gtm',
      title: 'Implementation And GTM Plan',
      file: 'MUSICXR_IMPLEMENTATION_GTM_PLAN.md',
      href: 'plan-docs/MUSICXR_IMPLEMENTATION_GTM_PLAN.md',
      summary:
        'Execution phases, team model, operating cadence, MVP backlog, pilot strategy, launch audiences, channels, metrics, risks, and next actions.',
      accent: 'coral'
    }
  ],
  image: {
    title: 'Source Business Diagram',
    href: 'plan-docs/business-doc.png'
  }
};

const state = {
  manifest: fallbackManifest,
  activeDoc: null,
  activeMarkdown: '',
  activeHeadings: [],
  searchTerm: ''
};

const elements = {
  docNav: document.querySelector('#docNav'),
  docFilter: document.querySelector('#docFilter'),
  docTitle: document.querySelector('#docTitle'),
  docSummary: document.querySelector('#docSummary'),
  docAccent: document.querySelector('#docAccent'),
  rawDocLink: document.querySelector('#rawDocLink'),
  readerSearch: document.querySelector('#readerSearch'),
  documentContent: document.querySelector('#documentContent'),
  tocNav: document.querySelector('#tocNav'),
  copyLinkButton: document.querySelector('#copyLinkButton'),
  printButton: document.querySelector('#printButton'),
  diagramPreview: document.querySelector('#diagramPreview')
};

async function init() {
  state.manifest = await loadManifest();
  elements.diagramPreview.src = toAbsolutePath(state.manifest.image.href);
  renderDocNav();
  bindEvents();

  const initialId = getDocIdFromHash() || state.manifest.docs[0]?.id;
  await loadDoc(initialId);
}

async function loadManifest() {
  try {
    const response = await fetch('/docs-manifest.json', { cache: 'no-cache' });
    if (!response.ok) {
      throw new Error(`Manifest returned ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.warn('Using fallback docs manifest.', error);
    return fallbackManifest;
  }
}

function bindEvents() {
  window.addEventListener('hashchange', async () => {
    const nextId = getDocIdFromHash();
    if (nextId && nextId !== state.activeDoc?.id) {
      await loadDoc(nextId);
    }
  });

  elements.docFilter.addEventListener('input', () => {
    renderDocNav(elements.docFilter.value);
  });

  elements.readerSearch.addEventListener('input', () => {
    state.searchTerm = elements.readerSearch.value.trim();
    renderActiveMarkdown();
  });

  elements.tocNav.addEventListener('click', (event) => {
    const link = event.target.closest('[data-heading-id]');
    if (!link) {
      return;
    }

    event.preventDefault();
    const heading = document.getElementById(link.dataset.headingId);
    if (!heading) {
      return;
    }

    heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
    history.replaceState(null, '', `#${state.activeDoc.id}/${link.dataset.headingId}`);
  });

  elements.copyLinkButton.addEventListener('click', async () => {
    const url = `${window.location.origin}${window.location.pathname}#${state.activeDoc.id}`;
    await navigator.clipboard.writeText(url);
    elements.copyLinkButton.textContent = 'Copied';
    window.setTimeout(() => {
      elements.copyLinkButton.textContent = 'Copy Link';
    }, 1400);
  });

  elements.printButton.addEventListener('click', () => {
    window.print();
  });
}

function renderDocNav(filter = '') {
  const query = filter.trim().toLowerCase();
  const docs = state.manifest.docs.filter((doc) => {
    const haystack = `${doc.title} ${doc.summary}`.toLowerCase();
    return !query || haystack.includes(query);
  });

  if (!docs.length) {
    elements.docNav.innerHTML = '<p class="empty-state">No planning docs match that filter.</p>';
    return;
  }

  elements.docNav.innerHTML = docs
    .map((doc) => {
      const meta = doc.lineCount ? `${doc.lineCount.toLocaleString()} lines` : 'Planning document';
      const activeClass = state.activeDoc?.id === doc.id ? ' active' : '';
      return `
        <a class="doc-link${activeClass}" data-accent="${doc.accent}" href="#${doc.id}">
          <span class="doc-link-marker" aria-hidden="true"></span>
          <span>
            <span class="doc-link-title">${escapeHtml(doc.title)}</span>
            <span class="doc-link-meta">${escapeHtml(meta)} · ${escapeHtml(doc.summary)}</span>
          </span>
        </a>
      `;
    })
    .join('');
}

async function loadDoc(id) {
  const doc = state.manifest.docs.find((item) => item.id === id) || state.manifest.docs[0];
  if (!doc) {
    renderError('No documents are available.');
    return;
  }

  state.activeDoc = doc;
  state.searchTerm = '';
  elements.readerSearch.value = '';
  elements.docTitle.textContent = doc.title;
  elements.docSummary.textContent = doc.summary;
  elements.docAccent.className = `doc-accent ${doc.accent || 'blue'}`;
  elements.rawDocLink.href = toAbsolutePath(doc.href);

  if (getDocIdFromHash() !== doc.id) {
    history.replaceState(null, '', `#${doc.id}`);
  }

  renderDocNav(elements.docFilter.value);
  renderLoading();

  try {
    const response = await fetch(toAbsolutePath(doc.href), { cache: 'no-cache' });
    if (!response.ok) {
      throw new Error(`Document returned ${response.status}`);
    }
    state.activeMarkdown = await response.text();
    renderActiveMarkdown();
  } catch (error) {
    renderError(`Could not load ${doc.title}. ${error.message}`);
  }
}

function renderActiveMarkdown() {
  const markdown = state.searchTerm
    ? markSearchMatches(state.activeMarkdown, state.searchTerm)
    : state.activeMarkdown;
  const rendered = renderMarkdown(markdown);

  state.activeHeadings = rendered.headings;
  elements.documentContent.innerHTML = rendered.html;
  renderToc();
  scrollToHeadingFromHash();
}

function renderLoading() {
  elements.documentContent.innerHTML = '<div class="empty-state">Loading planning document...</div>';
  elements.tocNav.innerHTML = '';
}

function renderError(message) {
  elements.documentContent.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
  elements.tocNav.innerHTML = '';
}

function renderToc() {
  const headings = state.activeHeadings.filter((heading) => heading.level <= 3);

  if (!headings.length) {
    elements.tocNav.innerHTML = '<p class="empty-state">No outline found.</p>';
    return;
  }

  elements.tocNav.innerHTML = headings
    .map(
      (heading) =>
        `<a class="depth-${heading.level}" href="#${state.activeDoc.id}/${heading.id}" data-heading-id="${
          heading.id
        }">${escapeHtml(heading.text)}</a>`
    )
    .join('');
}

function renderMarkdown(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const headings = [];
  let html = '';
  let paragraph = [];
  let inCode = false;
  let codeBuffer = [];
  let listType = null;
  let usedSlugs = new Map();

  const flushParagraph = () => {
    if (!paragraph.length) {
      return;
    }
    html += `<p>${renderInline(paragraph.join(' '))}</p>`;
    paragraph = [];
  };

  const closeList = () => {
    if (!listType) {
      return;
    }
    html += `</${listType}>`;
    listType = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.startsWith('```')) {
      if (inCode) {
        html += `<pre><code>${escapeHtml(codeBuffer.join('\n'))}</code></pre>`;
        codeBuffer = [];
        inCode = false;
      } else {
        flushParagraph();
        closeList();
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeBuffer.push(rawLine);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      closeList();
      continue;
    }

    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      closeList();
      const level = headingMatch[1].length;
      const text = stripInlineMarkdown(headingMatch[2]);
      const id = uniqueSlug(text, usedSlugs);
      headings.push({ level, text, id });
      html += `<h${level} id="${id}">${renderInline(headingMatch[2])}</h${level}>`;
      continue;
    }

    if (/^[-*_]{3,}$/.test(line.trim())) {
      flushParagraph();
      closeList();
      html += '<hr>';
      continue;
    }

    const quoteMatch = line.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      flushParagraph();
      closeList();
      html += `<blockquote>${renderInline(quoteMatch[1])}</blockquote>`;
      continue;
    }

    const unorderedMatch = line.match(/^\s*[-*]\s+(.+)$/);
    const orderedMatch = line.match(/^\s*\d+\.\s+(.+)$/);
    if (unorderedMatch || orderedMatch) {
      flushParagraph();
      const nextType = unorderedMatch ? 'ul' : 'ol';
      const item = unorderedMatch ? unorderedMatch[1] : orderedMatch[1];
      if (listType !== nextType) {
        closeList();
        listType = nextType;
        html += `<${listType}>`;
      }
      html += `<li>${renderInline(item)}</li>`;
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph();
  closeList();

  if (inCode) {
    html += `<pre><code>${escapeHtml(codeBuffer.join('\n'))}</code></pre>`;
  }

  return { html, headings };
}

function renderInline(value) {
  let output = escapeHtml(value);

  output = output.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt, url) => {
    const safeUrl = sanitizeUrl(url);
    return safeUrl ? `<img src="${safeUrl}" alt="${alt}">` : alt;
  });

  output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, text, url) => {
    const safeUrl = sanitizeUrl(url);
    return safeUrl
      ? `<a href="${safeUrl}" target="${isExternalUrl(safeUrl) ? '_blank' : '_self'}" rel="noreferrer">${text}</a>`
      : text;
  });

  output = output.replace(/`([^`]+)`/g, '<code>$1</code>');
  output = output.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  output = output.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  output = output.replace(/&lt;mark&gt;(.*?)&lt;\/mark&gt;/g, '<mark>$1</mark>');

  return output;
}

function markSearchMatches(markdown, searchTerm) {
  const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!escapedTerm) {
    return markdown;
  }
  return markdown.replace(new RegExp(escapedTerm, 'gi'), (match) => `<mark>${match}</mark>`);
}

function stripInlineMarkdown(value) {
  return value
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<mark>|<\/mark>/g, '');
}

function uniqueSlug(text, usedSlugs) {
  const base =
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'section';
  const count = usedSlugs.get(base) || 0;
  usedSlugs.set(base, count + 1);
  return count ? `${base}-${count + 1}` : base;
}

function getDocIdFromHash() {
  const hash = window.location.hash.replace(/^#/, '');
  return hash.split('/')[0];
}

function getHeadingIdFromHash() {
  const hash = window.location.hash.replace(/^#/, '');
  return hash.split('/')[1] || '';
}

function scrollToHeadingFromHash() {
  const headingId = getHeadingIdFromHash();
  if (!headingId) {
    return;
  }

  window.requestAnimationFrame(() => {
    document.getElementById(headingId)?.scrollIntoView({ block: 'start' });
  });
}

function toAbsolutePath(href) {
  if (/^https?:\/\//.test(href) || href.startsWith('/')) {
    return href;
  }
  return `/${href}`;
}

function sanitizeUrl(url) {
  const trimmed = String(url).trim();
  if (
    /^https?:\/\//i.test(trimmed) ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('plan-docs/')
  ) {
    return trimmed;
  }
  return '';
}

function isExternalUrl(url) {
  return /^https?:\/\//i.test(url);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

init();
