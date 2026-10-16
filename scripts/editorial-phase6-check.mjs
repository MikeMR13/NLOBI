import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {composeEditorialCss,EDITORIAL_PHASE6_MODULES} from './compose-editorial-css-phase6.mjs';
import {optimizeCss} from './optimize-css-build.mjs';

const root=process.cwd(),read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const source=read('src/styles.css'),fragments=new Map();
for(const name of EDITORIAL_PHASE6_MODULES){
 const marker='/* NLOBI_PHASE6_MODULE:'+name+' */';
 assert.equal(source.split(marker).length-1,1,'Anclaje único: '+name);
 const fragment=read('src/styles/'+name+'.css');
 assert.ok(fragment.length>3000,'Módulo vacío o truncado: '+name);
 assert.ok(fragment.startsWith('/* OBI EDITORIAL '),'Cabecera reconocida: '+name);
 assert.ok(!/@import\s/i.test(fragment),'Sin dependencias remotas: '+name);
 fragments.set(name,fragment);
}
const composed=composeEditorialCss(source,name=>fragments.get(name));
assert.ok(composed.length>475000,'El CSS recombinado debe conservar su contenido previo');
assert.ok(!composed.includes('NLOBI_PHASE6_MODULE:'),'No quedan anclajes sin expandir');
const order=['OBI EDITORIAL IDENTITY','OBI EDITORIAL COLLECTIONS','OBI EDITORIAL BOOKS','OBI EDITORIAL WORKSPACES','STUDIO + VOLUMES + HOME'];
let last=-1;
for(const title of order){const i=composed.indexOf(title);assert.ok(i>last,'Orden CSS: '+title);last=i}
for(const required of ['.homeEditorial','.novelCard','.volumeCard','.studioVolumeGrid','.mobileNav','.reader'])assert.ok(composed.includes(required),'Estilo previo: '+required);
const polish=read('src/styles/editorial-polish-phase6.css');
assert.ok(polish.includes('prefers-reduced-motion:reduce'));
assert.ok(polish.includes(':focus-visible'));
assert.ok(!/@import\s/i.test(polish),'CSS extra sin imports');
const expected=optimizeCss(composed+'\n'+polish);
const built=read('dist/assets/styles.css');
assert.equal(built,expected,'El bundle final coincide con los módulos en cascada');
const html=read('dist/index.html');
const hash=createHash('sha256').update(built).digest('hex').slice(0,12);
assert.ok(html.includes('/assets/styles.css?v='+hash),'Huella del CSS sincronizada');
assert.equal((html.match(/href="\/assets\/styles\.css\?v=/g)||[]).length,2,'Hoja normal + noscript, sin nuevas solicitudes CSS');
const sw=read('dist/sw.js');
assert.ok(sw.includes('/assets/styles.css?v='+hash),'Service Worker versiona el bundle recompuesto');
const report={modules:fragments.size,sourceBytes:source.length,composedBytes:composed.length,bundleBytes:built.length,assetRequestsAdded:0,hash,checks:18};
console.log('OX-MR editorial phase 6:',JSON.stringify(report));
