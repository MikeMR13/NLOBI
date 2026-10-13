import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createHash, webcrypto} from 'node:crypto';

const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const start=app.indexOf('async function epubObfuscatedFonts(');
const end=app.indexOf('async function epubEmbeddedFonts(',start);
assert(start>0&&end>start,'EPUB obfuscation helpers must exist');
const uuid='urn:uuid:9ac9c5ce-1b79-4f41-9d10-acd180154a0e';
const fontFile='EPUB/Fonts/title.ttf',adobeFile='EPUB/Fonts/aside.ttf';
const encrypted='<encryption><EncryptedData><EncryptionMethod Algorithm="http://www.idpf.org/2008/embedding"/><CipherReference URI="'+fontFile+'"/></EncryptedData></encryption>';
const container='<container><rootfile full-path="EPUB/content.opf"/></container>';
const opf='<package unique-identifier="book-id"><metadata><identifier id="book-id">'+uuid+'</identifier></metadata></package>';
const xnode=attributes=>({getAttribute:key=>attributes[key]??null,textContent:attributes.textContent??null});
class Parser{
 parseFromString(source){
  if(source===encrypted)return{
   querySelector:()=>null,
   getElementsByTagNameNS:(_ns,tag)=>tag==='EncryptedData'?[
    {getElementsByTagNameNS:(_ignored,key)=>key==='EncryptionMethod'?[xnode({Algorithm:'http://www.idpf.org/2008/embedding'})]:[xnode({URI:fontFile})]},
    {getElementsByTagNameNS:(_ignored,key)=>key==='EncryptionMethod'?[xnode({Algorithm:'http://ns.adobe.com/pdf/enc#RC'})]:[xnode({URI:adobeFile})]}

   ]:[]
  };
  if(source===container)return {getElementsByTagNameNS:(_ns,tag)=>tag==='rootfile'?[xnode({'full-path':'EPUB/content.opf'})]:[]};
  if(source===opf)return {documentElement:xnode({'unique-identifier':'book-id'}),getElementsByTagNameNS:(_ns,tag)=>tag==='identifier'?[xnode({id:'book-id',textContent:uuid})]:[]};
  throw new Error('Unexpected XML fixture');
 }
}
const entries={
 'META-INF/encryption.xml':encrypted,'META-INF/container.xml':container,'EPUB/content.opf':opf,
 [fontFile]:'FONT',[adobeFile]:'FONT'
};
const zip={file:key=>Object.hasOwn(entries,key)?{async:async()=>entries[key]}:null};
const sandbox={DOMParser:Parser,TextEncoder,Uint8Array,crypto:webcrypto,epubHrefKey:(_base,href)=>href,console};
vm.createContext(sandbox);
vm.runInContext(app.slice(start,end),sandbox);
const metadata=await sandbox.epubObfuscatedFonts(zip);
assert.equal(metadata.size,2,'Both EPUB font obfuscation schemes are parsed');
const key=createHash('sha1').update(uuid).digest('hex');
assert.equal(metadata.get(fontFile).scheme,'idpf');
assert.equal(metadata.get(fontFile).key,key,'IDPF uses SHA1 of OPF unique identifier');
assert.equal(metadata.get(adobeFile).scheme,'adobe');
assert.equal(metadata.get(adobeFile).key,'9ac9c5ce1b794f419d10acd180154a0e');

const raw=Uint8Array.from({length:1800},(_,i)=>(i*13+39)%256);
raw.set([0,1,0,0],0);
const scramble=(info,count)=>{
 const keyBytes=Uint8Array.from(info.key.match(/.{2}/g),x=>parseInt(x,16));
 const output=raw.slice();
 for(let i=0;i<count;i++)output[i]^=keyBytes[i%keyBytes.length];
 return output;
};
for(const [scheme,path,count] of [['idpf',fontFile,1040],['adobe',adobeFile,1024]]){
 const mangled=scramble(metadata.get(path),count);
 assert.equal(sandbox.epubValidSfnt(mangled),false,scheme+' source is obfuscated');
 const restored=new Uint8Array(sandbox.epubDecodeFont(mangled,metadata.get(path)));
 assert.deepEqual([...restored],[...raw],scheme+' must round-trip the exact original bytes');
 assert.throws(()=>sandbox.epubDecodeFont(mangled,{scheme,key:'00'.repeat(scheme==='idpf'?20:16)}),/identificador|coincide/i,'Wrong identifiers must fail');
}
assert.equal(sandbox.epubValidSfnt(Uint8Array.from([79,84,84,79,...new Array(20).fill(0)])),true);
assert.match(app,/new FontFace\('NLOBI-EPUB-'\+index,src,\{style,weight\}\)/,'Reader must receive decoded bytes as FontFace source');
assert.match(app,/id="repairVolumeFonts"/,'Studio should expose independent EPUB font repair');
assert.match(app,/PATCH.*epub_fonts|epub_fonts:repaired/,'Volume repair updates only font metadata');
console.log('EPUB OCF IDPF/Adobe font obfuscation and Studio repair: OK');
