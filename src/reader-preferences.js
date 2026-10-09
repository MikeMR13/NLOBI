// Per-account reading defaults and per-volume overrides; no new database table needed.
// This data lives within reader_ui_preferences.appearance (existing private JSON column).
export const READER_GLOBAL_DEFAULTS=Object.freeze({
 flow:'chapter',theme:'light',fontSize:18,width:'normal',lineHeight:'comfortable',
 fontFamily:'original',paragraphSpace:'normal',indent:'none',align:'left',
 contrast:'standard',images:'show',swipe:'on'
});
const allowed={
 flow:['chapter','continuous','paged'],theme:['light','sepia','dark'],
 width:['narrow','normal','wide'],lineHeight:['compact','comfortable','relaxed'],
 paragraphSpace:['compact','normal','wide'],indent:['none','first'],
 align:['left','justify'],contrast:['standard','high'],images:['show','hide'],
 swipe:['on','off']
};
export const READER_KEYS=Object.freeze(Object.keys(READER_GLOBAL_DEFAULTS));
export function readerValid(key,value){
 if(key==='fontSize')return Number.isFinite(Number(value))&&Number(value)>=14&&Number(value)<=30?Math.round(Number(value)):null;
 if(key==='fontFamily'){
  const v=String(value||'');
  return ['original','serif','sans','literata','merriweather','lora','garamond','baskerville','palatino','verdana','trebuchet','arial','mono'].includes(v)||/^epub:\d{1,3}$/.test(v)?v:null;
 }
 return allowed[key]?.includes(value)?value:null;
}
export function normalizeReaderSettings(input={},fallback=READER_GLOBAL_DEFAULTS){
 const out={...READER_GLOBAL_DEFAULTS};
 for(const key of READER_KEYS){
  const val=readerValid(key,input?.[key]);
  const defaultValue=readerValid(key,fallback?.[key]);
  out[key]=val??defaultValue??READER_GLOBAL_DEFAULTS[key];
 }
 return out;
}
export function cleanVolumeSettings(values){
 const result={};
 if(!values||typeof values!=='object'||Array.isArray(values))return result;
 for(const [volumeId,props] of Object.entries(values).slice(0,800)){
  if(!/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(volumeId)||!props||typeof props!=='object')continue;
  const v={};
  for(const k of READER_KEYS){const x=readerValid(k,props[k]);if(x!==null)v[k]=x}
  if(Object.keys(v).length)result[volumeId]=v;
 }
 return result;
}
export function readerScopedValues(appearance,volumeId=null){
 const global=normalizeReaderSettings(appearance?.readerDefaults||{},READER_GLOBAL_DEFAULTS);
 const override=volumeId?appearance?.readerVolumes?.[volumeId]:null;
 return {...global,...Object.fromEntries(READER_KEYS.flatMap(key=>{
  const value=readerValid(key,override?.[key]);return value===null?[]:[[key,value]];
 }))};
}
export function setReaderSetting(appearance,scope,volumeId,key,value){
 const checked=readerValid(key,value);
 if(checked===null)return false;
 const existing=appearance.readerDefaults||{};
 if(scope==='global'){
  appearance.readerDefaults=normalizeReaderSettings({...existing,[key]:checked});
  if(key==='flow')appearance.readerFlow=checked; // legacy compatibility.
 }else if(scope==='volume'&&volumeId){
  const volumes=cleanVolumeSettings(appearance.readerVolumes);
  const override={...(volumes[volumeId]||{})};
  if(checked===readerScopedValues(appearance)[key])delete override[key];
  else override[key]=checked;
  if(Object.keys(override).length)volumes[volumeId]=override;
  else delete volumes[volumeId];
  appearance.readerVolumes=volumes;
 }else return false;
 return true;
}
export function resetReaderVolume(appearance,volumeId){
 const volumes=cleanVolumeSettings(appearance.readerVolumes);
 delete volumes[volumeId];
 appearance.readerVolumes=volumes;
}
