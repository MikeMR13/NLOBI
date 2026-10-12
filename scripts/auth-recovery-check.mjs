import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
new Function(app);
const extract=(start,end)=>{const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,'Missing region: '+start);return app.slice(a,b)};
for(const value of ['id="forgotPassword"','id="recoverPasswordForm"','id="resetPasswordForm"','id="recoverEmail"','id="recoveryNewPassword"','id="recoveryConfirmPassword"','type=\'recovery\'','authSessionInvalid','let authValidated=false'])assert.ok(app.includes(value),'Missing recovery/session feature '+value);
const callbackSrc=extract('function consumeAuthCallback(){','\nasync function refreshSession()');
const captured=[];const storage={setItem:(k,v)=>captured.push([k,v])};
let route='';const location={hash:'#access_token=test&refresh_token=refresh&type=recovery',pathname:'/',search:''};
const callback=new Function('S','location','history','sessionStorage','persistSession',callbackSrc+';return consumeAuthCallback;');
const state={authMode:'login'};const cb=callback(state,location,{replaceState:(_a,_b,target)=>{route=target}},storage,d=>captured.push(['session',d]));
assert.equal(cb(),true);assert.equal(state.authMode,'reset');assert.equal(route,'/#auth');assert.equal(captured.find(([k])=>k==='session')[1].access_token,'test');
const recoverySource=extract('async function requestPasswordRecovery(event){','\nasync function resetRecoveredPassword(');
const recoveryCalls=[],toasts=[],errors=[];
const recover=new Function('$','jreq','authRedirectUrl','setAuthError','toast','friendlyError',recoverySource+';return requestPasswordRecovery;')(
 id=>id==='#recoverEmail'?{value:'reader@example.test'}:id==='#sendRecoveryLink'?{disabled:false,isConnected:true}:null,
 async(path,options)=>{recoveryCalls.push([path,options])},()=> 'https://nlobi.vercel.app/',m=>errors.push(m),(m,t)=>toasts.push([m,t]),e=>String(e));
await recover({preventDefault(){}});
assert.equal(recoveryCalls.length,1);assert.ok(recoveryCalls[0][0].startsWith('/auth/v1/recover?redirect_to='));
assert.deepEqual(JSON.parse(recoveryCalls[0][1].body),{email:'reader@example.test'});
const resetSource=extract('async function resetRecoveredPassword(event){','\nasync function signup(');
const resetCalls=[],goCalls=[],resetS={token:'test',authMode:'reset'};
const reset=new Function('S','$','setAuthError','jreq','loadUser','go','toast','friendlyError',resetSource+';return resetRecoveredPassword;')(
 resetS,id=>id==='#recoveryNewPassword'?{value:'StrongExamplePwd99!'}:id==='#recoveryConfirmPassword'?{value:'StrongExamplePwd99!'}:id==='#confirmRecoveryPassword'?{disabled:false,isConnected:true}:null,
 m=>errors.push(m),async(path,opts)=>resetCalls.push([path,opts]),async()=>{},(route,replace)=>goCalls.push([route,replace]),(m,t)=>toasts.push([m,t]),e=>String(e));
await reset({preventDefault(){}});
assert.equal(resetCalls.length,1);assert.equal(resetCalls[0][0],'/auth/v1/user');
assert.equal(JSON.parse(resetCalls[0][1].body).password,'StrongExamplePwd99!');
assert.equal(resetS.authMode,'login');assert.deepEqual(goCalls,[['auth',true]]);
assert.ok(app.includes("if(e?.authSessionInvalid||!S.token)"),'Transient profile errors must not clear credentials');
console.log('Auth recovery OK: password reset request, recovery callback, password update and session preservation.');
