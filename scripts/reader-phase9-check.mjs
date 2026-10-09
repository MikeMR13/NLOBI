// Phase 9 preference isolation and pagination without browser I/O.
import assert from 'node:assert/strict';
import {READER_GLOBAL_DEFAULTS,normalizeReaderSettings,cleanVolumeSettings,readerScopedValues,setReaderSetting,resetReaderVolume} from '../src/reader-preferences.js';
import {createReaderPagination} from '../src/reader-pagination.js';
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
const appearance={readerDefaults:normalizeReaderSettings({flow:'continuous',theme:'sepia',fontSize:20}),readerVolumes:{}};
assert.equal(readerScopedValues(appearance,a).flow,'continuous');
assert.equal(readerScopedValues(appearance,b).theme,'sepia');
assert.equal(setReaderSetting(appearance,'volume',a,'flow','paged'),true);
assert.equal(setReaderSetting(appearance,'volume',a,'theme','dark'),true);
assert.equal(readerScopedValues(appearance,a).flow,'paged');
assert.equal(readerScopedValues(appearance,a).theme,'dark');
assert.equal(readerScopedValues(appearance,b).flow,'continuous','other volume must be isolated');
assert.equal(setReaderSetting(appearance,'global',null,'flow','chapter'),true);
assert.equal(readerScopedValues(appearance,a).flow,'paged','individual override wins');
assert.equal(readerScopedValues(appearance,b).flow,'chapter','global changes propagate to unmodified volume');
assert.equal(appearance.readerFlow,'chapter','legacy global mode remains compatible');
assert.equal(setReaderSetting(appearance,'volume',a,'flow','invalid'),false,'reject invalid modes');
assert.equal(setReaderSetting(appearance,'volume',a,'fontSize',1000),false,'reject oversized font');
assert.equal(Object.keys(cleanVolumeSettings({'invalid':{theme:'dark'},[a]:{theme:'dark'}})).length,1);
resetReaderVolume(appearance,a);
assert.equal(readerScopedValues(appearance,a).flow,'chapter','reset inherits global again');
assert.equal(readerScopedValues(appearance,a).theme,'sepia');
assert.equal(readerScopedValues({readerDefaults:{fontSize:-300}},null).fontSize,18);
assert.equal(READER_GLOBAL_DEFAULTS.swipe,'on');

let y=0,save=0;
const scroll={style:{setProperty(){}},scrollLeft:0,scrollWidth:1900,clientWidth:600,
 getBoundingClientRect:()=>({left:0,right:600}),querySelectorAll:()=>[],querySelector:()=>null,
 addEventListener(){},scrollTo({left}){this.scrollLeft=left;save++}};
const controls=new Map([
 ['readerPageCount',{textContent:''}],['readerPagePrev',{disabled:false,addEventListener(){}}],
 ['readerPageNext',{textContent:'',disabled:false,addEventListener(){}}],
 ['readerPageStatus',{textContent:''}]
]);
const root={dataset:{},querySelector:x=>x==='#readerChapterStream .readerPaper'?scroll:x==='.readerShell'?{}:controls.get(x.slice(1))||null,isConnected:true};
globalThis.document={querySelector:x=>x==='.readerExperience'?root:null,addEventListener(){},querySelectorAll:()=>[],getSelection:()=>({isCollapsed:true})};
globalThis.getComputedStyle=()=>({paddingLeft:'0',paddingRight:'0',columnGap:'36px'});
globalThis.matchMedia=()=>({matches:true});
globalThis.requestAnimationFrame=fn=>{fn();return 1};
const chapter={id:'chapter-1',navigation:[{id:'chapter-1'},{id:'chapter-2'}],translation_id:'project-1'};
const state={view:'reader:chapter-1',readerPrefs:{flow:'paged',swipe:'on'}};
const pages=createReaderPagination({state:()=>state,flow:{active:()=>chapter},onNext:()=>{y++},updateProgress:()=>{}});
pages.bind();
assert.ok(root.dataset.readerPageCount>='2','must detect multiple paginated columns');
pages.move(1);
assert.ok(save>=1,'next control moves horizontally');
const pos=pages.position();assert.ok(pos?.percent>=0);
assert.equal(pages.restore({percent:100}),true);
pages.move(1);
assert.equal(y,1,'the last page navigates to next chapter');
pages.unbind();
console.log('Reader Phase 9 regressions OK');
