/* Construct sign-off: selected character, one scan, symbol reveal and event details. */
(()=>{'use strict';const {setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame,cancelAnimationFrame}=window.ProgramLifecycle;const performance={now:window.ProgramLifecycle.now};const $=s=>document.querySelector(s),glyphs='ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿ0123456789';let run=0,clock=0,observer=null,visibilityStop=null,detailStop=null,receiptStop=null;
const EVENT={at:'2026-11-07T19:00:00+11:00'};
function countdown(now=Date.now()){let n=Math.max(0,Math.floor((Date.parse(EVENT.at)-now)/1000));return [Math.floor(n/86400),Math.floor(n%86400/3600),Math.floor(n%3600/60),n%60];}
function titleFontSize(width,measuredWidth){return Math.max(1,Math.min(180,width*.96/(measuredWidth/100+.84)));}
function updateCountdown(){for(const [i,value] of countdown().entries()){const el=$('#final-'+['days','hours','minutes','seconds'][i]);if(el)el.textContent=String(value).padStart(i?2:3,'0');}}
function syncSound(){const b=$('#final-sound');if(b){b.textContent=window.ZionAudio?.muted?'SOUND OFF':'SOUND ON';b.setAttribute?.('aria-pressed',String(!window.ZionAudio?.muted));}}
function reset({preservePhone=false,preserveRain=false}={}){receiptStop?.();receiptStop=null;run++;clearInterval(clock);clock=0;observer?.disconnect();observer=null;visibilityStop?.();visibilityStop=null;detailStop?.();detailStop=null;const detailCue=$('#final-details-cue');if(detailCue){detailCue.hidden=true;detailCue.onclick=null;}const cue=$('#final-scroll-cue');if(cue){cue.hidden=true;cue.onclick=null;}if(!preserveRain)window.ProgramSurge?.stop?.();window.FinalCharacterCode?.stop?.();if(!preservePhone)window.InviteSignal?.stop?.();const details=$('#final-invitation');if(details)details.hidden=true;}
function waitForWelcome(panel,target,alive){
 if(!target?.getBoundingClientRect||!panel.getBoundingClientRect)return Promise.resolve(alive());
 return new Promise(resolve=>{
  let watching=null,finished=false;
  const finish=value=>{if(finished)return;finished=true;watching?.disconnect();panel.removeEventListener?.('scroll',check);window.removeEventListener?.('resize',check);document.removeEventListener?.('visibilitychange',check);if(visibilityStop===cancel)visibilityStop=null;resolve(value);};
  const cancel=()=>finish(false);
  const check=()=>{if(!alive()){finish(false);return;}if(document.hidden)return;const r=target.getBoundingClientRect(),p=panel.getBoundingClientRect(),viewport=window.innerHeight||p.bottom;const top=Math.max(p.top,0),bottom=Math.min(p.bottom,viewport),visible=Math.min(r.bottom,bottom)-Math.max(r.top,top),needed=Math.min(r.height,bottom-top)*.65;if(needed>0&&visible>=needed)finish(true);};
  visibilityStop=cancel;panel.addEventListener?.('scroll',check,{passive:true});window.addEventListener?.('resize',check);document.addEventListener?.('visibilitychange',check);
  if(typeof IntersectionObserver!=='undefined'){watching=new IntersectionObserver(check,{root:panel,threshold:[0,.25,.5,.65,1]});watching.observe(target);}
  check();
 });
}
async function show({panel,profile,valid,wait,quiet,preservePhone=false,gatherCharacter=false}){reset({preservePhone,preserveRain:gatherCharacter});const own=run,alive=()=>own===run&&valid(),details=$('#final-invitation');if(!details)return;const sound=$('#final-sound');if(sound)sound.onclick=()=>{$('#sound-toggle')?.click();syncSound();};syncSound();panel.scrollTop=0;panel.dataset.signal='steady';panel.dataset.titleState='waiting';panel.dataset.resolved='false';panel.dataset.finale=gatherCharacter?'gather':'scan';$('#training-ready-title').textContent='CONSTRUCT PROGRAM COMPLETE';$('#final-profile-label').textContent=[profile?.role||'OPERATIVE',profile?.hair==='bald'?'SHAVED':profile?.hair].filter(Boolean).join(' // ').toUpperCase();$('#final-profile-review').onclick=()=>window.ResidualExperience?.review?.();
const guest=String(profile?.subject||new URLSearchParams(location.search).get('name')||'OPERATIVE').trim().slice(0,32).toUpperCase()||'OPERATIVE';const guestLabel=$('#final-guest-name');if(guestLabel){guestLabel.textContent='';guestLabel.setAttribute?.('aria-label',guest);}
const measure=document.createElement?.('canvas')?.getContext?.('2d');
const size=()=>{if(panel.clientHeight)panel.style?.setProperty('--final-height',panel.clientHeight+'px');const title=$('.final-matrix-title'),width=title?.getBoundingClientRect?.().width;if(width&&measure?.measureText){measure.font='100px Georgia,serif';const metrics=measure.measureText('MATRIX');if(metrics.width>0)panel.style?.setProperty('--matrix-title-size',titleFontSize(width,metrics.width)+'px');}};size();if(typeof ResizeObserver!=='undefined'){observer=new ResizeObserver(size);observer.observe(panel);}
const rain=$('#final-code-rain');if(rain&&!(gatherCharacter&&window.ProgramSurge?.carry?.(rain,{ambient:true})))window.ProgramSurge?.start?.(rain,{ambient:true,quiet});
async function reveal(selector,text,duration){const el=$(selector);if(!el)return true;if(quiet){el.textContent=text;return alive();}const steps=Math.ceil(duration/42);for(let frame=0;frame<=steps;frame++){if(!alive())return false;const p=frame/steps;let out='';for(let i=0;i<text.length;i++){const c=text[i],settle=Math.min(1,Math.max(0,p*1.35-i/text.length*.35));out+=c===' '?' ':settle>.83?c:glyphs[Math.floor(Math.random()*glyphs.length)];}el.textContent=out;if(frame%2===0)window.InviteSignal?.tick?.();if(frame<steps&&!await wait(42))return false;}el.textContent=text;return alive();}
for(const selector of ['#final-welcome-pre','#final-matrix-the','#training-ready-message'])$(selector).textContent='';
if(gatherCharacter){const gather=$('#final-character-gather');window.FinalCharacterCode?.start?.(gather,$('#training-ready-slot'),{duration:6000,quiet});if(!await wait(quiet?240:6000,true)||!alive())return;window.FinalCharacterCode?.stop?.();panel.dataset.finale='formed';window.InviteSignal?.tick?.('A',true);if(!await wait(800,true)||!alive())return;}else if(!await wait(quiet?80:900)||!alive())return;panel.dataset.resolved='true';if(gatherCharacter){panel.dataset.finale='lock';if(!await wait(quiet?80:680)||!alive())return;}
receiptStop=window.CompletionReceipt?.reached?.({panel,name:guest});
const welcome=$('#final-welcome'),cue=$('#final-scroll-cue');panel.dataset.finale='awaiting';if(cue){cue.hidden=false;cue.onclick=()=>welcome?.scrollIntoView?.({behavior:quiet?'auto':'smooth',block:'center'});}
if(!await waitForWelcome(panel,welcome,alive)||!alive())return;if(cue)cue.hidden=true;panel.dataset.titleState='revealing';panel.dataset.finale='message';
if(!await reveal('#final-welcome-pre','YOU’RE READY TO ENTER',500))return;
if(!await reveal('#final-matrix-the','THE',220))return;
if(!await reveal('#training-ready-message','MATRIX',1000))return;
if(!alive())return;if(!await wait(quiet?80:700,true)||!alive())return;panel.dataset.finale='name';
if(guestLabel){
 if(quiet)guestLabel.textContent=guest;
 else{const steps=Math.ceil(Math.min(3600,Math.max(1600,guest.length*160))/42);for(let f=0;f<=steps;f++){if(!alive())return;const locked=Math.min(guest.length,Math.floor(f/steps*guest.length));guestLabel.textContent=guest.slice(0,locked)+(locked<guest.length?glyphs[(f*7)%glyphs.length]:'');if(f%2===0)window.InviteSignal?.tick?.();if(f<steps&&!await wait(42))return;}guestLabel.textContent=guest;}
}
if(!alive())return;panel.dataset.finale='title';panel.dataset.signal='confirmed';panel.dataset.titleState='complete';window.InviteSignal?.tick?.('A',true);if(!await wait(quiet?80:1000)||!alive())return;panel.dataset.signal='steady';panel.dataset.finale='ready';updateCountdown();details.hidden=false;const detailCue=$('#final-details-cue');if(detailCue){
 const revealScroll=panel.scrollTop||0;detailCue.hidden=false;
 const dismiss=()=>{if(!alive())return;if((panel.scrollTop||0)>revealScroll+24){detailCue.hidden=true;panel.removeEventListener?.('scroll',dismiss);}};
 detailCue.onclick=()=>{detailCue.hidden=true;panel.removeEventListener?.('scroll',dismiss);details.scrollIntoView?.({behavior:quiet?'auto':'smooth',block:'start'});};
 detailStop=()=>panel.removeEventListener?.('scroll',dismiss);panel.addEventListener?.('scroll',dismiss,{passive:true});
}clock=setInterval(updateCountdown,1000);}
window.AfterDarkFinale={show,reset,syncSound,countdown,titleFontSize};})();
