(() => {
  'use strict';
  const items = window.DESIGN_PROMPTS;
  const categories = [
    ['전체', '전체'], ['학습', '학습 / 아카데믹'], ['자연', '자연 / 에코'],
    ['레트로', '레트로 / 빈티지'], ['판타지', '판타지 / 드림'],
    ['모던', '모던 / 도시'], ['럭셔리', '럭셔리 / 프리미엄']
  ];
  const $ = id => document.getElementById(id);
  let activeCategory = '전체';
  let selected = null;
  let copyGeneration = 0;
  const categoryLabel = category => categories.find(entry => entry[0] === category)[1];
  function element(tag, className, content) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = content;
    return node;
  }
  categories.forEach(([key, label]) => {
    const button = element('button', 'filter-button', label);
    button.type = 'button';
    button.dataset.category = key;
    button.setAttribute('aria-pressed', String(key === activeCategory));
    button.append(element('span', '', key === '전체' ? items.length : items.filter(item => item.category === key).length));
    button.addEventListener('click', () => {
      activeCategory = key;
      render();
    });
    $('filters').append(button);
  });
  function render() {
    const results = window.GalleryCore.filterPrompts(items, activeCategory, $('search').value);
    const fragment = document.createDocumentFragment();
    results.forEach((item, index) => {
      const card = element('button', 'design-card');
      card.type = 'button';
      card.setAttribute('aria-label', `${item.title} 프롬프트 보기`);
      card.style.animationDelay = `${Math.min(index, 5) * 35}ms`;
      const imageWrap = element('div', 'image-wrap');
      const image = element('img');
      image.src = item.image;
      image.alt = `${item.title} 디자인 예시`;
      image.width = 1436;
      image.height = 613;
      image.loading = index < 4 ? 'eager' : 'lazy';
      image.decoding = 'async';
      imageWrap.append(image);
      const arrow = element('span', 'card-open', '↗');
      arrow.setAttribute('aria-hidden', 'true');
      imageWrap.append(arrow);
      const meta = element('div', 'card-meta');
      meta.append(element('span', 'card-label', categoryLabel(item.category)));
      const colors = element('span', 'color-dots');
      colors.setAttribute('aria-hidden', 'true');
      item.colors.slice(0, 4).forEach(color => {
        const dot = element('span', 'color-dot');
        dot.style.backgroundColor = color;
        colors.append(dot);
      });
      meta.append(colors);
      const title = element('div', 'card-title');
      title.append(element('span', 'number', String(item.page).padStart(2, '0')), element('h3', '', item.title));
      card.append(imageWrap, meta, title, element('p', 'card-description', item.tone));
      card.addEventListener('click', () => openPrompt(item));
      fragment.append(card);
    });
    $('gallery').replaceChildren(fragment);
    $('result-count').textContent = results.length;
    $('results-label').textContent = `${activeCategory === '전체' ? '전체 디자인' : categoryLabel(activeCategory)} ${results.length}개${$('search').value.trim() ? ' · 검색 결과' : ''}`;
    $('empty-state').hidden = results.length !== 0;
    document.querySelectorAll('.filter-button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.category === activeCategory)));
  }
  function showDialog(dialog) {
    dialog.showModal();
    document.body.classList.add('modal-open');
  }
  function openPrompt(item) {
    selected = item;
    copyGeneration++;
    $('modal-category').textContent = `${categoryLabel(item.category)} / ${item.id}`;
    $('modal-title').textContent = item.title;
    $('modal-tone').textContent = item.tone;
    $('modal-image').src = item.image;
    $('modal-image').alt = `${item.title} 디자인 예시 전체 이미지`;
    $('prompt-text').value = item.prompt;
    $('copy-button').textContent = '프롬프트 복사 ⧉';
    $('copy-status').textContent = '복사한 프롬프트를 AI 도구에 붙여넣으세요.';
    showDialog($('prompt-dialog'));
    $('prompt-dialog').scrollTop = 0;
  }
  $('copy-button').addEventListener('click', async () => {
    if (!selected) return;
    const current = ++copyGeneration;
    const prompt = selected.prompt;
    let success = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(prompt);
        success = true;
      }
    } catch { /* Use the selection fallback when clipboard permission is denied. */ }
    if (current !== copyGeneration) return;
    if (!success) {
      $('prompt-text').focus();
      $('prompt-text').select();
      try { success = document.execCommand('copy'); } catch { success = false; }
    }
    $('copy-button').textContent = success ? '복사 완료 ✓' : '다시 복사 ⧉';
    $('copy-status').textContent = success ? '프롬프트를 복사했습니다. 원하는 AI 도구에 붙여넣으세요.' : '자동 복사를 허용하지 않는 환경입니다. 선택된 원문을 Ctrl+C 또는 ⌘C로 복사하세요.';
  });
  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => {
      document.body.classList.remove('modal-open');
      copyGeneration++;
    });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
  });
  $('updates-button').addEventListener('click', () => showDialog($('updates-dialog')));
  $('search').addEventListener('input', render);
  $('reset-button').addEventListener('click', () => {
    $('search').value = '';
    activeCategory = '전체';
    render();
    $('search').focus();
  });
  render();
})();
