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
const special={nodeType:1,tagName:'SPAN',getAttribute:name=>name==='style'?'font-weight: bold':null,childNodes:[{nodeType:3,textContent:'¡Quantico!'}]};
const group={childNodes:[leading,special]};
const blocks=inlineContext.inlineContainerBlocks(group,'paragraph',node=>node===special?2:1);
assert.equal(blocks.length,1,'Inline font changes must not split a paragraph');
assert.equal(blocks[0].text,'Hola ¡Quantico!');
assert.match(blocks[0].html,/data-epub-family="1"/);
assert.match(blocks[0].html,/data-epub-family="2"/);
assert.match(blocks[0].html,/<strong>/,'Inline bold variants must survive import');

const semanticGroup={childNodes:[
 {nodeType:3,textContent:'Texto '},
 {nodeType:1,tagName:'STRONG',getAttribute:()=>null,childNodes:[{nodeType:3,textContent:'negrita'}]},
 {nodeType:3,textContent:' y '},
 {nodeType:1,tagName:'EM',getAttribute:()=>null,childNodes:[{nodeType:3,textContent:'cursiva'}]}
]};
const sem=inlineContext.inlineContainerBlocks(semanticGroup,'paragraph');
assert.equal(sem.length,1,'Semantic formatting should remain inside one paragraph');
assert.equal(sem[0].text,'Texto negrita y cursiva');
assert.match(sem[0].html,/<strong>negrita<\/strong>/,'Bold must survive without an EPUB font');
assert.match(sem[0].html,/<em>cursiva<\/em>/,'Italic must survive without an EPUB font');
assert.ok(!sem[0].html.includes('data-epub-family'),'Rich HTML must be preserved independently of embedded fonts');

const cssEmphasis=[
 'p.emphasis {font-weight:700;font-style:italic}',
 'span.normal {font-weight:400;font-style:normal}'
];
const resolver= sandbox.epubFontCssResolver([],cssEmphasis);
const para=element(['p.emphasis']),reset=element(['span.normal'],para);
assert.equal(resolver.textStyle(para).bold,true,'EPUB stylesheet class should set bold');
assert.equal(resolver.textStyle(para).italic,true,'EPUB stylesheet class should set italic');
assert.equal(resolver.textStyle(reset).bold,false,'Nested class should cancel inherited bold');
assert.equal(resolver.textStyle(reset).italic,false,'Nested class should cancel inherited italic');
const paraStyled={childNodes:[{nodeType:3,textContent:'Mensaje importante'}]};
const styled=inlineContext.inlineContainerBlocks(paraStyled,'paragraph',()=>null);
assert.equal(styled.length,1);
const styledFont=inlineContext.inlineContainerBlocks(paraStyled,'paragraph',Object.assign(()=>null,{textStyle:()=>({bold:true,italic:true})}));
assert.match(styledFont[0].html,/<strong><em>Mensaje importante<\/em><\/strong>|<em><strong>Mensaje importante<\/strong><\/em>/,'CSS-only emphasis should survive with no embedded fonts');

const readerContext={
 normalizeBlock:block=>block,
 editorialSafeHtml:html=>html,
 esc:value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'),
 safeMediaUrl:value=>value,safeUrl:value=>value
};
vm.createContext(readerContext);
vm.runInContext(section('function renderReaderBlock','function importSteps'),readerContext);
const richReader=readerContext.renderReaderBlock({type:'paragraph',text:'Texto negrita y cursiva',html:'Texto <strong>negrita</strong> y <em>cursiva</em>'});
assert.match(richReader,/<strong>negrita<\/strong>/,'Reader should render preserved bold tags');
assert.match(richReader,/<em>cursiva<\/em>/,'Reader should render preserved italic tags');


assert.match(source,/face=new FontFace\('NLOBI-EPUB-'\+index/,'Use a stable unique family index per weight/style variant');
assert.match(source,/reader-font-original \[data-epub-family/,'Original mode must apply preserved inline styles');

// Netgame stores Alba/Alba Matter as data-epub-family=0 on chapter headings,
 // while the narrative uses a separate Times New Roman face.
vm.runInContext(section('function readerEpubTitleFontIndex','function renderReaderBlock'),readerContext);
const netgameChapter={
 title:'Prólogo: Solicitud de presupuesto rechazada',
 content:[
  {type:'image',url:'https://example.invalid/illustration.jpg'},
  {type:'heading',text:'Prólogo: Solicitud de presupuesto rechazada',html:'<span data-epub-family="0">Prólogo: Solicitud de presupuesto rechazada</span>'},
  {type:'paragraph',text:'Texto narrativo',html:'<span data-epub-family="4">Texto narrativo</span>'}
 ]
};
assert.equal(readerContext.readerEpubTitleFontIndex(netgameChapter),0,'Netgame must use its special title family, not body family');
assert.equal(readerContext.readerEpubTitleAttribute(netgameChapter),' data-epub-family="0"');
assert.equal(readerContext.readerEpubTitleFontIndex({...netgameChapter,content:[{type:'heading',text:'Otro título',html:'<span data-epub-family="0">Otro título</span>'}]}),null,'An unrelated heading must not rename the chapter font');
assert.equal(readerContext.readerEpubTitleAttribute({...netgameChapter,content:[{type:'heading',text:netgameChapter.title,html:'<span data-epub-family="99">Título</span>'}]}),'','Out-of-range family IDs must be rejected');
assert.match(source,/<h1 id="chapterTitle"\$\{readerEpubTitleAttribute\(R\)\}>/,'Main chapter title must restore original heading font');
assert.match(source,/<h2\$\{readerEpubTitleAttribute\(ch\)\}>/,'Continuous chapter title must restore original heading font');

const studio=fs.readFileSync(new URL('../src/studio-phase7.js',import.meta.url),'utf8');
const vercel=fs.readFileSync(new URL('../vercel.json',import.meta.url),'utf8');
assert.match(source,/Promise\.all\(entries\.map/,'All EPUB variants should load concurrently');
assert.match(vercel,/font-src[^;]*https:\/\/\*\.supabase\.co/,'Allow approved storage origin as a font fallback');
assert.match(source,/activateEpubFonts,epubFontFamilyNames/,'Studio should receive embedded font loader');
assert.match(source,/cover_url,epub_fonts,is_final_volume/,'Studio must request volume font metadata');
assert.match(studio,/activateEpubFonts\(fonts\)/,'Studio preview must load EPUB faces');

let loading=0,peak=0,renderCalls=0,proxyFailures=0;
const added=new Set(),sheets=new Map();
class FontFaceStub{
 constructor(family,url,properties){this.family=family;this.url=url;this.properties=properties}
 async load(){
  loading++;peak=Math.max(peak,loading);
  await Promise.resolve();
  loading--;
  if(this.url.includes('/media/')){proxyFailures++;throw new Error('Simulated media rewrite issue')}
  return this;
 }
}
const entries=[0,1,2].map(i=>({family:'Font '+i,url:'https://project.supabase.co/storage/v1/object/public/nlobi-media/teams/test/font-'+i+'.ttf',style:'normal',weight:'normal'}));
Object.assign(sandbox,{
 URL:'https://project.supabase.co',
 window:{FontFace:FontFaceStub},FontFace:FontFaceStub,
 S:{view:'reader:test',readerSection:{epub_fonts:entries}},
 safeUrl:x=>x,
 safeMediaUrl:x=>x.replace('https://project.supabase.co/storage/v1/object/public/nlobi-media/','/media/'),
 render:()=>{renderCalls++},
 document:{
  fonts:{add:x=>added.add(x),delete:x=>added.delete(x)},
  getElementById:id=>sheets.get(id)||null,
  createElement:()=>({id:'',textContent:''}),
  head:{appendChild:node=>sheets.set(node.id,node)}
 }
});
await sandbox.activateEpubFonts(entries);
assert.ok(peak>=3,'Embedded font loads should be concurrent, not serial');
assert.equal(proxyFailures,3,'The test must exercise a failing proxy path');
assert.equal(added.size,3,'All fonts should retry against approved storage when the proxy fails');
assert.equal(sandbox.S.epubFontCount,3);
assert.ok(sandbox.S.epubFontAvailable.has(0));
assert.equal(sandbox.S.epubFontFailures,0);
assert.equal(renderCalls,1);
assert.match(sheets.get('nlobiEpubFontStyles').textContent,/reader-font-original/);
await sandbox.activateEpubFonts(entries);
assert.equal(renderCalls,1,'Do not reload the same font set unnecessarily');
console.log('EPUB font loading regression: concurrent variants and storage fallback OK');

console.log('EPUB font preservation regression: OK');
