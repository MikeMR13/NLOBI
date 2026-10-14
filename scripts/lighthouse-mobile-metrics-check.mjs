import assert from 'node:assert/strict';
import fs from 'node:fs';
import {median,lighthouseMetrics,summarizeLighthouse,performanceWarnings} from './lighthouse-mobile-metrics.mjs';

const fake=(score,lcp,tbt,access=1)=>({
 categories:{performance:{score:score/100},accessibility:{score:access}},
 audits:{
  'largest-contentful-paint':{numericValue:lcp},
  'first-contentful-paint':{numericValue:lcp/2},
  'total-blocking-time':{numericValue:tbt},
  'cumulative-layout-shift':{numericValue:.03},
  'server-response-time':{numericValue:100}
 }
});
assert.equal(median([3,1,5]),3);
assert.equal(median([4,2]),3);
assert.equal(median([]),null);
assert.equal(lighthouseMetrics(fake(90,2000,100)).performance,90);
const reports=[fake(89,2100,110),fake(91,1900,90),fake(50,5500,1900),fake(90,2050,100),fake(92,1970,95)];
const summary=summarizeLighthouse(reports);
assert.equal(summary.sampleCount,5);
assert.equal(summary.performance,90,'No usar el peor resultado aislado');
assert.equal(summary.LCP,2050);
assert.equal(summary.TBT,100);
assert.equal(summary.CLS,.03);
assert.ok(summary.representativeIndex>=0&&summary.representativeIndex<5);
assert.ok(performanceWarnings(summary).some(w=>w.includes('variación')));
assert.throws(()=>summarizeLighthouse([]));
assert.ok(fs.readFileSync('src/app.js','utf8').includes('requestIdleCallback(startSecondary,{timeout:2400})'),
 'Las consultas auxiliares no deben competir con la primera carga');
assert.ok(fs.readFileSync('src/app.js','utf8').includes("requestIdleCallback(registerPwa,{timeout:5500})"),
 'Registrar PWA después de la ruta crítica');
const workflow=fs.readFileSync('.github/workflows/ci.yml','utf8');
assert.ok(workflow.includes('node scripts/lighthouse-mobile-batch.mjs'));
assert.ok(workflow.includes('node scripts/lcp-diagnostics.mjs'));
console.log('Lighthouse mobile median and Home idle work regression: OK');
