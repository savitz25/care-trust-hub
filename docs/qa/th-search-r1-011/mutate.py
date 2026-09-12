from pathlib import Path
import subprocess,json,datetime
root=Path.cwd();d=root/'docs/qa/th-search-r1-011';results=[]
cases=[('identity-guard','apps/web/src/server/care/senior-ask-parse.ts','facilityQuestion(raw) ?? interpretSeniorAskQueryCore(raw, page)','interpretSeniorAskQueryCore(raw, page)'),('category-as-owner','apps/web/src/server/care/senior-facility-evidence.ts','label: "CMS ownership category"','label: "Owned by"'),('ccn-miss-broadens','apps/web/src/server/care/senior-ask-execute.ts','    if (query.geography) {\n      const geo = query.geography;','    if (!entities.length) entities.push(...(await searchNursingHomes({mode:"entity",page:1})).rows);\n    if (query.geography) {\n      const geo = query.geography;')]
for name,file,old,new in cases:
 p=root/file;original=p.read_bytes();s=original.decode();assert old in s,name
 try:
  p.write_bytes(s.replace(old,new,1).encode());r=subprocess.run(['npm.cmd','run','check:th-search-r1-011'],capture_output=True);(d/('mutation-'+name+'.log')).write_bytes(r.stdout+r.stderr);results.append({'mutation':name,'exit':r.returncode,'detected':r.returncode!=0})
 finally:p.write_bytes(original)
r=subprocess.run(['npm.cmd','run','check:th-search-r1-011'],capture_output=True);(d/'focused-green.log').write_bytes(r.stdout+r.stderr)
(d/'mutations.json').write_text(json.dumps({'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'results':results,'restored':True,'cleanExit':r.returncode},indent=2),encoding='utf-8');print(results,'clean',r.returncode)
