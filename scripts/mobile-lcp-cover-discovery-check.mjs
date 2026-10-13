import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync('src/index.html','utf8');
const helper=fs.readFileSync('src/home-cover-hint.js','utf8');
const built=fs.existsSync('dist/index.html')?fs.readFileSync('dist/index.html','utf8'):null;
const tag=html.match(/<script\s+src="\/assets\/home-cover-hint\.js[^"]*"\s*><\/script>/);
assert.ok(tag,'LCP preload should execute synchronously from the head');
assert.ok(html.indexOf(tag[0])>html.indexOf('<head>')&&html.indexOf(tag[0])<html.indexOf('</head>'));
assert.ok(html.indexOf(tag[0])<html.indexOf('rel="modulepreload"'));
assert.ok(html.indexOf(tag[0])<html.indexOf('id="siteStyles"'));
assert.ok(html.indexOf(tag[0])<html.indexOf('<script type="module" src="/assets/app.js'));
assert.match(html,/\.homeFeaturedBook/); // Critical geometry for the cover remains present
assert.doesNotMatch(tag[0],/\bdefer\b|\basync\b/);
assert.ok(helper.includes("url.origin!==location.origin"),'same-origin preload guard must remain');
assert.ok(helper.includes("url.pathname.startsWith('/media/')"),'only media paths may preload');
assert.ok(helper.includes("12*60*60*1000"),'stale hints expire');
if(built)assert.match(built,/<script src="\/assets\/home-cover-hint\.js\?v=[a-f0-9]{12}"><\/script>/);
function run(path,hash='#home',at=1000){
 const links=[];
 const head={append(link){links.push(link)}};
 const document={head,createElement(tag){assert.equal(tag,'link');return {dataset:{}};}};
 const localStorage={getItem(){return JSON.stringify({path,at})}};
 const context={location:{hash,origin:'https://nlobi.vercel.app'},document,localStorage,Date:{now:()=>at+1000},URL};
 vm.runInNewContext(helper,context);
 return links;
}
assert.equal(run('/media/teams/demo/covers/cover.png').length,1);
assert.equal(run('https://example.test/cover.png').length,0);
assert.equal(run('/favicon.ico').length,0);
assert.equal(run('/media/demo.png','#detail:1').length,0);
console.log('Mobile LCP discovery: cover hint loads before app/CSS and permits only trusted same-origin media.');
