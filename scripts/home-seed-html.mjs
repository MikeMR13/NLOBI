// Inyecta la portada pública destacada en el HTML de la compilación.
// Si la consulta falla, Inicio conserva el esqueleto editorial original.
const escapeAttribute=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function seedFeaturedHomeHtml(html,book,supabaseOrigin){
 if(!book||!(/^[A-Za-z0-9_-]+$/).test(String(book.id||'')))return html;
 if(typeof book?.novels?.cover_url!=='string')return html;
 const supabase=new URL(supabaseOrigin),cover=new URL(book.novels.cover_url);
 const prefix='/storage/v1/object/public/nlobi-media/';
 if(cover.origin!==supabase.origin||!cover.pathname.startsWith(prefix))return html;
 const relative='/media/'+cover.pathname.slice(prefix.length)+cover.search;
 if(!relative.startsWith('/media/')||relative.includes('..')||/[<>"'\\]/.test(relative))return html;
 const href='#detail:'+encodeURIComponent(book.id);
 const label=String(book.novels?.title||'Novela destacada').slice(0,240);
 const anchor='<span class="homeLoadingCover" aria-hidden="true"></span>';
 const image='<a class="homeFeaturedBook homeFeaturedCoverLink" href="'+escapeAttribute(href)+
  '" aria-label="Abrir novela destacada: '+escapeAttribute(label)+'"><img src="'+escapeAttribute(relative)+
  '" alt="Portada de '+escapeAttribute(label)+'" width="320" height="480" loading="eager" fetchpriority="high" decoding="async" data-early-featured-cover></a>';
 const hint='<script src="/assets/home-cover-hint.js';
 const at=html.indexOf(hint),placeholder=html.indexOf(anchor);
 if(at<0||placeholder<at||html.includes('name="nlobi-build-cover"'))return html;
 // Metadatos visibles antes del JS, sin exponer información privada ni claves.
 html=html.slice(0,at)+'<meta name="nlobi-build-cover" content="'+escapeAttribute(relative)+'">\n'+html.slice(at);
 return html.replace(anchor,image);
}
