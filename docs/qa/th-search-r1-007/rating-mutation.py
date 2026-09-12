from pathlib import Path
import subprocess,json,datetime
p=Path('apps/web/src/app/ask/ask-result-view.tsx'); original=p.read_text(encoding='utf-8')
assert 'value={item.rating.value}' in original
try:
 p.write_text(original.replace('value={item.rating.value}','value={Number(item.value[0])}'),encoding='utf-8')
 r=subprocess.run('npm exec --workspace=@care/web -- vitest run --configLoader runner src/server/care/r1-007-search.test.ts',shell=True,capture_output=True,text=True,encoding='utf-8',errors='replace')
 Path('docs/qa/th-search-r1-007/mutation-rating-prose.log').write_text(r.stdout+r.stderr,encoding='utf-8')
 print({'mutation':'rating-from-prose','detected':r.returncode!=0})
 assert r.returncode!=0
finally: p.write_text(original,encoding='utf-8')
