import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const section=(begin,end)=>{const a=source.indexOf(begin),b=source.indexOf(end,a);assert(a>=0&&b>a,'Source fragment missing: '+begin);return source.slice(a,b)};
const css=[
  "/* @font-face { font-family: Fake; src:url('missing.ttf') } */",
  "@font-face {font-family:'Alba';src:url('../fonts/alba.woff2') format('woff2');}",
  '@font-face {font-family:"Times New Roman";src:url("../fonts/times.woff");font-weight:normal}',
  '@font-face {font-family:"Times New Roman";src:url("../fonts/times-bold.woff");font-weight:bold}',
  'body {font-family:"Times New Roman",serif}',
  'span.logo,p.special {font-family:"Alba"}'
].join('\n');
const files={
 'OEBPS/css/book.css':css,
 'OEBPS/fonts/alba.woff2':'a',
 'OEBPS/fonts/times.woff':'b',
 'OEBPS/fonts/times-bold.woff':'c'
};
const zip={
 files:Object.fromEntries(Object.keys(files).map(x=>[x,{}])),
 file(name){return Object.hasOwn(files,name)?{_data:{uncompressedSize:files[name].length},async:async()=>files[name]}:null}
};
const sandbox={
 Node:{ELEMENT_NODE:1,TEXT_NODE:3},
 epubHrefKey:(base,rel)=>path.posix.normalize(path.posix.join(base,decodeURIComponent(rel))),
 console
};
vm.createContext(sandbox);
vm.runInContext(section('function epubFontFamilyNames','async function parseEpubRich'),sandbox);
vm.runInContext(section('function epubFontIndex','async function uploadEmbeddedEpubFonts'),sandbox);
const warnings=[];
const output=await sandbox.epubEmbeddedFonts(zip,{'style':{href:'css/book.css',mediaType:'text/css'}},'OEBPS/',warnings);
assert.equal(output.fonts.length,3,'Embedded font variants should all be detected');
assert.equal(output.fonts.filter(x=>x.family==='Times New Roman').length,2,'Two weights should remain distinct');
assert.equal(output.fonts.filter(x=>x.primary).length,2,'The default paragraph family should be tagged');
assert.equal(sandbox.epubFontIndex('"Alba",sans-serif',['Times New Roman','Alba']),1,'Family lookup');
const resolve=sandbox.epubFontCssResolver(output.fonts,output.styles);
const element=(selectors=[],parentElement=null,style=null)=>({
 nodeType:1,parentElement,selectors,
 matches(selector){return selectors.includes(selector)},
 getAttribute(name){return name==='style'?style:null}
});
const body=element(['body']);
const paragraph=element(['p'],body);
const logo=element(['span.logo'],paragraph);
const manual=element([],paragraph,'font-family: Alba; color:red');
assert.equal(resolve(paragraph),1,'Paragraph should inherit the body face');
assert.equal(resolve(logo),0,'A class-specific font should override inherited styles');
assert.equal(resolve(manual),0,'Inline font-family should override CSS declarations');

const inlineContext={
 Node:{ELEMENT_NODE:1,TEXT_NODE:3},
 importTextBlock:(value,type)=>value.trim()?{type,text:value.trim()}:null,
 editorialSafeHtml:html=>html,
 esc:value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'),
 rubyBlock:()=>null
};
vm.createContext(inlineContext);
vm.runInContext(section('function inlineContainerBlocks','function blocksToPlainText'),inlineContext);
const leading={nodeType:3,textContent:'Hola '};
const special={nodeType:1,tagName:'SPAN',childNodes:[{nodeType:3,textContent:'¡Quantico!'}]};
const group={childNodes:[leading,special]};
const blocks=inlineContext.inlineContainerBlocks(group,'paragraph',node=>node===special?2:1);
assert.equal(blocks.length,1,'Inline font changes must not split a paragraph');
assert.equal(blocks[0].text,'Hola ¡Quantico!');
assert.match(blocks[0].html,/data-epub-family="1"/);
assert.match(blocks[0].html,/data-epub-family="2"/);
assert.match(source,/face=new FontFace\('NLOBI-EPUB-'\+index/,'Use a stable unique family index per weight/style variant');
assert.match(source,/reader-font-original \[data-epub-family/,'Original mode must apply preserved inline styles');
console.log('EPUB font preservation regression: OK');
