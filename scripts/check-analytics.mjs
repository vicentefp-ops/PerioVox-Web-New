import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';
const source=ts.transpileModule(await readFile('src/analytics.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const consent={status:'set',analytics:true,updatedAt:new Date().toISOString()};
function run({hostname='periovox.ai',saved=JSON.stringify(consent),disabled=false,href='https://app.periovox.ai/',conversion='start_free'}={}){
 const calls=[];const context={exports:{},URL,Date,window:{'ga-disable-G-3EV0RZHYDN':disabled,gtag:(...args)=>calls.push(args)},location:{hostname,href:'https://'+hostname+'/es/',pathname:'/es/'},localStorage:{getItem:()=>saved},document:{documentElement:{lang:'es'}}};
 vm.runInNewContext(source,context);context.exports.trackConversion({href,dataset:{conversion},closest:selector=>selector==='section'?{id:'hero'}:null});return calls;
}
assert.equal(run({saved:null}).length,0,'No analytics without consent');
assert.equal(run({saved:'broken-json'}).length,0,'No analytics with malformed consent');
assert.equal(run({saved:JSON.stringify({...consent,analytics:false})}).length,0,'No analytics after rejection or revocation');
assert.equal(run({saved:JSON.stringify({...consent,updatedAt:'2020-01-01'})}).length,0,'No analytics with expired consent');
assert.equal(run({disabled:true}).length,0,'Respect GA disabled flag');
assert.equal(run({hostname:'127.0.0.1'}).length,0,'No localhost analytics');
assert.equal(run()[0][1],'start_free_click');
assert.equal(run({conversion:undefined})[0][1],'start_free_click');
assert.equal(run({conversion:'login'})[0][1],'app_open','Opening app is not a registration');
assert.equal(run({href:'https://wa.me/34690957910'})[0][1],'whatsapp_contact');
assert.equal(run({href:'mailto:info@periovox.ai'})[0][1],'email_contact');
assert(!Object.keys(run()[0][2]).includes('link_url'),'Do not record contact URL contents');
console.log('Analytics checks passed: consent, expiry, revocation, localhost exclusion and truthful click events.');
