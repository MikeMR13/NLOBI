import fs from 'node:fs';
import assert from 'node:assert/strict';
import {sanitizeTeamAppearance,exportTeamAppearance,importTeamAppearance} from '../src/team-appearance-phase-b.js';

const app=fs.readFileSync('src/app.js','utf8');
const css=fs.readFileSync('src/styles.css','utf8');
const match=app.match(/const TEAM_PROFILE_PALETTES=(\{[^\n]+\});/);
assert.ok(match,'Falta catálogo de paletas editoriales');
const palettes=JSON.parse(match[1]);
const fresh=['aizome','momiji','matsuri','zen','academia','yuki','cyberpunk','manuscrito'];
const legacy=['tinta','sakura','biblioteca','washi','neon','noche'];
assert.deepEqual(Object.keys(palettes),[...legacy,...fresh]);
assert.equal(Object.keys(palettes).length+1,15,'Se esperaban 15 temas contando Obi Original');

const luminance=hex=>{
 const channels=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255)
  .map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);
 return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;
};
const ratio=(a,b)=>{const light=Math.max(luminance(a),luminance(b)),dark=Math.min(luminance(a),luminance(b));return (light+.05)/(dark+.05)};
for(const [key,row] of Object.entries(palettes)){
 assert.equal(row.length,10,'Metadatos incompletos '+key);
 assert.match(row[1],/^#[0-9a-f]{6}$/i);
 assert.match(row[2],/^#[0-9a-f]{6}$/i);
 assert.ok(['claro','oscuro'].includes(row[3]),'Modo de tema inválido '+key);
 const appearance={team_palette:key,accent_color:row[1],background_color:row[2],
  theme:row[3],header_style:row[4],avatar_shape:row[5],
  team_pattern:row[6],team_font:row[7],team_cover_style:row[8]};
 assert.deepEqual(sanitizeTeamAppearance(appearance),appearance,'Configuración rechazada '+key);
 assert.deepEqual(importTeamAppearance(exportTeamAppearance(appearance,row[0])).appearance,appearance,'Exportación no estable '+key);
 if(fresh.includes(key))assert.ok(ratio(row[1],row[2])>=4.5,'Contraste insuficiente '+key+': '+ratio(row[1],row[2]).toFixed(2));
}
for(const item of [
 'function teamThemeCards(current){',
 'function teamSyncPaletteCards(){',
 'class="teamThemeGrid"',
 'data-team-palette-choice',
 'aria-pressed',
 "select.dispatchEvent(new Event('change',{bubbles:true}))",
 'function applyTeamProfilePalette(){',
 'teamSyncPaletteCards();',
 'teamCustomFullPreview(target,virtual,p)'
])assert.ok(app.includes(item),'No existe integración: '+item);
for(const rule of ['.teamThemeCard:focus-visible','.teamThemeCard[aria-pressed="true"]','@media(max-width:560px)','@media(prefers-reduced-motion:reduce)','@media(forced-colors:active)']){
 assert.ok(css.includes(rule),'Falta CSS de accesibilidad: '+rule);
}
for(const key of fresh)assert.ok(css.includes('teamPalette-'+key),'Falta variante visual '+key);
assert.ok(!app.includes('https://fonts.googleapis.com'),'Las fuentes no deben introducir descargas de pago o externas');
assert.throws(()=>sanitizeTeamAppearance({team_palette:'javascript:alert(1)'}));
console.log('Biblioteca de 15 temas: paletas, contraste, CSS, vista previa y JSON compatibles');
