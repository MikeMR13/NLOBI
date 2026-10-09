import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const handlers = new Map();
const records = new Map();
const keyOf = item => typeof item === 'string' ? item : item.url;
const cache = {
  async put(key, response) { records.set(keyOf(key), response.clone()); },
  async match(key) { const match = records.get(keyOf(key)); return match ? match.clone() : null; },
};
const caches = {
  async open() { return cache; },
  async match(key) { return cache.match(key); },
  async keys() { return ['nlobi-shell-v19-8']; },
  async delete() { return true; },
};
let online = true;
let networkCalls = 0;
async function fetchMock(request) {
  if (!online) throw new Error('Connection lost');
  return new Response('revision-' + (++networkCalls), {status:200});
}
const self = {
  location: {origin:'https://nlobi.vercel.app'},
  addEventListener(name,handler) { handlers.set(name,handler); },
};
vm.runInNewContext(fs.readFileSync('public/sw.js','utf8'), {self,caches,fetch:fetchMock,Response,URL,Promise,console});
assert.ok(handlers.has('fetch'), 'Service Worker has no fetch handler');

async function intercepted(url, method='GET') {
  let response;
  handlers.get('fetch')({
    request: {url,method,mode:'cors'},
    respondWith(value) { response=value; },
  });
  return response ? await response : null;
}

const media = 'https://nlobi.vercel.app/media/teams/demo/cover.jpg';
assert.equal(await (await intercepted(media)).text(),'revision-1', 'First cover must load from network');
assert.equal(await (await intercepted(media)).text(),'revision-2', 'Updated cover must bypass cached copy');
online=false;
assert.equal(await (await intercepted(media)).text(),'revision-2', 'Offline cover must fall back to latest cache');
online=true;

const icon = 'https://nlobi.vercel.app/icon.svg';
assert.equal(await (await intercepted(icon)).text(),'revision-3');
assert.equal(await (await intercepted(icon)).text(),'revision-3', 'Stable static assets should be cache-first');
assert.equal(networkCalls,3);
assert.equal(await intercepted(media,'POST'),null, 'Never intercept write operations');
assert.equal(await intercepted('https://another.example/media/cover.jpg'),null,'Never intercept other origins');
console.log('PWA media refresh and offline cache: OK');
