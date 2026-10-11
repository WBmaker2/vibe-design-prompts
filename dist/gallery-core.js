(function (root) {
  function normalize(value) {
    return String(value).normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, '');
  }
  function filterPrompts(items, category, query) {
    const terms = String(query).trim().split(/\s+/).filter(Boolean).map(normalize);
    return items.filter(item => {
      const haystack = normalize([item.id, item.category, item.title, item.prompt].join(' '));
      return (category === '전체' || item.category === category) && terms.every(term => haystack.includes(term));
    });
  }
  const api = { filterPrompts };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GalleryCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
