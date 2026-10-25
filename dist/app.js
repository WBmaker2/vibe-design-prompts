(() => {
  'use strict';

  const items = window.DESIGN_PROMPTS || [];
  const core = window.GalleryCore;

  const categories = [
    ['전체', '전체'],
    ['즐겨찾기', '★ 즐겨찾기'],
    ['학습', '학습 / 아카데믹'],
    ['자연', '자연 / 에코'],
    ['레트로', '레트로 / 빈티지'],
    ['판타지', '판타지 / 드림'],
    ['모던', '모던 / 도시'],
    ['럭셔리', '럭셔리 / 프리미엄']
  ];

  const $ = id => document.getElementById(id);

  // 로컬 스토리지 키
  const STORAGE_KEYS = {
    THEME: 'vibe_theme_preference',
    BOOKMARKS: 'vibe_bookmarked_ids'
  };

  // 상태 관리
  let activeCategory = '전체';
  let bookmarks = loadBookmarks();
  let selected = null;
  let activeFormat = 'raw';
  let activeCut = 0;
  let currentFilteredList = [];
  let isInitialRender = true;
  let copyFeedbackTimer = null;

  // 1. 유틸리티 함수
  function element(tag, className, content) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = content;
    return node;
  }

  function loadBookmarks() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.BOOKMARKS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  function saveBookmarks() {
    try {
      localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(bookmarks));
    } catch {}
  }

  function isBookmarked(id) {
    return bookmarks.includes(id);
  }

  function toggleBookmark(id) {
    if (isBookmarked(id)) {
      bookmarks = bookmarks.filter(b => b !== id);
    } else {
      bookmarks.push(id);
    }
    saveBookmarks();
    updateFilterCounts();
    updateBookmarkButtons(id);

    if (activeCategory === '즐겨찾기') {
      render(false);
    }
  }

  function categoryLabel(cat) {
    const found = categories.find(entry => entry[0] === cat);
    return found ? found[1] : cat;
  }

  // 2. 테마 관리 (라이트 / 다크)
  function initTheme() {
    let saved = null;
    try {
      saved = localStorage.getItem(STORAGE_KEYS.THEME);
    } catch {}

    if (!saved) {
      saved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    applyTheme(saved);

    $('theme-toggle').addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try {
        localStorage.setItem(STORAGE_KEYS.THEME, next);
      } catch {}
    });
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const label = $('theme-toggle').querySelector('.theme-label');
    const icon = $('theme-toggle').querySelector('.theme-icon');
    if (theme === 'dark') {
      label.textContent = '라이트 테마';
      icon.textContent = '☼';
    } else {
      label.textContent = '다크 테마';
      icon.textContent = '☾';
    }
  }

  // 3. URL 상태 동기화 (딥링크)
  function readUrlState() {
    const params = new URLSearchParams(window.location.search);
    const cat = params.get('category');
    const q = params.get('q');
    const promptId = params.get('prompt') || (window.location.hash ? window.location.hash.slice(1) : '');

    if (cat && categories.some(c => c[0] === cat)) {
      activeCategory = cat;
    }
    if (q) {
      $('search').value = q;
      $('search-clear').hidden = false;
    }

    return promptId;
  }

  function updateUrlState() {
    const params = new URLSearchParams();
    if (activeCategory && activeCategory !== '전체') {
      params.set('category', activeCategory);
    }
    const q = $('search').value.trim();
    if (q) {
      params.set('q', q);
    }
    if (selected) {
      params.set('prompt', selected.id);
    }

    const searchStr = params.toString();
    const newUrl = window.location.pathname + (searchStr ? '?' + searchStr : '');
    window.history.replaceState(null, '', newUrl);
  }

  // 4. 필터 버튼 생성 및 카운트 갱신
  function initFilters() {
    const container = $('filters');
    container.replaceChildren();

    categories.forEach(([key, label]) => {
      const button = element('button', 'filter-button');
      if (key === '즐겨찾기') button.classList.add('bookmark-tab');
      button.type = 'button';
      button.dataset.category = key;
      button.setAttribute('aria-pressed', String(key === activeCategory));

      const nameSpan = element('span', 'label-text', label);
      const countSpan = element('span', 'count', '0');
      button.append(nameSpan, countSpan);

      button.addEventListener('click', () => {
        activeCategory = key;
        render(true);
        updateUrlState();
      });

      container.append(button);
    });

    updateFilterCounts();
  }

  function updateFilterCounts() {
    document.querySelectorAll('.filter-button').forEach(btn => {
      const key = btn.dataset.category;
      let count = 0;
      if (key === '전체') {
        count = items.length;
      } else if (key === '즐겨찾기') {
        count = bookmarks.length;
      } else {
        count = items.filter(it => it.category === key).length;
      }
      const countEl = btn.querySelector('.count');
      if (countEl) countEl.textContent = count;
      btn.setAttribute('aria-pressed', String(key === activeCategory));
    });
  }

  function updateBookmarkButtons(targetId) {
    document.querySelectorAll(`[data-bookmark-id="${targetId}"]`).forEach(btn => {
      const bookmarked = isBookmarked(targetId);
      btn.classList.toggle('bookmarked', bookmarked);
      btn.classList.toggle('active', bookmarked);
      const label = btn.querySelector('.bookmark-label');
      if (label) {
        label.textContent = bookmarked ? '즐겨찾기 됨' : '즐겨찾기';
      }
    });

    if (selected && selected.id === targetId) {
      const modalBtn = $('modal-bookmark-btn');
      const bookmarked = isBookmarked(targetId);
      modalBtn.classList.toggle('active', bookmarked);
      modalBtn.querySelector('.bookmark-label').textContent = bookmarked ? '즐겨찾기 보관됨' : '즐겨찾기 추가';
    }
  }

  // 5. 클립보드 복사 유틸
  async function copyToClipboard(text) {
    let success = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        success = true;
      }
    } catch {}

    if (!success) {
      const tempArea = document.createElement('textarea');
      tempArea.value = text;
      tempArea.style.position = 'fixed';
      tempArea.style.left = '-9999px';
      document.body.appendChild(tempArea);
      tempArea.focus();
      tempArea.select();
      try {
        success = document.execCommand('copy');
      } catch {
        success = false;
      }
      document.body.removeChild(tempArea);
    }
    return success;
  }

  // 6. 갤러리 렌더링
  function render(shouldAnimate = false) {
    const query = $('search').value;
    $('search-clear').hidden = !query.trim();

    currentFilteredList = core.filterPrompts(items, activeCategory, query, bookmarks);
    const fragment = document.createDocumentFragment();

    currentFilteredList.forEach((item, index) => {
      const card = element('div', 'design-card');
      if (shouldAnimate || isInitialRender) {
        card.classList.add('animated');
        card.style.animationDelay = `${Math.min(index, 6) * 35}ms`;
      }

      // 1) 미디어 영역
      const mediaWrap = element('div', 'card-media-wrapper');
      mediaWrap.setAttribute('role', 'button');
      mediaWrap.setAttribute('tabindex', '0');
      mediaWrap.setAttribute('aria-label', `${item.title} 디자인 시안 및 프롬프트 열기`);

      const img = element('img');
      img.src = item.image;
      img.alt = `${item.title} 4가지 디자인 시안 미리보기`;
      img.width = 1436;
      img.height = 613;
      img.loading = index < 4 ? 'eager' : 'lazy';
      img.decoding = 'async';
      mediaWrap.append(img);

      const openBadge = element('span', 'card-badge-open', '↗');
      openBadge.setAttribute('aria-hidden', 'true');
      mediaWrap.append(openBadge);

      mediaWrap.addEventListener('click', () => openPrompt(item));
      mediaWrap.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openPrompt(item);
        }
      });

      // 2) 메타 정보
      const meta = element('div', 'card-meta');
      meta.append(element('span', 'card-label', categoryLabel(item.category)));

      const colors = element('span', 'color-dots');
      colors.setAttribute('aria-hidden', 'true');
      (item.colors || []).slice(0, 4).forEach(color => {
        const dot = element('span', 'color-dot');
        dot.style.backgroundColor = color;
        colors.append(dot);
      });
      meta.append(colors);

      // 3) 타이틀 및 설명
      const titleRow = element('div', 'card-title-row');
      const titleMain = element('div', 'card-title-main');
      titleMain.append(
        element('span', 'number', String(item.page).padStart(2, '0')),
        element('h3', '', item.title)
      );
      titleRow.append(titleMain);

      const desc = element('p', 'card-description', item.tone);

      // 4) 하단 액션 바 (원클릭 복사 & 즐겨찾기)
      const actionBar = element('div', 'card-action-bar');
      const openTextBtn = element('button', 'card-open-btn', '상세 뷰어 · 리믹서');
      openTextBtn.type = 'button';
      openTextBtn.append(element('span', '', '↗'));
      openTextBtn.addEventListener('click', () => openPrompt(item));

      const actionButtons = element('div', 'card-action-buttons');

      // 빠른 복사 버튼
      const quickCopyBtn = element('button', 'card-btn-action');
      quickCopyBtn.type = 'button';
      quickCopyBtn.innerHTML = '<span>⧉</span> <span class="btn-text">복사</span>';
      quickCopyBtn.setAttribute('aria-label', `${item.title} 원문 프롬프트 복사`);
      quickCopyBtn.addEventListener('click', async e => {
        e.stopPropagation();
        const ok = await copyToClipboard(item.prompt);
        const textSpan = quickCopyBtn.querySelector('.btn-text');
        textSpan.textContent = ok ? '완료 ✓' : '실패';
        setTimeout(() => {
          textSpan.textContent = '복사';
        }, 1500);
      });

      // 즐겨찾기 버튼
      const bookmarkBtn = element('button', 'card-btn-action');
      bookmarkBtn.type = 'button';
      bookmarkBtn.dataset.bookmarkId = item.id;
      if (isBookmarked(item.id)) bookmarkBtn.classList.add('bookmarked');
      bookmarkBtn.innerHTML = '<span>★</span>';
      bookmarkBtn.setAttribute('aria-label', `${item.title} 즐겨찾기 토글`);
      bookmarkBtn.addEventListener('click', e => {
        e.stopPropagation();
        toggleBookmark(item.id);
      });

      actionButtons.append(quickCopyBtn, bookmarkBtn);
      actionBar.append(openTextBtn, actionButtons);

      card.append(mediaWrap, meta, titleRow, desc, actionBar);
      fragment.append(card);
    });

    $('gallery').replaceChildren(fragment);
    $('result-count').textContent = currentFilteredList.length;

    const labelText = activeCategory === '전체'
      ? '전체 디자인'
      : (activeCategory === '즐겨찾기' ? '즐겨찾기 보관함' : categoryLabel(activeCategory));
    $('results-label').textContent = `${labelText} ${currentFilteredList.length}개${query.trim() ? ' · 검색 결과' : ''}`;
    $('empty-state').hidden = currentFilteredList.length !== 0;

    isInitialRender = false;
  }

  // 7. 모달 대화상자 및 워크스페이스
  function showDialog(dialog) {
    dialog.showModal();
    document.body.classList.add('modal-open');
  }

  function openPrompt(item) {
    selected = item;
    activeCut = 0;
    activeFormat = 'raw';

    $('modal-category').textContent = `${categoryLabel(item.category)} / ${item.id}`;
    $('modal-title').textContent = item.title;
    $('modal-tone').textContent = item.tone;

    // 북마크 상태 갱신
    const bookmarked = isBookmarked(item.id);
    const modalBookmarkBtn = $('modal-bookmark-btn');
    modalBookmarkBtn.classList.toggle('active', bookmarked);
    modalBookmarkBtn.querySelector('.bookmark-label').textContent = bookmarked ? '즐겨찾기 보관됨' : '즐겨찾기 추가';

    // 이미지 뷰어 설정
    $('modal-image').src = item.image;
    $('modal-image').alt = `${item.title} 4가지 디자인 시안 고해상도 미리보기`;
    updateCutMode(0);

    // 컬러 칩 생성
    renderColorChips(item);

    // 실시간 UI 테마 미리보기
    updateLivePreview(item);

    // 포맷 탭 리셋
    document.querySelectorAll('.format-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.format === activeFormat);
    });
    $('remix-panel').hidden = true;

    // 이전/다음 버튼 상태 갱신
    updateNavButtons();

    // 텍스트 에어리어 갱신
    updatePromptOutput();

    $('copy-status').textContent = '복사한 프롬프트를 원하는 AI 도구에 붙여넣으세요.';
    $('copy-button-label').textContent = '프롬프트 복사';

    showDialog($('prompt-dialog'));
    $('prompt-dialog').scrollTop = 0;
    updateUrlState();
  }

  function updateNavButtons() {
    const currentIndex = currentFilteredList.findIndex(it => it.id === selected.id);
    $('prev-prompt-btn').disabled = currentIndex <= 0;
    $('next-prompt-btn').disabled = currentIndex >= currentFilteredList.length - 1;
  }

  function navigatePrompt(step) {
    if (!selected) return;
    const currentIndex = currentFilteredList.findIndex(it => it.id === selected.id);
    const nextIndex = currentIndex + step;
    if (nextIndex >= 0 && nextIndex < currentFilteredList.length) {
      openPrompt(currentFilteredList[nextIndex]);
    }
  }

  // 4분할 시안 뷰어 모드 업데이트
  function updateCutMode(cutNumber) {
    activeCut = cutNumber;
    const container = $('viewer-container');
    container.dataset.mode = `cut-${cutNumber}`;

    document.querySelectorAll('.cut-tab').forEach(tab => {
      tab.classList.toggle('active', Number(tab.dataset.cut) === cutNumber);
    });
  }

  // 대화형 컬러 칩 렌더링
  function renderColorChips(item) {
    const container = $('modal-color-chips');
    container.replaceChildren();

    const colorEntries = core.extractColorEntries(item);
    colorEntries.forEach(entry => {
      const chip = element('button', 'color-chip');
      chip.type = 'button';
      chip.setAttribute('aria-label', `${entry.label}: ${entry.hex} 색상 코드 복사`);

      const swatch = element('span', 'color-chip-swatch');
      swatch.style.backgroundColor = entry.hex;

      const hex = element('span', 'color-chip-hex', entry.hex);
      const label = element('span', 'color-chip-label', `(${entry.label})`);

      chip.append(swatch, hex, label);

      chip.addEventListener('click', async () => {
        const ok = await copyToClipboard(entry.hex);
        if (ok) {
          label.textContent = '(복사 완료 ✓)';
          label.style.color = '#5d7515';
          setTimeout(() => {
            label.textContent = `(${entry.label})`;
            label.style.color = '';
          }, 1500);
        }
      });

      container.append(chip);
    });
  }

  // 실시간 UI 테마 미리보기 컴포넌트 스타일 갱신
  function updateLivePreview(item) {
    const card = $('live-preview-card');
    const colors = item.colors || ['#ffffff', '#222222', '#4a90d9', '#e74c3c'];

    const bg = colors[0] || '#ffffff';
    const text = colors[1] || '#222222';
    const accent1 = colors[2] || '#4a90d9';
    const accent2 = colors[3] || '#e74c3c';

    card.style.setProperty('--prev-bg', bg);
    card.style.setProperty('--prev-text', text);
    card.style.setProperty('--prev-accent-1', accent1);
    card.style.setProperty('--prev-accent-2', accent2);

    $('preview-badge').textContent = `${item.category} / ${item.title}`;
    $('preview-title').textContent = `${item.title} 디자인 시스템 실시간 프리뷰`;
    $('preview-desc').textContent = `${item.tone}. ${item.title}의 고유한 배경색과 서체 대비, 포인트 강조색을 실무 컴포넌트에 즉시 적용해 보세요.`;
  }

  // 출력 텍스트 영역 갱신
  function updatePromptOutput() {
    if (!selected) return;

    const topic = $('remix-topic').value;
    const target = $('remix-target').value;

    const output = core.buildExportContent(selected, activeFormat, {
      topic,
      target
    });

    $('prompt-text').value = output;

    const formatLabels = {
      raw: '원문 프롬프트 복사',
      remix: '리믹스 프롬프트 복사',
      aicoding: 'AI 지시문 복사',
      tokens: '디자인 토큰 복사'
    };
    $('copy-button-label').textContent = formatLabels[activeFormat] || '프롬프트 복사';
  }

  // 8. 이벤트 리스너 등록
  function initEvents() {
    // 검색창 입력 및 초기화
    $('search').addEventListener('input', () => {
      render(false);
      updateUrlState();
    });

    $('search-clear').addEventListener('click', () => {
      $('search').value = '';
      $('search').focus();
      render(false);
      updateUrlState();
    });

    $('reset-button').addEventListener('click', () => {
      $('search').value = '';
      activeCategory = '전체';
      render(true);
      updateFilterCounts();
      updateUrlState();
    });

    // 업데이트 내역 다이얼로그
    $('updates-button').addEventListener('click', () => {
      showDialog($('updates-dialog'));
    });

    // 다이얼로그 닫기 공통 처리
    document.querySelectorAll('dialog').forEach(dialog => {
      dialog.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', () => dialog.close());
      });

      dialog.addEventListener('close', () => {
        document.body.classList.remove('modal-open');
        if (dialog.id === 'prompt-dialog') {
          selected = null;
          updateUrlState();
        }
      });

      dialog.addEventListener('click', event => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        ) {
          dialog.close();
        }
      });
    });

    // 모달 내 이전 / 다음 버튼
    $('prev-prompt-btn').addEventListener('click', () => navigatePrompt(-1));
    $('next-prompt-btn').addEventListener('click', () => navigatePrompt(1));

    // 키보드 좌우 화살표로 이전/다음 탐색
    window.addEventListener('keydown', e => {
      const dialog = $('prompt-dialog');
      if (!dialog.open) return;

      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigatePrompt(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        navigatePrompt(1);
      }
    });

    // 모달 즐겨찾기 버튼
    $('modal-bookmark-btn').addEventListener('click', () => {
      if (selected) toggleBookmark(selected.id);
    });

    // 4분할 시안 탭 클릭
    document.querySelectorAll('.cut-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        updateCutMode(Number(tab.dataset.cut));
      });
    });

    // 출력 포맷 탭 클릭
    document.querySelectorAll('.format-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        activeFormat = tab.dataset.format;
        document.querySelectorAll('.format-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        $('remix-panel').hidden = !(activeFormat === 'remix' || activeFormat === 'aicoding');
        updatePromptOutput();
      });
    });

    // 리믹스 옵션 변경
    $('remix-topic').addEventListener('input', updatePromptOutput);
    $('remix-target').addEventListener('change', updatePromptOutput);

    // 모달 복사 버튼
    $('copy-button').addEventListener('click', async () => {
      if (!selected) return;
      const text = $('prompt-text').value;
      const success = await copyToClipboard(text);

      clearTimeout(copyFeedbackTimer);
      const label = $('copy-button-label');
      const originText = label.textContent;

      if (success) {
        label.textContent = '복사 완료 ✓';
        $('copy-status').textContent = '클립보드에 복사되었습니다! 원하는 AI 도구나 프로젝트에 붙여넣으세요.';
      } else {
        label.textContent = '선택 후 ⌘C 복사';
        $('prompt-text').select();
        $('copy-status').textContent = '자동 복사를 지원하지 않는 브라우저입니다. 텍스트를 선택했으니 Ctrl+C 또는 ⌘C로 복사하세요.';
      }

      copyFeedbackTimer = setTimeout(() => {
        label.textContent = originText;
        $('copy-status').textContent = '복사한 프롬프트를 원하는 AI 도구에 붙여넣으세요.';
      }, 2500);
    });

    // 모달 딥링크 복사 버튼들
    const handleCopyDeepLink = async () => {
      if (!selected) return;
      const url = window.location.href;
      const ok = await copyToClipboard(url);
      $('copy-status').textContent = ok
        ? '현재 프롬프트 딥링크가 복사되었습니다!'
        : '주소창의 링크를 복사하세요.';
      setTimeout(() => {
        $('copy-status').textContent = '복사한 프롬프트를 원하는 AI 도구에 붙여넣으세요.';
      }, 2500);
    };

    $('modal-share-link').addEventListener('click', handleCopyDeepLink);
    $('copy-link-btn').addEventListener('click', handleCopyDeepLink);
  }

  // 9. 애플리케이션 초기화
  function init() {
    initTheme();
    const initialPromptId = readUrlState();
    initFilters();
    initEvents();
    render(true);

    if (initialPromptId) {
      const target = items.find(it => it.id === initialPromptId);
      if (target) {
        openPrompt(target);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
