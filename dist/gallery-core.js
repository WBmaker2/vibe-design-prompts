(function (root) {
  'use strict';

  function normalize(value) {
    return String(value || '').normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, '');
  }

  function filterPrompts(items, category, query, bookmarks = []) {
    const terms = String(query || '').trim().split(/\s+/).filter(Boolean).map(normalize);
    const bookmarkSet = new Set(bookmarks);

    return items.filter(item => {
      if (category === '즐겨찾기') {
        if (!bookmarkSet.has(item.id)) return false;
      } else if (category && category !== '전체') {
        if (item.category !== category) return false;
      }

      if (terms.length === 0) return true;

      const haystack = normalize([
        item.id,
        item.category,
        item.title,
        item.tone || '',
        item.prompt || '',
        (item.colors || []).join(' ')
      ].join(' '));

      return terms.every(term => haystack.includes(term));
    });
  }

  function matchField(text, regex) {
    const m = text.match(regex);
    return m ? m[1].trim() : '';
  }

  function parsePromptStructure(item) {
    const prompt = item.prompt || '';
    return {
      id: item.id,
      title: item.title,
      category: item.category,
      tone: matchField(prompt, /톤:\s*"([^"]+)"/),
      background: matchField(prompt, /배경색:\s*"([^"]+)"/),
      textColor: matchField(prompt, /텍스트 색상:\s*"([^"]+)"/),
      accentColor: matchField(prompt, /강조 색상:\s*"([^"]+)"/),
      features: matchField(prompt, /특징:\s*"([^"]+)"/),
      imageElements: matchField(prompt, /이미지:\s*"([^"]+)"/),
      texture: matchField(prompt, /텍스처:\s*"([^"]+)"/),
      composition: matchField(prompt, /구성:\s*"([^"]+)"/),
      typoTitle: matchField(prompt, /제목:\s*"([^"]+)"/),
      typoStyle: matchField(prompt, /스타일:\s*"([^"]+)"/),
      colors: Array.isArray(item.colors) ? item.colors.slice() : []
    };
  }

  function extractColorEntries(item) {
    const parsed = parsePromptStructure(item);
    const entries = [];
    const seen = new Set();

    const sections = [
      { text: parsed.background, role: '배경' },
      { text: parsed.textColor, role: '텍스트' },
      { text: parsed.accentColor, role: '강조' }
    ];

    sections.forEach(({ text, role }) => {
      if (!text) return;
      // Match #HEX (description)
      const regex = /(#[0-9A-Fa-f]{6})\s*(?:\(([^)]+)\))?/g;
      let match;
      while ((match = regex.exec(text)) !== null) {
        const hex = match[1].toUpperCase();
        if (!seen.has(hex)) {
          seen.add(hex);
          entries.push({
            hex,
            role,
            label: match[2] ? match[2].trim() : role
          });
        }
      }
    });

    // Fallback to item.colors if no regex matched
    (item.colors || []).forEach((c, idx) => {
      const hex = c.toUpperCase();
      if (!seen.has(hex)) {
        seen.add(hex);
        entries.push({
          hex,
          role: idx === 0 ? '배경' : (idx === 1 ? '텍스트' : `강조 ${idx - 1}`),
          label: idx === 0 ? '배경색' : (idx === 1 ? '본문색' : `포인트 ${idx - 1}`)
        });
      }
    });

    return entries;
  }

  function buildExportContent(item, format, options = {}) {
    if (format === 'raw') {
      return item.prompt || '';
    }

    const parsed = parsePromptStructure(item);
    const topic = (options.topic || '').trim() || '웹 프로젝트';
    const target = (options.target || '').trim() || '반응형 웹 UI';
    const colors = (options.customColors && options.customColors.length > 0)
      ? options.customColors
      : parsed.colors;

    if (format === 'remix') {
      return [
        `# [${item.id}] ${item.title} — ${topic} 맞춤형 프롬프트`,
        `프로젝트 주제: "${topic}"`,
        `적용 매체: "${target}"`,
        ``,
        `전체 디자인 설정:`,
        `  톤: "${parsed.tone}"`,
        `  시각적 아이덴티티:`,
        `    배경색: "${parsed.background}"`,
        `    텍스트 색상: "${parsed.textColor}"`,
        `    강조 색상: "${parsed.accentColor}"`,
        `    이미지 스타일:`,
        `      특징: "${parsed.features}"`,
        `      이미지: "${parsed.imageElements}"`,
        `      텍스처: "${parsed.texture}"`,
        `      구성: "${parsed.composition}"`,
        `  타이포그래피:`,
        `    제목: "${parsed.typoTitle}"`,
        `    스타일: "${parsed.typoStyle}"`,
        ``,
        `지시 사항:`,
        `- "${topic}"의 성격에 맞게 위 분위기와 색상 팔레트를 자연스럽게 적용할 것.`,
        `- "${target}" 환경에서 사용자가 감성을 직관적으로 느낄 수 있도록 여백, 텍스처, 서체를 세밀하게 조율할 것.`
      ].join('\n');
    }

    if (format === 'aicoding') {
      const bg = colors[0] || '#FFFFFF';
      const text = colors[1] || '#222222';
      const accent1 = colors[2] || '#4A90D9';
      const accent2 = colors[3] || '#E74C3C';

      return [
        `# 바이브 코딩 디자인 구현 지시문: ${item.title} (${item.id})`,
        ``,
        `당신은 감각적인 프론트엔드 UI/UX 엔지니어입니다. 다음 디자인 시스템 사양에 맞춰 "${topic}"을 위한 ${target}을 구현해 주세요.`,
        ``,
        `## 1. 디자인 컨셉 & 톤앤매너`,
        `- 스타일 테마: ${item.title} (${item.category} 카테고리)`,
        `- 감성/톤: ${parsed.tone}`,
        `- 레이아웃 구성: ${parsed.composition}`,
        `- 질감/텍스처: ${parsed.texture}`,
        ``,
        `## 2. 디자인 토큰 (Design Tokens)`,
        `- Background: \`${bg}\` (${parsed.background})`,
        `- Text Primary: \`${text}\` (${parsed.textColor})`,
        `- Accent 1: \`${accent1}\``,
        `- Accent 2: \`${accent2}\``,
        ``,
        `## 3. 타이포그래피 사양`,
        `- 제목 폰트: ${parsed.typoTitle}`,
        `- 스타일 가이드: ${parsed.typoStyle}`,
        ``,
        `## 4. UI 컴포넌트 구현 가이드`,
        `1. 전체 배경은 \`${bg}\`를 기본으로 하고 질감(${parsed.texture})을 살릴 수 있는 미세한 패턴이나 노이즈, 테두리 스타일을 고려하세요.`,
        `2. 본문 텍스트는 \`${text}\`로 가독성을 유지하되 계층 구조에 따라 투명도 또는 폰트 굵기를 조절하세요.`,
        `3. 인터랙티브 요소(버튼, 배지, 링크, 호버 상태)에는 강조 색상(\`${accent1}\`, \`${accent2}\`)을 적극 활용하세요.`,
        `4. 컴포넌트의 모서리, 그림자, 간격은 "${parsed.features}"의 느낌을 반영해 설계하세요.`,
        ``,
        `지금부터 위 가이드라인을 엄격히 준수하여 코드를 작성해 주세요.`
      ].join('\n');
    }

    if (format === 'tokens') {
      const bg = colors[0] || '#FFFFFF';
      const text = colors[1] || '#222222';
      const accent1 = colors[2] || '#4A90D9';
      const accent2 = colors[3] || '#E74C3C';
      const slug = (item.id || 'vibe').replace(/[^a-zA-Z0-9가-힣_-]/g, '').toLowerCase();

      return [
        `/* ==================================================== */`,
        `/* [${item.id}] ${item.title} 디자인 토큰 (CSS Variables) */`,
        `/* ==================================================== */`,
        `:root {`,
        `  --vibe-bg: ${bg};`,
        `  --vibe-text: ${text};`,
        `  --vibe-accent-1: ${accent1};`,
        `  --vibe-accent-2: ${accent2};`,
        `  --vibe-theme-name: "${item.title}";`,
        `}`,
        ``,
        `/* ==================================================== */`,
        `/* Tailwind CSS 설정 (tailwind.config.js)                 */`,
        `/* ==================================================== */`,
        `module.exports = {`,
        `  theme: {`,
        `    extend: {`,
        `      colors: {`,
        `        '${slug}': {`,
        `          bg: '${bg}',`,
        `          text: '${text}',`,
        `          accent: '${accent1}',`,
        `          accent2: '${accent2}',`,
        `        },`,
        `      },`,
        `    },`,
        `  },`,
        `};`
      ].join('\n');
    }

    return item.prompt || '';
  }

  const api = {
    normalize,
    filterPrompts,
    parsePromptStructure,
    extractColorEntries,
    buildExportContent
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GalleryCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
