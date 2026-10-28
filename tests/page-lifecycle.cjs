const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(process.env.LIFECYCLE_SOURCE || 'site-overrides/page-lifecycle.js','utf8');
function setup(hidden=false){
 let wall=0,serial=0;const queue=new Map(),media=[],animations=[],listeners=new Map(),windowListeners=new Map(),buttons=[];
 const on=(map,type,fn)=>{if(!map.has(type))map.set(type,[]);map.get(type).push(fn);};
 const emit=(map,type,event={})=>{for(const fn of map.get(type)||[])fn(event);};
 const nativeTimeout=(fn,ms)=>{queue.set(++serial,{fn,due:wall+ms});return serial;};
 const advance=ms=>{const target=wall+ms;let guard=0;while(true){const items=[...queue].filter(([,v])=>v.due<=target).sort((a,b)=>a[1].due-b[1].due);if(!items.length)break;if(++guard>10000)throw Error('Timer loop');const[id,t]=items[0];queue.delete(id);wall=t.due;t.fn();}wall=target;};
 class Media{constructor(){this.paused=true;this.ended=false;this.src=this.currentSrc='film.mp4';this.muted=false;this.volume=.48;this.currentTime=3;this.plays=0;this.pauses=0;media.push(this);}play(){this.plays++;if(this.blocked)return Promise.reject(Object.assign(Error('Gesture required'),{name:'NotAllowedError'}));this.paused=false;emit(listeners,'play',{target:this});return Promise.resolve();}pause(){this.paused=true;this.pauses++;}}
 class Audio{constructor(){this.state='running';this.resumes=0;this.suspends=0;}resume(){this.resumes++;this.state='running';return Promise.resolve();}suspend(){this.suspends++;this.state='suspended';return Promise.resolve();}}
 const document={hidden,documentElement:{},body:{append:b=>buttons.push(b)},addEventListener:(t,fn)=>on(listeners,t,fn),querySelectorAll:()=>media,getAnimations:()=>animations,createElement:()=>({style:{},setAttribute(){},addEventListener(t,fn){this[t]=fn;},remove(){buttons.splice(buttons.indexOf(this),1);}})};
 const window={setTimeout:nativeTimeout,clearTimeout:id=>queue.delete(id),requestAnimationFrame:fn=>nativeTimeout(()=>fn(wall),16),cancelAnimationFrame:id=>queue.delete(id),addEventListener:(t,fn)=>on(windowListeners,t,fn),HTMLMediaElement:Media,AudioContext:Audio};
 const context={window,document,performance:{now:()=>wall},MutationObserver:class{observe(){}},DOMException};vm.createContext(context);vm.runInContext(source,context);
 const hide=()=>{document.hidden=true;emit(listeners,'visibilitychange');},show=()=>{document.hidden=false;emit(listeners,'visibilitychange');};
 return{window,document,api:window.ProgramLifecycle,Media,Audio,media,animations,buttons,advance,hide,show,emitWindow:t=>emit(windowListeners,t)};
}
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
(async()=>{
 const t=setup();let fired=0,args;
 t.api.setTimeout((...a)=>{fired++;args=a;},100,'same','arguments');t.advance(40);t.hide();const stopped=t.api.now();t.advance(50000);assert.equal(fired,0);assert.equal(t.api.now(),stopped);t.show();t.advance(59);assert.equal(fired,0);t.advance(1);assert.equal(fired,1);assert.deepEqual(args,['same','arguments']);
 let frameTime;t.api.requestAnimationFrame(n=>frameTime=n);t.advance(5);t.hide();t.advance(8000);t.show();t.advance(16);assert(frameTime-t.api.now()<=0);assert(t.api.now()<200,'Canvas clock excludes background time');
 let cancelled=0;const a=t.api.setTimeout(()=>cancelled++,10),b=t.api.requestAnimationFrame(()=>cancelled++);t.hide();t.api.clearTimeout(a);t.api.cancelAnimationFrame(b);t.show();t.advance(30);assert.equal(cancelled,0);
 let interval=0;const intervalId=t.api.setInterval(()=>interval++,100);t.advance(40);t.hide();t.advance(10000);t.show();t.advance(59);assert.equal(interval,0);t.advance(1);assert.equal(interval,1);t.api.clearInterval(intervalId);t.advance(1000);assert.equal(interval,1);
 const playing=new t.Media(),manual=new t.Media();await playing.play();playing.muted=true;t.hide();assert(playing.paused);assert.equal(manual.plays,0);t.show();await flush();assert(!playing.paused);assert.equal(playing.currentTime,3);assert.equal(playing.volume,.48);assert(playing.muted);assert.equal(manual.plays,0,'User-paused media stays paused');
 t.hide();playing.pause();t.show();await flush();assert(playing.paused,'Explicit pause while away cancels automatic resume');
 const queued=new t.Media();t.hide();let resolved=false;const pending=queued.play().then(()=>resolved=true);await flush();assert.equal(queued.plays,0);assert(!resolved);t.show();await pending;assert(!queued.paused);assert(resolved);
 const cancel=new t.Media();t.hide();const rejected=cancel.play().catch(e=>e.name);cancel.pause();assert.equal(await rejected,'AbortError');t.show();await flush();assert(cancel.paused);
 const audio=new t.window.AudioContext();t.hide();assert.equal(audio.state,'suspended');await audio.resume();assert.equal(audio.state,'suspended','Hidden resume cannot restart background audio');t.show();await flush();assert.equal(audio.state,'running');
 t.hide();await audio.suspend();t.show();await flush();assert.equal(audio.state,'suspended','Explicit context suspension is retained');
 audio.state='interrupted';t.hide();t.show();await flush();assert.equal(audio.state,'running','OS-interrupted WebAudio resumes on return');
 const css={playState:'running',pause(){this.playState='paused';},play(){this.playState='running';}};const userPaused={...css,playState:'paused'};t.animations.push(css,userPaused);t.hide();assert.equal(css.playState,'paused');t.show();assert.equal(css.playState,'running');assert.equal(userPaused.playState,'paused');
 const bf=setup();let done=false;bf.api.setTimeout(()=>done=true,100);bf.advance(20);bf.emitWindow('pagehide');bf.advance(50000);assert(!done);bf.emitWindow('pageshow');bf.advance(79);assert(!done);bf.advance(1);assert(done,'Back/forward cache resumes remaining sequence');
 const initiallyHidden=setup(true);const fresh=new initiallyHidden.window.AudioContext();assert.equal(fresh.state,'suspended');let start=false;initiallyHidden.api.setTimeout(()=>start=true,10);initiallyHidden.advance(10000);assert(!start);initiallyHidden.show();initiallyHidden.advance(10);assert(start);await flush();assert.equal(fresh.state,'running');
 const retry=setup(),blocked=new retry.Media();await blocked.play();retry.hide();blocked.blocked=true;retry.show();await flush();assert.equal(retry.buttons.length,1,'Browser autoplay block offers one resume button');blocked.blocked=false;retry.buttons[0].click();await flush();assert(!blocked.paused);assert.equal(retry.buttons.length,0);
 console.log('PASS hidden timers/intervals/RAF, animation clock, cancellation, media pause/resume, preserved mute/volume, paused-media intent, hidden play, WebAudio, CSS animation, BFCache, initially hidden page and autoplay recovery');
})();
