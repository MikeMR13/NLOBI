import fs from 'node:fs';import assert from 'node:assert/strict';
const app=fs.readFileSync('src/app.js','utf8'),css=fs.readFileSync('src/styles.css','utf8');
for(const name of ['teamPhaseAControls','teamTemplateKey','teamPaletteKey','applyTeamProfilePalette','teamCustomPreview'])assert.ok(app.includes('function '+name+'('),name+' no existe');
for(const key of ['revista','clasica','editorial'])assert.ok(css.includes('teamTemplate-'+key),'Falta plantilla '+key);
for(const key of ['tinta','sakura','biblioteca','washi','neon','noche'])assert.ok(app.includes('"'+key+'":['),'Falta paleta '+key);
for(const marker of ['teamPhaseAControls(G)','teamTemplate-${teamTemplateKey(customization)}','teamPalette-${teamPaletteKey(customization)}','profile_settings.team_template','profile_settings.team_palette',"applyTeamProfilePalette);teamCustomPreview();"])assert.ok(app.includes(marker),'Falta conexión '+marker);
assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'));
console.log('Fase A perfil equipo: comprobaciones estáticas OK');
