import { chromium } from 'playwright';

// Independent contrast regression for all personalized site palettes.
// This test is intentionally limited to appearance: the navigation redesign belongs to phase 2.
const base = 'http://127.0.0.1:4173/';
const paletteNames = ['amber', 'indigo', 'forest', 'wine', 'ocean', 'graphite'];
const cases = [
  { width: 320, scale: 135 },
  { width: 390, scale: 100 },
  { width: 390, scale: 135 },
  { width: 768, scale: 135 },
];
const problems = [];
const browser = await chromium.launch({ headless: true });

function luminance(rgb) {
  const channels = rgb.map(channel => {
    const s = channel / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function parseColor(value) {
  const match = String(value).match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  if (!match) throw Error('Unsupported computed color: ' + value);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}
function ratio(foreground, background) {
  const a = luminance(parseColor(foreground)), b = luminance(parseColor(background));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

let checked = 0;
for (const palette of paletteNames) {
  for (const mode of ['light', 'dark']) {
    for (const viewport of cases) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: 844 },
        serviceWorkers: 'block',
      });
      await context.addInitScript(prefs => {
        localStorage.setItem('nlobi_site_appearance', JSON.stringify(prefs));
      }, { theme: palette, mode, scale: viewport.scale });
      await context.route('**/runtime-config.js', route => route.fulfill({
        status: 200, contentType: 'application/javascript',
        body: "window.__NLOBI_CONFIG__={supabaseUrl:'https://qa.supabase.local',supabasePublishableKey:'qa',qaMode:true};",
      }));
      await context.route('https://qa.supabase.local/**', route => route.fulfill({
        status: 200, contentType: 'application/json', body: '[]',
      }));
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      try {
        await page.goto(base + '#home', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => !!window.__NLOBI_QA__, null, { timeout: 10000 });
        await page.evaluate(() => window.__NLOBI_QA__.setState({
          user: { id: 'qa-theme-user', email: 'visual-qa@example.test' },
          profile: { id: 'qa-theme-user', display_name: 'QA' },
          notes: [],
        }));
        if (viewport.width <= 1100) await page.locator('.mobileNav > summary').click();
        const state = await page.evaluate(() => {
          const selectors = innerWidth <= 1100
            ? {
                'Menú móvil': '.mobileNav > summary',
                'Sección activa': '#nlobiMobileMenu .navLink.active',
                'Cerrar menú': '.mobileNavClose',
                'Instalación PWA': '#installPwaMobile',
                'Tema rápido': '#themeMobileQuick',
              }
            : {
                'Sección activa de escritorio': '.top .nav .navLink.active',
              };
          const controls = Object.entries(selectors).map(([label, selector]) => {
            const el = document.querySelector(selector);
            if (!el) return { label, missing: true };
            const s = getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            return { label, foreground: s.color, background: s.backgroundColor, width: rect.width, height: rect.height };
          });
          const prefs = JSON.parse(localStorage.getItem('nlobi_site_appearance') || '{}');
          return {
            controls, mode: document.body.classList.contains('dark') ? 'dark' : 'light',
            theme: document.documentElement.dataset.siteTheme,
            savedMode: prefs.mode, savedTheme: prefs.theme,
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          };
        });
        for (const ctrl of state.controls) {
          if (ctrl.missing) {
            problems.push({ palette, mode, viewport, control: ctrl.label, error: 'missing control' });
            continue;
          }
          if (ctrl.width === 0 || ctrl.height === 0) {
            problems.push({ palette, mode, viewport, control: ctrl.label, error: 'hidden control' });
            continue;
          }
          const contrast = ratio(ctrl.foreground, ctrl.background);
          checked++;
          if (contrast < 4.5) {
            problems.push({ palette, mode, viewport, control: ctrl.label, contrast: Math.round(contrast * 100) / 100, error: 'contrast < 4.5:1' });
          }
        }
        if (state.theme !== palette || state.savedTheme !== palette || state.mode !== mode || state.savedMode !== mode) {
          problems.push({ palette, mode, viewport, error: 'appearance preference changed unexpectedly', state });
        }
        if (state.overflow > 2) problems.push({ palette, mode, viewport, error: 'horizontal overflow', pixels: state.overflow });
        if (errors.length) problems.push({ palette, mode, viewport, error: 'browser errors', errors });

        // A quick theme toggle must preserve the user's chosen color palette.
        if (viewport.width === 390 && viewport.scale === 100) {
          await page.locator('.mobileNavClose').click();
          await page.locator('#themeMobileQuick').click();
          const updated = await page.evaluate(() => ({
            theme: JSON.parse(localStorage.getItem('nlobi_site_appearance') || '{}').theme,
            mode: document.body.classList.contains('dark') ? 'dark' : 'light',
          }));
          if (updated.theme !== palette || updated.mode === mode) problems.push({ palette, mode, error: 'theme toggle did not preserve palette or switch mode', updated });
        }
      } catch (error) {
        problems.push({ palette, mode, viewport, error: String(error) });
      } finally {
        await context.close();
      }
    }
  }
}
await browser.close();
console.log('Appearance contrast audit:', JSON.stringify({ palettes: paletteNames.length, combinations: paletteNames.length * 2 * cases.length, controlsChecked: checked, failures: problems.length }));
if (problems.length) {
  console.error(JSON.stringify(problems, null, 2));
  process.exit(1);
}
