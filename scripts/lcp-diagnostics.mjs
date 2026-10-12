import fs from 'node:fs';

// Analiza el informe Lighthouse del CI sin bloquearlo por datos opcionales.
const file='performance-results/mobile-home.json';
if(!fs.existsSync(file)){
 console.log('LCP diagnostics: no existe el informe Lighthouse en esta ejecución');
 process.exit(0);
}
const report=JSON.parse(fs.readFileSync(file,'utf8'));
const audits=report.audits||{};
const metrics=Object.fromEntries([
 ['LCP','largest-contentful-paint'],['FCP','first-contentful-paint'],
 ['TTFB','server-response-time'],['TBT','total-blocking-time'],
 ['CLS','cumulative-layout-shift']
].map(([label,key])=>[label,{
 value:audits[key]?.numericValue??null,display:audits[key]?.displayValue||''
}]));
const elementAudit=audits['largest-contentful-paint-element'];
const candidate=elementAudit?.details?.items?.[0];
const node=candidate?.node||{};
const lcpElement={selector:node.selector||'',snippet:String(node.snippet||'').slice(0,420),url:node.nodeLabel||'',resource:candidate?.url||''};
console.log('LCP diagnostics:',JSON.stringify({metrics,element:lcpElement}));
for(const key of ['lcp-breakdown-insight','lcp-discovery-insight','render-blocking-resources','network-dependency-tree-insight']){
 const audit=audits[key];
 if(audit)console.log('LCP insight '+key+':',JSON.stringify({score:audit.score,displayValue:audit.displayValue,details:audit.details?.items?.slice(0,5)}).slice(0,3200));
}
