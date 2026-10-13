import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';

const base='http://127.0.0.1:4173/';
const variants=[
 'original','epub','serif','sans','literata','merriweather','lora',
 'garamond','baskerville','palatino','verdana','trebuchet','arial','mono'
];
for(const [engine,browserType] of [['Chromium',chromium],['WebKit',webkit]]){
 const browser=await browserType.launch({headless:true});
 try{
  for(const viewport of [{width:390,height:844},{width:1280,height:850}]){
   const page=await browser.newPage({viewport});
   try{
    await page.route('**/assets/app.js*',route=>route.abort());
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await page.setContent(`<!doctype html><html lang="es"><head>
      <link rel="stylesheet" href="/assets/styles.css"></head><body>
      <main class="readerExperience readerPresentation-classic">
       <article class="readerPaper reader-font-original" style="font-size:16px;--epub-reader-font:'NLOBI-EPUB-0',Georgia,serif">
        <h1 id="chapterTitle">Capítulo de prueba</h1>
        <p id="chapterParagraph">Párrafo con <strong>negrita</strong> y <em>cursiva</em>.</p>
        <h2 class="readerHeading" data-epub-family="1">Encabezado del EPUB</h2>
        <div class="readerContinuousHeading"><h2>Capítulo siguiente</h2></div>
       </article>
      </main></body></html>`);
    await page.addStyleTag({content:'.readerPaper.reader-font-original [data-epub-family="1"]{font-family:"NLOBI-EPUB-1",Georgia,serif}'});
    await page.waitForFunction(()=>!!document.styleSheets.length);
    for(const family of variants){
     for(const fontSize of [16,24]){
      const result=await page.evaluate(({family,fontSize})=>{
       const paper=document.querySelector('.readerPaper');
       paper.className='readerPaper reader-font-'+family;
       paper.style.fontSize=fontSize+'px';
       const paragraph=document.querySelector('#chapterParagraph');
       const title=document.querySelector('#chapterTitle');
       const importedHeading=document.querySelector('.readerHeading');
       const continuousHeading=document.querySelector('.readerContinuousHeading h2');
       const style=el=>getComputedStyle(el);
       return {
        p:style(paragraph).fontFamily,
        title:style(title).fontFamily,
        heading:style(importedHeading).fontFamily,
        continuous:style(continuousHeading).fontFamily,
        titleSize:parseFloat(style(title).fontSize),
        headingSize:parseFloat(style(importedHeading).fontSize),
        continuousSize:parseFloat(style(continuousHeading).fontSize),
        bold:style(paragraph.querySelector('strong')).fontWeight,
        italic:style(paragraph.querySelector('em')).fontStyle
       };
      },{family,fontSize});
      assert.equal(result.title,result.p,`${engine} ${viewport.width} ${family}: chapter title must match reader font`);
      assert.equal(result.continuous,result.p,`${engine} ${viewport.width} ${family}: continuous chapter must match reader font`);
      if(family==='original'){
       assert.match(result.heading,/NLOBI-EPUB-1/,`${engine}: original EPUB title family must survive`);
       assert.match(result.p,/NLOBI-EPUB-0/,`${engine}: original EPUB primary family must survive`);
      }else{
       assert.equal(result.heading,result.p,`${engine} ${viewport.width} ${family}: imported headings must follow selection`);
      }
      assert.ok(parseInt(result.bold,10)>=600,'Bold emphasis lost');
      assert.equal(result.italic,'italic','Italic emphasis lost');
      if(fontSize===16)page._typography16=result;
      else for(const key of ['titleSize','headingSize','continuousSize']){
       assert.ok(result[key]>page._typography16[key],`${engine} ${viewport.width} ${family}: ${key} must increase with reader font size`);
      }
     }
    }
   }finally{await page.close()}
  }
 }finally{await browser.close()}
}
console.log('EPUB reader heading font and size (Chromium/WebKit): OK');
