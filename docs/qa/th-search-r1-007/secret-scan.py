"""Local exact-value scan; never prints credentials or environment contents."""
from pathlib import Path
import subprocess,json,re,datetime
root=Path.cwd()
values=[]
for envfile in [root/'.env.local',root/'apps/web/.env.local']:
 if not envfile.exists(): continue
 for line in envfile.read_text(encoding='utf-8').splitlines():
  if '=' not in line: continue
  key,value=line.split('=',1)
  if key.startswith('NEXT_PUBLIC_') or not re.search(r'PASSWORD|SECRET|TOKEN|DATABASE_URL|SERVICE.*KEY',key): continue
  value=value.strip().strip('"')
  if len(value)>18 and '[SENSITIVE]' not in value: values.append(value.encode())
files=[root/p for p in subprocess.check_output(['git','ls-files'],text=True).splitlines()]
files+=list((root/'docs/qa/th-search-r1-007').rglob('*'))
files+=list((root/'apps/web/.next/static').rglob('*'))
hits=[];checked=0
for path in set(files):
 if not path.is_file() or path.suffix.lower() in ['.png','.jpg','.webp','.woff2','.pdf']: continue
 data=path.read_bytes();checked+=1
 if any(value in data for value in values): hits.append(str(path.relative_to(root)))
report={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'method':'Exact server credential values from ignored local runtime env; tracked files, QA artifacts, built client assets','filesChecked':checked,'matches':hits,'pass':not hits}
(root/'docs/qa/th-search-r1-007/secret-scan.json').write_text(json.dumps(report,indent=2)+'\n')
print({'filesChecked':checked,'pass':not hits,'matchedPaths':hits})
assert not hits
