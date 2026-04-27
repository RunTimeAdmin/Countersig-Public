/* ============================================================
   AgentID Documentation — docs.js
   Navigation, tabs, syntax highlighting, mobile menu
   ============================================================ */

(function () {
  'use strict';

  // ── Section Navigation ──────────────────────────────────────
  const sections = document.querySelectorAll('.doc-section');
  const sidebarLinks = document.querySelectorAll('.sidebar-link[data-section]');
  const docNavLinks = document.querySelectorAll('.btn-next, .btn-prev');

  function showSection(id) {
    sections.forEach(s => s.classList.add('hidden'));
    sidebarLinks.forEach(l => l.classList.remove('active'));

    const target = document.getElementById(id);
    const activeLink = document.querySelector(`.sidebar-link[data-section="${id}"]`);

    if (target) {
      target.classList.remove('hidden');
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    if (activeLink) {
      activeLink.classList.add('active');
      activeLink.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    // Update URL hash without scrolling
    history.replaceState(null, '', '#' + id);
  }

  sidebarLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const section = link.getAttribute('data-section');
      if (section) {
        showSection(section);
        closeMobileMenu();
      }
    });
  });

  // Bottom nav buttons (btn-next / btn-prev)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-next, .btn-prev');
    if (!btn) return;
    const href = btn.getAttribute('href');
    if (href && href.startsWith('#')) {
      e.preventDefault();
      const section = href.slice(1);
      // Check if it's a section-level anchor
      if (document.getElementById(section) && document.getElementById(section).classList.contains('doc-section')) {
        showSection(section);
      } else {
        // In-page anchor within current section
        const el = document.getElementById(section);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  });

  // In-page TOC anchors (within sections)
  document.addEventListener('click', (e) => {
    const link = e.target.closest('.toc a');
    if (!link) return;
    const href = link.getAttribute('href');
    if (href && href.startsWith('#')) {
      e.preventDefault();
      const el = document.getElementById(href.slice(1));
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  });

  // Load section from URL hash on page load
  function loadFromHash() {
    const hash = window.location.hash.slice(1);
    const sectionIds = Array.from(sections).map(s => s.id);
    if (hash && sectionIds.includes(hash)) {
      showSection(hash);
    } else {
      showSection('overview');
    }
  }

  // ── Tab Switching ─────────────────────────────────────────
  document.querySelectorAll('.tabs').forEach(tabGroup => {
    const buttons = tabGroup.querySelectorAll('.tab-btn');
    const contents = tabGroup.querySelectorAll('.tab-content');

    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.getAttribute('data-tab');

        buttons.forEach(b => b.classList.remove('active'));
        contents.forEach(c => c.classList.remove('active'));

        btn.classList.add('active');
        const target = tabGroup.querySelector(`#tab-${tabId}`);
        if (target) target.classList.add('active');
      });
    });
  });

  // ── Mobile Menu ───────────────────────────────────────────
  const sidebar = document.getElementById('sidebar');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');

  function closeMobileMenu() {
    sidebar.classList.remove('open');
    mobileMenuBtn.textContent = '☰';
  }

  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
      const isOpen = sidebar.classList.toggle('open');
      mobileMenuBtn.textContent = isOpen ? '✕' : '☰';
    });
  }

  // Close sidebar when clicking outside on mobile
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 &&
        sidebar.classList.contains('open') &&
        !sidebar.contains(e.target) &&
        !mobileMenuBtn.contains(e.target)) {
      closeMobileMenu();
    }
  });

  // ── Syntax Highlighting (lightweight, no deps) ────────────
  function highlight(code, lang) {
    // Escape HTML entities first
    let c = code
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>');

    const keywords = {
      javascript: /\b(const|let|var|function|async|await|return|if|else|throw|new|import|export|from|require|class|extends|this|true|false|null|undefined)\b/g,
      jsx: /\b(const|let|var|function|async|await|return|if|else|throw|new|import|export|from|require|class|extends|this|true|false|null|undefined)\b/g,
      python: /\b(def|class|import|from|return|if|else|elif|for|while|True|False|None|async|await|with|as|try|except|finally|raise)\b/g,
      bash: /\b(curl|npm|node|git|sudo|cd|mkdir|cp|mv|rm|echo|export|chmod|cat|grep|nano)\b/g,
      sql: /\b(CREATE|TABLE|INSERT|SELECT|FROM|WHERE|PRIMARY|KEY|NOT|NULL|DEFAULT|REFERENCES|INDEX|ON|FOREIGN|UNIQUE|VARCHAR|TEXT|INTEGER|BOOLEAN|TIMESTAMPTZ|JSONB|UUID|gen_random_uuid)\b/gi,
      go: /\b(func|package|import|var|const|type|struct|interface|return|if|else|for|range|defer|go|chan|select|case|default|map|make|append)\b/g,
      rust: /\b(fn|let|mut|pub|use|mod|struct|enum|impl|trait|return|if|else|for|while|loop|match|Some|None|Ok|Err|String|Vec)\b/g,
    };

    const stringRe = /(["'`])(?:(?!\1)[^\\]|\\.)*\1/g;
    const commentRe = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/#?|#[^\n]*)/g;
    const numberRe = /\b(\d+\.?\d*)\b/g;

    // Comments
    c = c.replace(commentRe, '<span class="tok-comment">$1</span>');
    // Strings
    c = c.replace(stringRe, '<span class="tok-string">$&</span>');
    // Keywords
    const kw = keywords[lang] || keywords.javascript;
    c = c.replace(kw, '<span class="tok-keyword">$&</span>');
    // Numbers
    c = c.replace(numberRe, '<span class="tok-number">$&</span>');

    return c;
  }

  document.querySelectorAll('pre code').forEach(block => {
    const classAttr = block.getAttribute('class') || '';
    const langMatch = classAttr.match(/lang-(\w+)/);
    const lang = langMatch ? langMatch[1] : 'javascript';
    const raw = block.textContent;
    block.innerHTML = highlight(raw, lang);
  });

  // ── Copy Button on Code Blocks ────────────────────────────
  document.querySelectorAll('pre').forEach(pre => {
    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.textContent = 'Copy';
    btn.setAttribute('aria-label', 'Copy code');
    pre.style.position = 'relative';
    pre.appendChild(btn);

    btn.addEventListener('click', () => {
      const code = pre.querySelector('code');
      if (code) {
        navigator.clipboard.writeText(code.textContent).then(() => {
          btn.textContent = 'Copied!';
          btn.classList.add('copied');
          setTimeout(() => {
            btn.textContent = 'Copy';
            btn.classList.remove('copied');
          }, 2000);
        });
      }
    });
  });

  // ── Search ─────────────────────────────────────────────────
  // Simple in-page search shortcut (Ctrl+K or /)
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      const searchInput = document.getElementById('docSearch');
      if (searchInput) searchInput.focus();
    }
  });

  // ── Init ──────────────────────────────────────────────────
  loadFromHash();

})();