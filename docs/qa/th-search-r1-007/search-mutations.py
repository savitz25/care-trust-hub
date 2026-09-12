from pathlib import Path
import subprocess, json, datetime
p=Path('apps/web/src/server/care/senior-ask-execute.ts')
original=p.read_text(encoding='utf-8')
mutations=[('drop-city','conditions.push(`upper(trim(city))=${p(query.geography.value.toUpperCase())}`);'),('drop-state','conditions.push(`state_code=${p(query.geography.state)}`);')]
report=[]
for name,target in mutations:
 assert target in original, target
 try:
  p.write_text(original.replace(target,'void 0; /* deliberate test-sensitivity mutation */'),encoding='utf-8')
  r=subprocess.run('npm exec --workspace=@care/web -- vitest run --configLoader runner src/server/care/r1-007-search.test.ts',shell=True,capture_output=True,text=True,encoding='utf-8',errors='replace')
  Path(f'docs/qa/th-search-r1-007/mutation-{name}.log').write_text(r.stdout+r.stderr,encoding='utf-8')
  report.append({'mutation':name,'exitCode':r.returncode,'detected':r.returncode!=0})
 finally: p.write_text(original,encoding='utf-8')
Path('docs/qa/th-search-r1-007/mutations.json').write_text(json.dumps({'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'results':report,'restored':True},indent=2))
print(report)
assert all(x['detected'] for x in report)

