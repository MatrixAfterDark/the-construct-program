const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(process.env.RECEIPT_SOURCE||'site-overrides/completion-receipt.js','utf8');
function setup({hidden=false,store=new Map(),response=true,storageFails=false}={}){
 const listeners=new Set(),requests=[],delayed=[];
 const document={hidden,addEventListener:(type,fn)=>listeners.add(fn),removeEventListener:(type,fn)=>listeners.delete(fn)};
 const window={localStorage:{getItem(key){if(storageFails)throw Error('blocked');return store.get(key);},setItem(key,value){if(storageFails)throw Error('blocked');store.set(key,value);}},ProgramLifecycle:{setTimeout(fn,ms){delayed.push({fn,ms});return delayed.length;},clearTimeout(){}}};
 const sandbox={window,document,fetch:async(url,options)=>{requests.push({url,options});return{ok:true,json:async()=>({success:response})};},Date,Set,Promise,encodeURIComponent};vm.createContext(sandbox);vm.runInContext(source,sandbox);
 return{api:window.CompletionReceipt,document,requests,delayed,store,show(){document.hidden=false;for(const fn of [...listeners])fn();}};
}
const panel={closest:()=>null};const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
(async()=>{
 const a=setup();assert.equal(a.requests.length,0,'Opening invite or loading script must not send');
 a.api.reached({panel,name:'Lexi'});assert.equal(a.requests.length,1,'Final page entry triggers immediately without scrolling');await flush();
 const req=a.requests[0],body=JSON.parse(req.options.body);assert.equal(req.url,'https://formsubmit.co/ajax/steven.cuzzillo@gmail.com');assert.equal(body.name,'LEXI');assert.equal(body.activity,'DETAILS VIEWED');assert.equal(body._subject,'Matrix Construct — details viewed — LEXI');assert(!JSON.stringify(body).includes('ATTENDING'));assert(req.options.keepalive);assert.deepEqual(Object.keys(body).sort(),['_captcha','_subject','_template','activity','event','name','viewed_at'].sort());
 a.api.reached({panel,name:'Lexi'});await flush();assert.equal(a.requests.length,1,'Replay does not duplicate successful receipt');
 const reload=setup({store:a.store});reload.api.reached({panel,name:'Lexi'});assert.equal(reload.requests.length,0,'Reload in same browser does not duplicate receipt');reload.api.reached({panel,name:'Sarah Connor'});await flush();assert.equal(JSON.parse(reload.requests[0].options.body).name,'SARAH CONNOR');
 const hidden=setup({hidden:true});hidden.api.reached({panel,name:'Lexi'});assert.equal(hidden.requests.length,0,'Background final transition does not count until visible');hidden.show();await flush();assert.equal(hidden.requests.length,1);
 const cancelled=setup({hidden:true});const stop=cancelled.api.reached({panel,name:'Lexi'});stop();cancelled.show();assert.equal(cancelled.requests.length,0,'Leaving/replaying cancels a queued unseen final page');
 const missing=setup();missing.api.reached({panel:null,name:'Lexi'});assert.equal(missing.requests.length,0);
 const fallback=setup({storageFails:true});fallback.api.reached({panel,name:'\n'});await flush();assert.equal(JSON.parse(fallback.requests[0].options.body).name,'OPERATIVE');fallback.api.reached({panel,name:'OPERATIVE'});assert.equal(fallback.requests.length,1,'In-memory dedup survives blocked local storage');
 const fail=setup({response:false});fail.api.reached({panel,name:'Test'});await flush();assert.equal(fail.delayed.length,1);assert.equal(fail.delayed[0].ms,5000);assert.equal(fail.store.size,0);fail.delayed[0].fn();await flush();assert.equal(fail.requests.length,2);assert.equal(fail.delayed.length,1,'Retry is bounded and does not interfere with the experience');
 const beforeAck=setup();beforeAck.api.reached({panel,name:'Lexi'});beforeAck.api.reached({panel,name:'Lexi'});assert.equal(beforeAck.requests.length,1,'Concurrent final events do not duplicate an in-flight send');
 console.log('PASS last-page trigger without scrolling, no send on opening, exact destination/name/event fields, no RSVP, hidden-page gate, cancellation, deduplication, fallback and bounded silent retry');
})();
