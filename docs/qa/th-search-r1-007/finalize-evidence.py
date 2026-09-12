"""Record observed runtime release; never invent a future evidence-merge SHA."""
from pathlib import Path
import json,datetime
p=Path('docs/qa/th-search-r1-007')
r=json.loads((p/'result.json').read_text())
b=json.loads((p/'production-browser.json').read_text())
s=json.loads((p/'production-supplement.json').read_text())
assert len(b['cases'])==22 and not b['errors'] and not b['failures']
assert len(s['checks'])==10 and not s['failures']
r.update(status='RELEASED_AND_VERIFIED',closed=True,testedImplementation='037032a5ce0224f1e1d164e5913122011e8c73bc',runtimeMerge='12169288367b157a4c5c0264992cae8c972270cd',finalDeployment='dpl_45tKXBMzcLD3ZG6JeN1xppVng7Pt',verifiedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),remainingReleaseSteps=[])
r['focusedGate']['passed']=73
r['fullTests']={'webPassed':350,'domainPassed':253,'existingSkipped':6}
r['productionBrowser']={'file':'production-browser.json','searchCases':22,'headerWidths':[320,390,768,1024,1280,1440,1920],'failures':0,'errors':0,'supplement':'production-supplement.json','supplementChecks':10,'actual200PercentZoom':'production-actual-zoom.json','minimumCaseMs':min(x['ms'] for x in b['cases']),'maximumCaseMs':max(x['ms'] for x in b['cases'])}
r['ci']={'run':34668542773,'sha':r['testedImplementation'],'web':'PASS','ingest':'PASS','migrations':'PASS','vercelPreview':'PASS','previewInteractive':'Vercel login protected; not bypassed'}
r['baselineLimitations']=['Unchanged cms-refresh.yml cannot create jobs: baseline run 34623782631 and candidate runs fail with empty jobs; required PR CI passed.','Windows CRLF full format check differs from Linux; existing Linux CI formatting passed.','Five existing dependency audit findings; lockfile unchanged.','Six existing fixture-database/environment test skips.']
r['evidenceFollowup']={'branch':'th-search-r1-007-evidence','scope':'Documentation and observed QA receipts only','mergeSha':None,'note':'Not known when this artifact was authored; final follow-up deployment verified in completion report.'}
(p/'result.json').write_text(json.dumps(r,indent=2)+'\n')
receipt={'observedAt':r['verifiedAt'],'runtimeMerge':r['runtimeMerge'],'implementationHead':r['testedImplementation'],'deployment':r['finalDeployment'],'state':'READY','aliases':['seniortrusthub.com','www.seniortrusthub.com'],'pr':'https://github.com/savitz25/care-trust-hub/pull/31','mergedAt':'2026-09-12T02:48:59Z','productionBrowser':r['productionBrowser'],'runtimeLogs':{'filter':'runtime merge deployment, production, last30m, error/fatal, grouped by level','observedGroups':[]},'dataWrites':False,'reviewMethod':r['review']['method']}
(p/'release-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
