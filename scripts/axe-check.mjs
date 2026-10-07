import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';

const urls=[
  'http://127.0.0.1:4173/#home',
  'http://127.0.0.1:4173/#explore',
  'http://127.0.0.1:4173/#auth'
];

fs.mkdirSync('axe-results',{recursive:true});
const browser=await chromium.launch({headless:true});
let failed=false;
const report=[];

for(const url of urls){
  const page=await browser.newPage();
  await page.goto(url,{waitUntil:'networkidle'});
  const results=await new AxeBuilder({page}).analyze();
  report.push({url,violations:results.violations});
  console.log(`${url}: ${results.violations.length} violation(s)`);
  for(const v of results.violations){
    failed=true;
    console.log(`- [${v.impact||'unknown'}] ${v.id}: ${v.help}`);
    for(const n of v.nodes.slice(0,10)) console.log(`  ${n.target.join(' ')}`);
  }
  await page.close();
}
await browser.close();
fs.writeFileSync('axe-results/axe-report.json',JSON.stringify(report,null,2));
if(failed)process.exit(1);
