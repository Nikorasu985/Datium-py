import os
import re

templates_dir = os.path.join(os.path.dirname(__file__), 'Datium', 'templates')

stats_nav = '''                    <a href="stats.html"
                        class="flex items-center gap-3 px-4 py-3 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl text-sm font-medium transition-colors">
                        <span class="material-symbols-outlined">bar_chart</span>
                        Estadísticas
                    </a>'''

stats_active = '''                    <a href="stats.html"
                        class="flex items-center gap-3 px-4 py-3 bg-primary/10 text-primary rounded-xl text-sm font-bold shadow-sm shadow-primary/10">
                        <span class="material-symbols-outlined">bar_chart</span>
                        Estadísticas
                    </a>'''

audit_pattern = re.compile(
    r'(\s*<a\s+href="audit\.html")',
    re.MULTILINE
)

for fname in os.listdir(templates_dir):
    if not fname.endswith('.html'):
        continue
    if fname == 'stats.html':
        continue
    fpath = os.path.join(templates_dir, fname)
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read()

    if 'stats.html' in content:
        print(f'SKIP {fname} (already has stats)')
        continue

    if 'audit.html' not in content:
        print(f'SKIP {fname} (no audit link found)')
        continue

    insert = stats_nav + '\n'
    new_content = audit_pattern.sub(insert + r'\1', content, count=1)

    if new_content != content:
        with open(fpath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f'UPDATED {fname}')
    else:
        print(f'NO CHANGE {fname}')
