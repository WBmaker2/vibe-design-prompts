const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  filterPrompts,
  parsePromptStructure,
  extractColorEntries,
  buildExportContent
} = require('../dist/gallery-core.js');

const sample = [
  {
    id: '학습-01',
    category: '학습',
    title: '노트 낙서',
    prompt: `전체 디자인 설정:
  톤: "수기, 아이디어, 자유로움, 학교, 메모."
  시각적 아이덴티티:
    배경색: "#FFFEF2 (약간 누런 노트 종이)"
    텍스트 색상: "#2B2B2B (연필 흑연 색)"
    강조 색상: "#4A90D9 (파란 볼펜), #E74C3C (빨간 볼펜)"
    이미지 스타일:
      특징: "줄 노트 위에 손으로 쓴 듯한 느낌."
      이미지: "별표, 밑줄, 화살표, 체크박스, 여백 낙서."
      텍스처: "종이 질감, 연필 자국, 지우개 흔적."
      구성: "노트 한 페이지를 보는 듯한 세로 레이아웃."
  타이포그래피:
    제목: "손글씨 느낌의 펜 서체."
    스타일: "줄 노트 위에 자유롭게 쓴 느낌."`,
    tone: '수기, 아이디어, 자유로움, 학교, 메모',
    colors: ['#FFFEF2', '#2B2B2B', '#4A90D9', '#E74C3C']
  },
  {
    id: '자연-01',
    category: '자연',
    title: '보타니컬 가든',
    prompt: `전체 디자인 설정:
  톤: "생명력, 치유, 유기적, 느림, 자연주의."
  시각적 아이덴티티:
    배경색: "#F0F4EC (연한 세이지 그린)"
    텍스트 색상: "#2C4A1E (딥 포레스트 그린)"
    강조 색상: "#E8C4A0 (따뜻한 베이지), #C9E0C0 (소프트 민트)"
    이미지 스타일:
      특징: "수채화로 그린 식물 세밀화 느낌."
      이미지: "잎맥이 보이는 나뭇잎, 들꽃, 씨앗 단면도."
      텍스처: "수채 번짐, 종이 결이 보이는 질감."
      구성: "비대칭 배치, 여백에 식물 요소 산재."
  타이포그래피:
    제목: "우아한 이탤릭 세리프."
    스타일: "라틴어 식물 학명 스타일, 섬세한 획."`,
    tone: '생명력, 치유, 유기적, 느림, 자연주의',
    colors: ['#F0F4EC', '#2C4A1E', '#E8C4A0', '#C9E0C0']
  }
];

// 1. 기존 필터 테스트
test('빈 검색은 모든 항목을 보존한다', () => {
  assert.deepEqual(filterPrompts(sample, '전체', ''), sample);
});

test('카테고리와 검색은 동시에 적용된다', () => {
  assert.equal(filterPrompts(sample, '학습', '그린').length, 0);
});

test('띄어쓰기 없이도 제목을 찾는다', () => {
  assert.equal(filterPrompts(sample, '전체', '노트낙서')[0].id, '학습-01');
});

test('원문 분위기도 검색한다', () => {
  assert.equal(filterPrompts(sample, '자연', '자연주의')[0].id, '자연-01');
});

test('일치하지 않으면 빈 결과를 반환한다', () => {
  assert.deepEqual(filterPrompts(sample, '전체', '없는결과'), []);
});

// 2. 신규 즐겨찾기 필터 테스트
test('즐겨찾기 카테고리는 북마크된 항목만 반환한다', () => {
  const result = filterPrompts(sample, '즐겨찾기', '', ['자연-01']);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, '자연-01');
});

test('즐겨찾기와 검색어가 결합된다', () => {
  const result = filterPrompts(sample, '즐겨찾기', '노트', ['학습-01', '자연-01']);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, '학습-01');
});

// 3. 구조화 파서 테스트
test('parsePromptStructure는 프롬프트 항목을 정확히 분해한다', () => {
  const parsed = parsePromptStructure(sample[0]);
  assert.equal(parsed.id, '학습-01');
  assert.equal(parsed.tone, '수기, 아이디어, 자유로움, 학교, 메모.');
  assert.equal(parsed.background, '#FFFEF2 (약간 누런 노트 종이)');
  assert.equal(parsed.features, '줄 노트 위에 손으로 쓴 듯한 느낌.');
  assert.equal(parsed.typoTitle, '손글씨 느낌의 펜 서체.');
});

// 4. 색상 엔트리 추출 테스트
test('extractColorEntries는 색상 코드와 라벨을 추출한다', () => {
  const colors = extractColorEntries(sample[0]);
  assert.ok(colors.length >= 3);
  assert.equal(colors[0].hex, '#FFFEF2');
  assert.equal(colors[0].label, '약간 누런 노트 종이');
});

// 5. 내보내기 포맷 생성 테스트
test('buildExportContent raw 포맷은 원문을 그대로 보존한다', () => {
  const raw = buildExportContent(sample[0], 'raw');
  assert.equal(raw, sample[0].prompt);
});

test('buildExportContent remix 포맷은 주제와 타겟을 반영한다', () => {
  const remix = buildExportContent(sample[0], 'remix', {
    topic: '독서 일기 앱',
    target: '모바일 웹'
  });
  assert.ok(remix.includes('독서 일기 앱'));
  assert.ok(remix.includes('모바일 웹'));
  assert.ok(remix.includes('시각적 아이덴티티:'));
});

test('buildExportContent aicoding 포맷은 시스템 프롬프트 형식으로 생성한다', () => {
  const prompt = buildExportContent(sample[0], 'aicoding', {
    topic: '학습 플랫폼 대시보드'
  });
  assert.ok(prompt.includes('바이브 코딩 디자인 구현 지시문'));
  assert.ok(prompt.includes('학습 플랫폼 대시보드'));
  assert.ok(prompt.includes('디자인 토큰 (Design Tokens)'));
});

test('buildExportContent tokens 포맷은 CSS 변수와 Tailwind 설정을 생성한다', () => {
  const tokens = buildExportContent(sample[0], 'tokens');
  assert.ok(tokens.includes(':root {'));
  assert.ok(tokens.includes('--vibe-bg: #FFFEF2;'));
  assert.ok(tokens.includes('tailwind.config.js'));
});
