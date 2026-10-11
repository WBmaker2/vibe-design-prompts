"""Extract supplied PDF images and preserve TXT prompt bodies by identifier."""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / '.tools'))
import pymupdf

source = (ROOT.parent / '56쪽_30가지 디자인 프롬프트 템플릿.txt').read_text(encoding='utf-8-sig')
matches = list(re.finditer(r'^\[([^\]]+)\]\s*(.+)$', source, re.M))
document = pymupdf.open(ROOT.parent / '56쪽_디자인 템플릿 이미지 미리보기.pdf')
assert len(matches) == len(document) == 30
items = []
for index, match in enumerate(matches):
    key, title = match.groups()
    end = matches[index + 1].start() if index + 1 < len(matches) else len(source)
    section = source[match.end():end].split('■')[0]
    lines = section.strip().splitlines()
    body = '\n'.join(line for line in lines if not re.fullmatch(r'\s*`{2,3}\s*', line)).strip()
    page = document[index]
    assert key in page.get_text()
    pdf_title = re.search(r'\[' + re.escape(key) + r'\]\s*(.+)', page.get_text()).group(1)
    assert re.sub(r'\s+', '', pdf_title) == re.sub(r'\s+', '', title)
    # Render only the image area, compositing its alpha mask correctly.
    bounds = pymupdf.Rect(page.get_image_info()[0]['bbox'])
    image = page.get_pixmap(matrix=pymupdf.Matrix(1.8, 1.8), clip=bounds, alpha=False)
    name = f'preview-{index + 1:02d}.jpg'
    (ROOT / 'dist' / 'assets' / name).write_bytes(image.tobytes('jpeg', jpg_quality=90))
    tone = re.search(r'톤:\s*"([^\"]+)"', body).group(1)
    colors = list(dict.fromkeys(re.findall(r'#[A-Fa-f0-9]{6}', body)))
    items.append(dict(id=key, title=title, category=key.split('-')[0], prompt=body,
                      tone=tone.rstrip('.'), colors=colors, image=f'assets/{name}', page=index + 1))
(ROOT / 'dist' / 'data.js').write_text('window.DESIGN_PROMPTS = [\n' + ',\n'.join(json.dumps(item, ensure_ascii=False) for item in items) + '\n];\n', encoding='utf-8')
print(f'Validated {len(items)} exact identifier/title matches and extracted all images.')
