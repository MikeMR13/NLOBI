// Fast unit-level regressions for stable reader anchors and mode persistence.
import assert from 'node:assert/strict';
import { createReaderFlow } from '../src/reader-flow.js';

const store = new Map();
globalThis.localStorage={
 getItem:key=>store.has(key)?store.get(key):null,
 setItem:(key,value)=>store.set(key,String(value)),
 removeItem:key=>store.delete(key)
};
globalThis.document={querySelectorAll:()=>[]};
globalThis.window={innerHeight:800,scrollY:0,scrollTo:()=>{}};
const cloudTime=Date.parse('2026-10-09T12:00:00Z');
const S={
 readerPrefs:{flow:'continuous'},
 readerSection:{id:'chapter-one',translation_id:'translation-one',volume_id:'volume-one',navigation:[]},
 readingProgress:[{section_id:'chapter-one',translation_id:'translation-one',anchor:'p:7:0.25:61.5',updated_at:new Date(cloudTime).toISOString()}],
 user:{id:'user-one'},library:[],view:'reader:chapter-one'
};
const reader=createReaderFlow({
 state:()=>S,renderBlock:b=>'<p>'+b.text+'</p>',escapeText:s=>String(s),
 request:async()=>[],readCache:()=>null,writeCache:()=>{},queueProgress:()=>{},markRead:async()=>{},readIds:()=>new Set()
});
assert.equal(reader.enabled(),true,'continuous mode must be configurable');
assert.equal(reader.active().id,'chapter-one');
assert.deepEqual({...reader.best('chapter-one')},{block:7,offset:.25,percent:61.5,updatedAt:cloudTime});
store.set('nlobi_reader_position_chapter-one',JSON.stringify({block:4,offset:.5,percent:33,updatedAt:cloudTime+1000}));
assert.equal(reader.best('chapter-one').block,4,'a newer local position must win over stale cloud data');
store.set('nlobi_reader_position_chapter-one','invalid-json');
assert.equal(reader.best('chapter-one').block,7,'corrupt local data must not break cloud resume');
S.readingProgress[0].anchor='p:999999:9:200';
assert.equal(reader.best('chapter-one'),null,'reject impossible paragraph anchors');
assert.match(reader.blockHtml([{text:'Uno'},{text:'Dos'}]),/data-block-index="1"/);
S.readerPrefs.flow='chapter';
assert.equal(reader.enabled(),false,'normal reader must remain available');
reader.clear();
console.log('Reader flow regressions OK');
