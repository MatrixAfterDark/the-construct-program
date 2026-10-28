(() => {
'use strict';const {setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame,cancelAnimationFrame}=window.ProgramLifecycle;const performance={now:window.ProgramLifecycle.now};
const $ = s => document.querySelector(s);
const root = $('#training-stage');
if (!root) return;
const DEFAULT = {
  operator: {commandAudio:null, video:null, diskCue:null, glitchCues:[], commandCues:[]}, introductionAudio:null,
  modules:[{id:'combat',label:'COMBAT',video:null},{id:'dance',label:'DANCE',video:null},{id:'social',label:'SOCIAL',video:null},{id:'drink',label:'DRINK',video:null}]
};
let config = DEFAULT, preparing = null, state = 'off', epoch = 0, profile = null;
let portrait = null, portraitWidth = 1, portraitHeight = 1, mirrored = false;
let installed = new Set(), pending = new Set(), mediaStops = new Set(), voices = new Set();
const buffers = new Map();
let takeoverPromise=null,loadHoldPromise=null,takeoverRun=0;
let operatorPlaybackEnded=false;
let introSkip = null, deckReady = false, briefingPlaying=false;
const quiet = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const valid = token => token === epoch && state !== 'off';
function normalizeTrainingConfig(data) {
  const path = value => typeof value === 'string' && value.startsWith('./assets/') && !value.includes('..') ? value : null;
  const op = data?.operator || {};
  return {
    operator:{gongAtLoad:op.gongAtLoad===true,loadHoldMs:Number.isFinite(op.loadHoldMs)?Math.max(0,Math.min(1500,op.loadHoldMs)):0,loadCue:Number.isFinite(op.loadCue)&&op.loadCue>=0?op.loadCue:null,commandAudio:path(op.commandAudio),video:path(op.video),diskCue:Number.isFinite(op.diskCue)&&op.diskCue>=0?op.diskCue:null,glitchCues:Array.isArray(op.glitchCues)?op.glitchCues.filter(x=>Number.isFinite(x)&&x>=0).slice(0,24):[],commandCues:Array.isArray(op.commandCues)?op.commandCues.filter(x=>x&&Number.isFinite(x.at)&&x.at>=0&&typeof x.text==='string').slice(0,32).map((x,i)=>({at:x.at,text:x.text.slice(0,72),duration:Number.isFinite(x.duration)?Math.max(.5,Math.min(6,x.duration)):2.5,slot:['left','right','far'].includes(x.slot)?x.slot:['left','right','far'][i%3]})):[]},
    sparringOpeningVideo:path(data?.sparringOpeningVideo),introductionAudio:path(data?.introductionAudio),introductionVideo:path(data?.introductionVideo),voiceOnly:data?.voiceOnly===true,inlineCall:data?.inlineCall===true,programFocus:data?.programFocus===true,cinematicUpload:data?.cinematicUpload===true,matrixTakeover:data?.matrixTakeover===true,loadTransition:['glitch','cinematic'].includes(data?.loadTransition)?data.loadTransition:'rain',optionalBriefing:data?.optionalBriefing===true,briefingReplay:data?.briefingReplay!==false,sparringTeaser:data?.sparringTeaser===true,entryUrl:typeof data?.entryUrl==='string'&&(data.entryUrl.startsWith('https://')||(data.entryUrl.startsWith('/')&&!data.entryUrl.startsWith('//')))?data.entryUrl:null,commandText:typeof data?.commandText==='string'?data.commandText.slice(0,100):null,
    modules:DEFAULT.modules.map(base=>{
      const supplied = Array.isArray(data?.modules) ? data.modules.find(x=>x.id===base.id) : null;
      return {...base,label:typeof supplied?.label==='string'?supplied.label.slice(0,36):base.label,video:path(supplied?.video),wireframe:supplied?.wireframe===true};
    })
  };
}
function prepare() {
  if (!preparing) preparing = (async()=>{
    const controller = new AbortController(), timeout = setTimeout(()=>controller.abort(),4000);
    try {const response=await fetch('./assets/training-program.json?v=single-briefing-texture-20261027',{signal:controller.signal});if(response.ok)config=normalizeTrainingConfig(await response.json());}
    catch {} finally {clearTimeout(timeout);}
    return config;
  })();
  return preparing;
}
function arm() {
  window.InviteSignal?.unlock?.();
  window.TrainingWireframe?.prepare?.();
  prepare().then(c=>{for(const url of [c.operator.commandAudio,c.introductionAudio])if(url)loadSound(url);});
  window.ZionAudio?.context?.resume?.().catch(()=>{});

}

function wait(ms,keepDuration=false) {
  return new Promise(resolve=>{
    const done=ok=>{clearTimeout(timer);pending.delete(done);resolve(ok);};
    const timer=setTimeout(()=>done(true),quiet()&&!keepDuration?Math.min(ms,80):ms);pending.add(done);
  });
}
function setScene(next) {
  state=next;root.dataset.phase=next;
  const heading=$('#training-heading');if(heading)heading.textContent=['isolation','operator','launch'].includes(next)?'RESIDUAL SELF IMAGE':next==='playing'?'TRAINING PROGRAM':config.programFocus?'TRAINING PROGRAM':'SPARRING CONSTRUCT';
  if(next==='launch'&&config.cinematicUpload&&!config.matrixTakeover){$('#selection-stage').classList.add('training-dissolving');}
  if(next==='arrival'){$('#training-manifest').hidden=false;renderManifest();$('#training-program-status').textContent='MORPHEUS / TRANSMISSION';}

  if (['isolation','operator','launch','arrival','manifest','playing','complete'].includes(next)) requestAnimationFrame(layoutAvatar);
}
function loadSound(url) {
  const ctx=window.ZionAudio?.context;if(!url||!ctx)return Promise.resolve(null);
  if(!buffers.has(url)) buffers.set(url,(async()=>{
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);
    try {const r=await fetch(url,{signal:controller.signal});if(!r.ok)return null;return await ctx.decodeAudioData(await r.arrayBuffer());}
    catch{return null;}finally{clearTimeout(timeout);}
  })());
  return buffers.get(url);
}
function renderCommandWords(time){
 for(const slot of ['left','right','far']){
  const node=$('#training-phrase-'+slot),cue=Number.isFinite(time)?config.operator.commandCues.find(x=>x.slot===slot&&time>=x.at&&time<x.at+x.duration):null;
  // A retained page may predate these optional narration slots.
  if(!node)continue;
  node.hidden=!cue;node.textContent=cue?.text||'';
 }
}
function playSound(url,token,skippable=false,onTime=null,onStart=null) {
 if(!url)return Promise.resolve(false);
 return new Promise(resolve=>{
  let source=null,voiceGain=null,finished=false,frame=0;
  const finish=ok=>{if(finished)return;finished=true;if(frame)cancelAnimationFrame(frame);if(onTime)onTime(null);mediaStops.delete(stop);if(source){source.onended=null;try{source.disconnect();voiceGain?.disconnect();}catch{}voices.delete(source);}if(introSkip===stop)introSkip=null;resolve(ok);};
  const stop=()=>{try{source?.stop();}catch{}finish(false);};
  mediaStops.add(stop);if(skippable)introSkip=stop;
  loadSound(url).then(buffer=>{
   const audio=window.ZionAudio;if(finished)return;
   if(!buffer||!valid(token)||!audio?.context){finish(false);return;}
   try{source=audio.context.createBufferSource();source.buffer=buffer;if(url===config.introductionAudio){voiceGain=audio.context.createGain();voiceGain.gain.value=4;source.connect(voiceGain);voiceGain.connect(audio.destination);}else source.connect(audio.destination);source.onended=()=>finish(true);voices.add(source);const start=audio.context.currentTime;source.start();if(onStart)onStart();
    if(onTime){const tick=()=>{if(finished||!valid(token))return;onTime(Math.max(0,audio.context.currentTime-start));frame=requestAnimationFrame(tick);};tick();}
   }catch{stop();}
  }).catch(()=>finish(false));
 });
}
let humVoices=[];
function stopHum(){for(const voice of humVoices){try{voice.stop();}catch{}voices.delete(voice);}humVoices=[];}
function startHum(){
 const audio=window.ZionAudio,ctx=audio?.context;if(!ctx||ctx.state!=='running')return;
 try{for(const hz of [43,67]){const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.value=hz;g.gain.value=.006;o.connect(g).connect(audio.destination);o.start();voices.add(o);humVoices.push(o);}}catch{stopHum();}
}
function machineCue() {
  const audio=window.ZionAudio,ctx=audio?.context;if(!ctx||audio.muted||ctx.state!=='running')return;
  try{
    const t=ctx.currentTime,o=ctx.createOscillator(),g=ctx.createGain();o.type='triangle';o.frequency.setValueAtTime(120,t);o.frequency.exponentialRampToValueAtTime(38,t+.19);g.gain.setValueAtTime(.065,t);g.gain.exponentialRampToValueAtTime(.0001,t+.22);o.connect(g).connect(audio.destination);o.start(t);o.stop(t+.23);voices.add(o);o.onended=()=>voices.delete(o);
    if(ctx.createBuffer&&ctx.createBiquadFilter){
     const n=ctx.createBufferSource(),b=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.48),ctx.sampleRate),data=b.getChannelData(0),filter=ctx.createBiquadFilter(),ng=ctx.createGain();
     for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1);
     n.buffer=b;filter.type='lowpass';filter.frequency.setValueAtTime(1900,t);filter.frequency.exponentialRampToValueAtTime(90,t+.48);ng.gain.setValueAtTime(.025,t);ng.gain.exponentialRampToValueAtTime(.0001,t+.48);n.connect(filter).connect(ng).connect(audio.destination);n.start(t);n.stop(t+.49);voices.add(n);n.onended=()=>voices.delete(n);
    }

  }catch{}
}
function syncSound() {
  window.AfterDarkFinale?.syncSound?.();
  const muted=!!window.ZionAudio?.muted;
  $('#training-sound').textContent=muted?'SOUND OFF':'SOUND ON';$('#training-sound').setAttribute('aria-pressed',String(!muted));
  const film=$('#training-intro-video');if(film){film.muted=muted||root.dataset.sparringTeaserActive==='true';film.volume=root.dataset.sparringTeaserActive==='true'?0:1;}
  $('#training-clip').muted=muted;$('#training-operator-video').muted=muted;$('#training-operator-video').volume=1;
}
function captureAvatar() {
  const source=$('.identity-preview .portrait-crt');
  if(!source||$('#identity-portrait').hidden)return false;
  if(config.cinematicUpload)addCodeEffect(source);
  portrait=source.cloneNode(true);portrait.classList.add('training-portrait');
  portraitWidth=parseFloat(source.style.width)||source.getBoundingClientRect().width;
  portraitHeight=parseFloat(source.style.height)||source.getBoundingClientRect().height;
  mirrored=source.style.transform.includes('scaleX(-1)');
  for(const node of portrait.querySelectorAll('[id]')){if(node.id==='identity-portrait')node.classList.add('training-look');node.removeAttribute('id');}
  portrait.removeAttribute('id');portrait.setAttribute('aria-hidden','true');
  $('#training-avatar').replaceChildren(portrait);
  $('#training-avatar').setAttribute('aria-label',`${profile.subject} — confirmed residual self image`);
  renderIdentityScan();captureCinemaPortraits();captureArchivePortrait();
  return true;
}
function trainingAvatarGeometry(bounds,width,height) {
  return {scale:Math.max(.01,Math.min(1,bounds.width/Math.max(1,width),bounds.height/Math.max(1,height)))};
}
function layoutAvatar() {
  if(!portrait||root.hidden)return;
  const frame=root.getBoundingClientRect();let bounds;
  const slot=$((['arrival','manifest','complete'].includes(state)||(config.programFocus&&state==='playing'))?'#training-dojo-slot':'#training-scan-slot');
  if(slot){const r=slot.getBoundingClientRect();bounds={left:r.left-frame.left,top:r.top-frame.top,width:r.width,height:r.height};}
  else {bounds={left:frame.width*.3,top:frame.height*.16,width:frame.width*.4,height:frame.height*.49};}
  const avatar=$('#training-avatar'),scale=trainingAvatarGeometry(bounds,portraitWidth,portraitHeight).scale;
  Object.assign(avatar.style,{left:bounds.left+'px',top:bounds.top+'px',width:bounds.width+'px',height:bounds.height+'px'});
  portrait.style.transform=`translateX(-50%) scale(${mirrored?-scale:scale},${scale})`;
  $('#training-floor').style.top=(bounds.top+bounds.height-46)+'px';
  layoutIdentitySamples();layoutCinemaPortraits();layoutReady();layoutArchivePortrait();
}
const icons={
 combat:'M16 4v10m0-8 8 3 5-3M16 8l-7 6-5-2m12 2-7 7-5 6m12-13 7 6 4 7',
 dance:'M16 3v13M16 8 7 4 4 9m12-1 8-5 4 3M16 16l-8 5 2 7m6-12 8 6 4-2',
 social:'M9 3v11m0-7 7 6 7-6m0-4v11M9 14 4 28m5-14 5 14m9-14-5 14m5-14 5 14',
 drink:'M13 3v13m0-9 6 2 4-6m-10 6-7 8m7-1-5 12m5-12 7 12M21 2h6l-1 5h-4zm3 5v5m-3 0h6'
};
function renderIdentityScan(){
 const title=$('#training-profile-label');if(title)title.textContent=(profile.role||'OPERATIVE').toUpperCase()+' // CONFIRMED';
 const hair=$('#training-hair-label');if(hair)hair.textContent=(profile.hair==='bald'?'SHAVED':profile.hair||'HAIR').toUpperCase()+' // LOCKED';
 for(const id of ['hair','face','outfit']){const slot=$('#training-sample-'+id);if(!slot)continue;const copy=portrait.cloneNode(true);copy.classList.remove('training-portrait','portrait-crt');copy.classList.add('scan-copy');slot.replaceChildren(copy);}
 layoutIdentitySamples();
}
function layoutIdentitySamples(){
 for(const [id,start,end] of [['hair',0,.24],['face',.035,.21],['outfit',.2,.78]]){
  const slot=$('#training-sample-'+id),copy=slot?.children[0];if(!copy)continue;
  const r=slot.getBoundingClientRect(),scale=Math.min(r.width/(portraitWidth*.64),r.height/(portraitHeight*(end-start)));
  Object.assign(copy.style,{width:portraitWidth+'px',height:portraitHeight+'px',left:'50%',top:(-start*portraitHeight*scale)+'px',bottom:'auto',transformOrigin:'50% 0',transform:`translateX(-50%) scale(${mirrored?-scale:scale},${scale})`});
 }
}
function archiveEnabled(){return !!$('#training-archive-motion')?.getContext;}
function captureArchivePortrait(){
 const slot=$('#training-archive-rsi');if(!slot||!portrait)return;
 const copy=portrait.cloneNode(true);copy.classList.remove('training-portrait','portrait-crt');copy.classList.add('scan-copy','archive-portrait');slot.replaceChildren(copy);layoutArchivePortrait();
}
function layoutArchivePortrait(){
 const slot=$('#training-archive-rsi'),copy=slot?.children[0];if(!copy)return;
 const r=slot.getBoundingClientRect(),scale=Math.min(r.width/(portraitWidth*.74),r.height*.90/(portraitHeight*.38));
 Object.assign(copy.style,{width:portraitWidth+'px',height:portraitHeight+'px',left:'50%',top:(r.height*.06)+'px',bottom:'auto',transformOrigin:'50% 0',transform:`translateX(-50%) scale(${mirrored?-scale:scale},${scale})`});
}
function archiveSkill(module){
 if(!archiveEnabled())return;
 $('#training-motion-title').textContent=module.label;$('#training-motion-file').textContent=module.id.toUpperCase()+'.PRG';
 $('#training-motion-caption').textContent={combat:'Punches, kicks & bullet-time',dance:'Disco, floorwork & breakdance',social:'Meet, greet & connect',drink:'Raise a glass'}[module.id];
 $('#training-archive-motion').setAttribute('aria-label',module.label+' wireframe motion study');
 window.TrainingWireframe?.preview?.($('#training-archive-motion'),module.id,1.75);
}
function renderManifest() {
  if(archiveEnabled()){$('#training-archive-fill').style.width='0%';$('#training-archive-percent').textContent='0%';$('#training-archive-meter').setAttribute('aria-valuenow','0');$('#training-archive-upload-label').textContent='UPLOAD PROGRESS';}
  const list=$('#training-modules');list.replaceChildren();
  for(const [index,module] of config.modules.entries()){
    const row=document.createElement('li');row.className='training-module';row.dataset.module=module.id;row.dataset.status=installed.has(module.id)?'installed':'queued';row.dataset.prepared='false';if(state==='arrival'&&config.introductionVideo)row.dataset.introPrepared='false';
    const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 32 32');icon.setAttribute('aria-hidden','true');
    const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',icons[module.id]);icon.append(path);
    const bay=document.createElement('span');bay.className='training-bay';bay.textContent=String(index+1).padStart(2,'0');
    const label=document.createElement('span');label.className='training-module-name';label.textContent=module.label;
    const status=document.createElement('b');status.className='training-module-status';status.textContent=installed.has(module.id)?'✓ COMPLETE':module.video||module.wireframe?'QUEUED':'NO MEDIA';
    const trace=document.createElement('span');trace.className='training-module-trace';trace.setAttribute('aria-hidden','true');for(let i=0;i<18;i++){const bit=document.createElement('i');bit.style.setProperty('--bit',String(i));trace.append(bit);}
    const preview=document.createElement('canvas');preview.className='training-module-preview';preview.setAttribute('aria-hidden','true');preview.dataset.skill=module.id;
    const file=document.createElement('span');file.className='program-file';file.textContent=module.id.toUpperCase()+'.PRG';
    const blocks=document.createElement('span');blocks.className='program-blocks';blocks.textContent='0000 / 1024 BLOCKS';
    const meter=document.createElement('span');meter.className='program-meter';meter.setAttribute('role','progressbar');meter.setAttribute('aria-label',module.label+' installation');meter.setAttribute('aria-valuemin','0');meter.setAttribute('aria-valuemax','100');meter.setAttribute('aria-valuenow',installed.has(module.id)?'100':'0');
    const fill=document.createElement('i');meter.append(fill);
    const log=document.createElement('span');log.className='program-log';log.textContent='NEURAL WRITE // STANDBY';row.programReadout={blocks,meter,fill,log};
    const subtitle=document.createElement('span');subtitle.className='program-subtitle';subtitle.textContent={combat:'Punches, kicks & bullet-time',dance:'Dance-floor moves',social:'Meet, greet & connect',drink:'Raise a glass'}[module.id];
    const screen=document.createElement('div');screen.className='program-screen';screen.append(preview);
    row.append(bay,screen,icon,label,status,trace,file,blocks,meter,log,subtitle);list.append(row);
  }
  window.TrainingWireframe?.prepare?.()?.then?.(()=>{if(state==='manifest')layoutProgramPreviews();});
  updateAvailability();archiveSkill(config.modules.find(x=>!installed.has(x.id))||config.modules[0]);requestAnimationFrame(layoutProgramPreviews);
}
function layoutProgramPreviews(){
 if(archiveEnabled()&&state!=='playing')archiveSkill(config.modules.find(x=>!installed.has(x.id))||config.modules[0]);
 for(const row of $('#training-modules').children){const node=row.querySelector('canvas');if(node)window.TrainingWireframe?.preview?.(node,row.dataset.module);}
}
function updateAvailability() {
  const ready=config.modules.every(module=>!!module.video||module.wireframe),complete=installed.size===config.modules.length;
  $('#training-load').disabled=briefingPlaying||!deckReady||!ready||complete||state==='playing';$('#training-program-heading').textContent='PROGRAM DECK';$('#training-load').textContent=complete?'ALL PROGRAMS LOADED':state==='playing'?'UPLOADING…':'[ LOAD ALL SKILLS ]';
  root.dataset.uploadPrompt=String(!$('#training-load').disabled);
  $('#training-program-status').textContent=complete?'OPERATIVE // READY':ready?'FOUR PROGRAMS // READY':'PROGRAM MEDIA // STANDBY';
  $('#training-count').textContent=`${String(installed.size).padStart(2,'0')} / ${String(config.modules.length).padStart(2,'0')}`;
}
async function showManifest(token) {
  deckReady=false;root.dataset.deck='syncing';
  $('#training-manifest').hidden=false;$('#training-header').hidden=false;$('#training-footer').hidden=false;$('#training-arrival-title').hidden=true;
  setScene('manifest');renderManifest();$('#training-program-status').textContent='PROGRAM BUS // SYNC';
  // Stage the virtual cartridge bays. This does not claim media is installed.
  for(const row of $('#training-modules').children){
   if(!quiet()&&!await wait(180))return false;
   if(!valid(token))return false;
   row.dataset.prepared='true';window.ZionAudio?.tick?.('█');
  }
  deckReady=true;root.dataset.deck='ready';updateAvailability();root.removeAttribute('aria-busy');
  root.dispatchEvent(new CustomEvent('zion:training-construct-ready',{detail:profile}));return true;
}
// Local signal interruptions follow decoded media frames, including after buffering.
function operatorSignal(time,cues){
 if(!Number.isFinite(time))return 0;
 return cues.reduce((loss,cue)=>Math.max(loss,Math.max(0,1-Math.abs(time-cue)/.095)*.86),0);
}
function operatorLoad(time){
 if(config.introductionVideo&&Number.isFinite(time)&&Number.isFinite(config.operator.loadCue)&&time+.001>=config.operator.loadCue){if(config.matrixTakeover&&config.cinematicUpload){if(config.sparringTeaser&&config.operator.gongAtLoad)beginTakeover(epoch);else scheduleTakeover(epoch);}else acceptProgram();}
}
function acceptProgram(){
 if(root.dataset.handoff==='accepted')return;
 root.dataset.handoff='accepted';$('#training-operator').classList.add('load-accepted');
}
function renderOperatorSignal(time){
 operatorLoad(time);
 const loss=quiet()?0:operatorSignal(time,config.operator.glitchCues);
 const panel=$('#training-operator');panel.style.setProperty('--operator-loss',String(loss));
 panel.style.setProperty('--operator-tear',(loss*(Math.sin((time||0)*240)>=0?7:-7))+'px');
 panel.style.setProperty('--operator-wobble',quiet()?'0px':(Math.sin((time||0)*3.4)*.45)+'px');
}
function playVideo(video,url,token,{cue=null,onTime=()=>{},onFrame=null,onStart=null,skippable=false,requireStart=false}={}) {
  return new Promise(resolve=>{
    let finished=false,frame=0,began=false;
    const videoFrames=typeof video.requestVideoFrameCallback==='function';
    const watch=(_,metadata)=>{if(finished||!valid(token))return;if(onFrame&&(!requireStart||began)){const mediaTime=metadata?.mediaTime??video.currentTime;if(!requireStart||!Number.isFinite(video.currentTime)||Math.abs(mediaTime-video.currentTime)<.5)onFrame(mediaTime);}frame=videoFrames?video.requestVideoFrameCallback(watch):requestAnimationFrame(watch);};
    const playButton=$('#training-media-play');
    const finish=ok=>{if(finished)return;finished=true;mediaStops.delete(stop);if(introSkip===stop)introSkip=null;if(frame){if(videoFrames)video.cancelVideoFrameCallback?.(frame);else cancelAnimationFrame(frame);}if(onFrame)onFrame(null);video.removeEventListener('ended',end);video.removeEventListener('error',error);video.removeEventListener('timeupdate',time);playButton.hidden=true;playButton.onclick=null;video.pause();resolve(ok);};
    const stop=()=>finish(false),end=()=>{if(requireStart&&(!began||video.ended===false))return;finish(true);},error=()=>finish(false);
    const time=()=>{if(requireStart&&!began)return;onTime(video.currentTime,video.duration);if(cue!==null&&video.currentTime>=cue)finish(true);};
    const play=()=>{if(!valid(token)){stop();return;}playButton.hidden=true;try{Promise.resolve(video.play()).then(()=>{if(!finished&&!began){began=true;onStart?.();}}).catch(()=>{if(!finished){playButton.hidden=false;playButton.onclick=play;}});}catch{error();}};
    mediaStops.add(stop);if(skippable)introSkip=stop;video.addEventListener('ended',end);video.addEventListener('error',error);video.addEventListener('timeupdate',time);video.src=url;video.load();syncSound();play();if(onFrame)frame=videoFrames?video.requestVideoFrameCallback(watch):requestAnimationFrame(watch);
  });
}
// Leave Morpheus before the first Neo shot; one uninterrupted voice continues over the deck.
function narrationShot(time){
 return Number.isFinite(time)&&time>=5.266667?'wide':'morpheus';
}
function captureCinemaPortraits(){
 for(const id of ['reaction','wide']){
  const host=$('#training-cinema-'+id+'-avatar');if(!host)continue;
  const copy=portrait.cloneNode(true);copy.classList.remove('training-portrait','portrait-crt');copy.classList.add('cinema-portrait');host.replaceChildren(copy);
 }
 layoutCinemaPortraits();
}
function layoutCinemaPortraits(){
 const panel=$('#training-cinema');if(!panel||!portrait)return;
 const r=root.getBoundingClientRect();
 for(const id of ['reaction','wide']){
  const host=$('#training-cinema-'+id+'-avatar'),copy=host?.children[0];if(!copy)continue;
  const scale=id==='reaction'?Math.min(r.width/(portraitWidth*.72),r.height/(portraitHeight*.56)):Math.min(1,r.height*.225/portraitHeight);
  Object.assign(copy.style,{width:portraitWidth+'px',height:portraitHeight+'px',left:id==='reaction'?'50%':'78%',top:id==='reaction'?'17%':'auto',bottom:id==='wide'?'17.5%':'auto',transformOrigin:id==='reaction'?'50% 0':'50% 100%',transform:`translateX(-50%) scale(${mirrored?-scale:scale},${scale})`});
 }
}
function renderNarrationFrame(time){
 if(!Number.isFinite(time)||!['cinema','launch','black','arrival'].includes(state))return;
 const shot=narrationShot(time),panel=$('#training-cinema');
 $('#training-cinema-reaction').hidden=shot!=='reaction';$('#training-cinema-wide').hidden=shot!=='wide';
 if(shot==='wide'&&panel.dataset.shot!=='wide'){
  setScene('arrival');const frame=root.getBoundingClientRect(),target=$('#training-dojo').getBoundingClientRect();
  panel.style.setProperty('--wide-x',(target.left-frame.left)+'px');panel.style.setProperty('--wide-y',(target.top-frame.top)+'px');
  panel.style.setProperty('--wide-sx',String(target.width/Math.max(1,frame.width)));panel.style.setProperty('--wide-sy',String(target.height/Math.max(1,frame.height)));
 }
 panel.dataset.shot=shot;
 if(shot==='wide')prepareProgramDeck(time);
}
function prepareProgramDeck(time){
 const cues=config.voiceOnly?[0,2.5,5,7.5]:[5.266667,9.3,13.3,17.3];
 for(const [i,row] of Array.from($('#training-modules').children).entries()){
  const elapsed=time-cues[i],prepared=elapsed>=0;row.dataset.introPrepared=String(prepared);
  const status=row.querySelector('b');if(status)status.textContent=prepared?(elapsed<1.8?'LINKING':'QUEUED'):'STANDBY';
  const preview=row.querySelector('canvas'),moving=!quiet()&&elapsed<1.8;
  if(prepared&&preview&&(moving||row.dataset.previewSettled!=='true')){window.TrainingWireframe?.preview?.(preview,row.dataset.module,quiet()?.22:Math.min(1.8,elapsed)/1.8);row.dataset.previewSettled=String(!moving);}
 }
}
async function finishVoiceSection(token){
 // Retain the approved native audio track and its volume. The film stays hidden.
 const panel=$('#training-cinema'),video=$('#training-intro-video');panel.hidden=true;
 if(root.dataset.inlineCall!=='true'){setScene('arrival');prepareProgramDeck(0);}$('#training-skip').hidden=false;
 let release,skipped=false;const ready=new Promise(resolve=>{release=resolve;});
 const playback=playVideo(video,config.introductionVideo,token,{onTime:prepareProgramDeck,onStart:()=>release(true),skippable:true});
 const stop=introSkip;introSkip=()=>{skipped=true;stop?.();};
 playback.then(()=>release(false));const started=await ready;if(!valid(token))return;
 if(started){root.dataset.handoff='off';setScene('launch');if(!await wait(650)||!valid(token))return;$('#selection-stage').hidden=true;root.dataset.inlineCall='false';setScene('black');if(!await wait(140)||!valid(token))return;setScene('arrival');prepareProgramDeck(video.currentTime||0);}
 const ended=await playback;if(!valid(token))return;introSkip=null;$('#training-skip').hidden=true;
 if(!ended&&!skipped){root.removeAttribute('aria-busy');const retry=$('#training-media-play');retry.textContent='RETRY TRANSMISSION';retry.hidden=false;retry.onclick=()=>{retry.hidden=true;finishVoiceSection(token).catch(()=>reset());};return;}
 $('#selection-stage').hidden=true;root.dataset.inlineCall='false';
 window.ResidualExperience?.duckTrainingMusic?.(.48,2200);
 if(!await showManifest(token)||!valid(token))return;$('#training-load').focus({preventScroll:true});
}
async function finishFilmSection(token){
 const panel=$('#training-cinema'),video=$('#training-intro-video');
 panel.hidden=false;panel.dataset.shot='morpheus';$('#training-cinema-reaction').hidden=true;$('#training-cinema-wide').hidden=true;
 setScene('cinema');$('#training-skip').hidden=false;layoutCinemaPortraits();
 let release,skipped=false;const ready=new Promise(resolve=>{release=resolve;});
 const playback=playVideo(video,config.introductionVideo,token,{onFrame:renderNarrationFrame,onTime:renderNarrationFrame,onStart:()=>release(true),skippable:true});
 const stop= introSkip;introSkip=()=>{skipped=true;stop?.();};
 playback.then(()=>release(false));const started=await ready;if(!valid(token))return;
 if(started){
  root.dataset.handoff='off';setScene('launch');if(!await wait(650)||!valid(token))return;
  setScene('black');if(!await wait(140)||!valid(token))return;
  setScene('cinema');
 }
 const ended=await playback;if(!valid(token))return;introSkip=null;$('#training-skip').hidden=true;
 if(!ended&&!skipped){
  root.removeAttribute('aria-busy');const retry=$('#training-media-play');retry.textContent='RETRY TRANSMISSION';retry.hidden=false;
  retry.onclick=()=>{retry.hidden=true;finishFilmSection(token).catch(()=>reset());};return;
 }
 panel.hidden=true;setScene('arrival');window.ResidualExperience?.duckTrainingMusic?.(.48,2200);
 if(!await showManifest(token)||!valid(token))return;
 $('#training-load').focus({preventScroll:true});
}
async function start(detail) {
 reset();const token=epoch;profile=Object.freeze({...detail});installed=new Set();
 await prepare();if(token!==epoch)return;
 if(config.introductionAudio)loadSound(config.introductionAudio);
 if(config.sparringTeaser&&config.introductionVideo){const film=$('#training-intro-video');film.preload='auto';film.muted=true;film.defaultMuted=true;film.volume=0;film.src=config.sparringOpeningVideo||config.introductionVideo;film.load();}
 if(!captureAvatar())return;
 $('#selection-stage').hidden=!config.inlineCall;$('#selection-stage').classList.add('training-command-active');root.dataset.inlineCall=String(config.inlineCall);root.dataset.programFocus=String(config.programFocus);root.dataset.cinematic=String(config.cinematicUpload);root.dataset.matrixTakeover=String(config.matrixTakeover);root.dataset.loadTransition=config.loadTransition;root.hidden=false;root.setAttribute('aria-busy','true');
 $('#training-header').hidden=false;setScene('isolation');syncSound();window.ResidualExperience?.setTrainingAudio?.(true);startHum();
 await prepare();if(!valid(token))return;
 // Give the confirmed portrait one quiet beat before voice or operator action.
 if(!await wait(config.inlineCall?80:1100)||!valid(token))return;
 const command=$('#training-command');
 if(command&&config.inlineCall&&config.commandText){command.textContent=config.commandText;command.hidden=false;}
 if(config.operator.commandAudio){$('#training-skip').hidden=false;await playSound(config.operator.commandAudio,token,true,renderCommandWords);$('#training-skip').hidden=true;}
 else if(config.inlineCall&&config.commandText){if(!await wait(1600)||!valid(token))return;}
 if(command)command.hidden=true;
 if(!valid(token))return;
 if(config.operator.video){
  $('#selection-stage').classList.remove('training-command-active');$('#selection-stage').classList.add('training-call-active');operatorPlaybackEnded=false;
  setScene('operator');window.ResidualExperience?.duckTrainingMusic?.(.08,1800);$('#training-operator').hidden=false;
  if(!await wait(config.inlineCall?80:220)||!valid(token))return;
  let skipped=false;const skip=$('#training-operator-skip');
  const playback=playVideo($('#training-operator-video'),config.operator.video,token,{cue:config.operator.diskCue,onFrame:renderOperatorSignal,onTime:operatorLoad,skippable:config.cinematicUpload,requireStart:true});
  if(skip){skip.hidden=!config.cinematicUpload;const stop=introSkip;skip.onclick=()=>{skipped=true;operatorPlaybackEnded=true;acceptProgram();if(config.matrixTakeover)beginTakeover(token);stop?.();};}
  const ended=await playback;operatorPlaybackEnded=true;if(skip){skip.hidden=true;skip.onclick=null;}
  if(!valid(token))return;
  if(!ended&&!skipped){if(config.operator.gongAtLoad){for(const stop of [...mediaStops])stop();}if(config.matrixTakeover){abortTakeover();$('#selection-stage').hidden=false;root.dataset.inlineCall=String(config.inlineCall);root.dataset.handoff='off';$('#training-operator').classList.remove('load-accepted');$('#training-operator').hidden=false;$('#training-manifest').hidden=true;$('#training-footer').hidden=true;deckReady=false;updateAvailability();setScene('operator');}root.removeAttribute('aria-busy');const retry=$('#training-media-play');retry.textContent='RETRY OPERATOR';retry.hidden=false;retry.onclick=()=>{arm();start(detail).catch(()=>reset());};return;}
 }
 stopHum();if(!(config.cinematicUpload&&config.matrixTakeover))$('#training-operator').hidden=true;
 // The phone-feed effect layers over the existing music level; only narration needs another duck.
 if(!(config.cinematicUpload&&config.matrixTakeover&&config.loadTransition==='cinematic'))window.ResidualExperience?.duckTrainingMusic?.(.035,1600);
 if(config.cinematicUpload&&config.matrixTakeover){
  if(!await (takeoverPromise||scheduleTakeover(token))||!valid(token))return;if(config.loadTransition!=='cinematic'){gongCue();window.ResidualExperience?.duckTrainingMusic?.(.48,1400);}
  deckReady=true;root.dataset.deck='ready';updateAvailability();root.removeAttribute('aria-busy');$('#training-briefing').hidden=!config.introductionVideo||!config.briefingReplay;
  root.dispatchEvent(new CustomEvent('zion:training-construct-ready',{detail:profile}));$('#training-load').focus({preventScroll:true});return;
 }
 if(config.cinematicUpload){
  acceptProgram();gongCue();setScene('launch');if(!await wait(650)||!valid(token))return;
  $('#selection-stage').hidden=true;root.dataset.inlineCall='false';root.dataset.handoff='off';setScene('black');if(!await wait(100)||!valid(token))return;
  window.ResidualExperience?.duckTrainingMusic?.(.48,1400);if(!await showManifest(token)||!valid(token))return;
  $('#training-briefing').hidden=!config.introductionVideo||!config.briefingReplay;$('#training-load').focus({preventScroll:true});return;
 }
 if(config.inlineCall&&config.introductionVideo){acceptProgram();await finishVoiceSection(token);return;}
 if(config.introductionVideo){acceptProgram();if(!await wait(550)||!valid(token))return;await (config.voiceOnly?finishVoiceSection(token):finishFilmSection(token));return;}
 let introduction=null;
 if(config.introductionAudio){
  let releaseLaunch;const ready=new Promise(resolve=>{releaseLaunch=resolve;});
  $('#training-skip').hidden=false;
  introduction=playSound(config.introductionAudio,token,true,null,releaseLaunch);
  introduction.then(releaseLaunch);await ready;if(!valid(token))return;
 }
 setScene('launch');if(!introduction)machineCue();
 if(!await wait(650)||!valid(token))return;
 setScene('black');if(!await wait(140)||!valid(token))return;
 $('#training-arrival-title').hidden=false;setScene('arrival');
 if(!await wait(900)||!valid(token))return;
 if(introduction){await introduction;$('#training-skip').hidden=true;}
 else if(!await wait(350))return;
 if(!valid(token))return;
 window.ResidualExperience?.duckTrainingMusic?.(.48,2200);
 if(!await showManifest(token)||!valid(token))return;
 if(document.activeElement===document.body||document.activeElement===$('#identity-review'))$('#training-return').focus({preventScroll:true});
}
function playbackProgress(time,duration) {return Number.isFinite(time)&&Number.isFinite(duration)&&duration>0?Math.max(0,Math.min(100,time/duration*100)):0;}
async function loadTraining() {
  if(briefingPlaying||!deckReady||!['manifest','complete'].includes(state)||!config.modules.every(x=>x.video||x.wireframe)||installed.size===config.modules.length)return;
  const token=epoch;root.dataset.uploadPrompt='false';setScene('playing');$('#training-player').hidden=false;$('#training-load').disabled=true;
  for(const module of config.modules){
    if(installed.has(module.id))continue;
    const row=Array.from($('#training-modules').children).find(x=>x.dataset.module===module.id);
    $('#training-player').hidden=config.programFocus&&module.wireframe;root.dataset.activeProgram=module.id;row.dataset.status='loading';archiveSkill(module);$('#training-load').textContent='UPLOADING…';row.querySelector('b').textContent='UPLOADING';$('#training-player-title').textContent=module.label;$('#training-playback-progress').style.width='0%';
    const progress=percent=>{const value=Math.round(percent);if(archiveEnabled()){$('#training-archive-fill').style.width=value+'%';$('#training-archive-percent').textContent=value+'%';$('#training-archive-meter').setAttribute('aria-valuenow',String(value));$('#training-archive-upload-label').textContent='UPLOADING // '+module.id.toUpperCase()+'.PRG';}$('#training-playback-progress').style.width=value+'%';$('#training-upload-percent').textContent=value+'%';const meter=$('#training-upload-meter');meter?.setAttribute('aria-valuenow',String(value));row.style.setProperty('--upload',value+'%');const r=row.programReadout;if(r){r.blocks.textContent=String(Math.floor(value*10.24)).padStart(4,'0')+' / 1024 BLOCKS';r.meter.setAttribute('aria-valuenow',String(value));r.fill.style.width=value+'%';r.log.textContent=value<15?'ACQUIRE / MOTION DATA':value<85?'WRITE / NEURAL MEMORY':value<100?'VERIFY / CHECKSUM':'CHECKSUM OK // INSTALLED';}};
    $('#training-clip').hidden=!!module.wireframe;$('#training-wireframe').hidden=!module.wireframe;
    const ended=module.wireframe?await playWireframe(module,token,progress,archiveEnabled()?$('#training-archive-motion'):config.programFocus?row.querySelector('canvas'):null):await playVideo($('#training-clip'),module.video,token,{onTime:(time,duration)=>progress(playbackProgress(time,duration))});
    if(!valid(token))return;
    if(!ended){row.dataset.status='queued';row.querySelector('b').textContent='AWAITING PROGRAM';$('#training-player').hidden=true;setScene('manifest');updateAvailability();$('#training-program-status').textContent='PROGRAM // RETRY REQUIRED';return;}
    installed.add(module.id);row.dataset.status='installed';row.querySelector('b').textContent='✓ COMPLETE';window.ZionAudio?.tick?.('█');updateAvailability();
    if(!await wait(config.cinematicUpload?120:360)||!valid(token))return;
  }
  if(config.cinematicUpload){if(!await wait(550)||!valid(token))return;}
  $('#training-player').hidden=true;setScene('complete');if(config.cinematicUpload)await showCompletion(token);if(!valid(token))return;updateAvailability();$('#training-program-status').textContent='ALL PROGRAMS LOADED // OPERATIVE READY';window.ZionAudio?.tick?.('█');
}
async function playWireframe(module,token,progress,canvas=null){
 $('#training-clip').hidden=true;$('#training-wireframe').hidden=false;
 window.TrainingWireframe?.start?.(canvas||$('#training-wireframe'),module.id,quiet(),config.cinematicUpload?(module.id==='combat'?2:2.666667):1);
 const stopNoise=startUploadNoise();machineCue();
 try{
  progress(0);
  const duration=config.cinematicUpload?(module.id==='combat'?3200:2400):6400;
 const steps=quiet()?12:duration/100;
  for(let i=1;i<=steps;i++){
   if(!await wait(quiet()?80:100)||!valid(token))return false;
   progress(i/steps*100);
   if(i%8===0)window.ZionAudio?.tick?.('█');
  }
  return valid(token);
 }finally{stopNoise();window.TrainingWireframe?.stop?.();}
}
function abortTakeover(){
 window.InviteSignal?.stop?.();takeoverRun++;takeoverPromise=null;loadHoldPromise=null;root.dataset.loadHold='off';window.MatrixTakeover?.stop?.();window.CRTLetterPortal?.stop?.();const portal=$('#training-letter-portal');if(portal)portal.hidden=true;const letterFilm=$('#training-letter-film');if(letterFilm){letterFilm.pause();letterFilm.hidden=true;}window.ProgramSurge?.stop?.();const canvas=$('#training-takeover');if(canvas)canvas.hidden=true;root.dataset.transition='off';$('#selection-stage').classList.remove('matrix-signal-tear','matrix-cinematic-rupture');
}
function scheduleTakeover(token){
 if(loadHoldPromise)return loadHoldPromise;
 const run=takeoverRun;loadHoldPromise=(async()=>{
  root.dataset.loadHold='holding';
  if(!await wait(config.operator.loadHoldMs,true)||!valid(token)||run!==takeoverRun)return false;
  root.dataset.loadHold='done';return beginTakeover(token);
 })();return loadHoldPromise;
}
function beginTakeover(token){
 if(takeoverPromise)return takeoverPromise;
 const run=++takeoverRun;takeoverPromise=(async()=>{
  if(!valid(token))return false;if(!(config.sparringTeaser&&config.operator.gongAtLoad))acceptProgram();
  if(config.loadTransition==='cinematic')return cinematicTakeover(token,run);
  // One brief signal interruption. Native keyboard/load audio remains untouched.
  const canvas=$('#training-takeover');if(canvas)canvas.hidden=true;
  root.dataset.transition='tear';$('#selection-stage').classList.add('matrix-signal-tear');setScene('launch');
  if(!await wait(140)||!valid(token)||run!==takeoverRun)return false;
  $('#selection-stage').classList.remove('matrix-signal-tear','matrix-cinematic-rupture');$('#selection-stage').hidden=true;
  root.dataset.inlineCall='false';root.dataset.handoff='off';$('#training-operator').hidden=true;
  deckReady=false;root.dataset.deck='syncing';$('#training-header').hidden=false;$('#training-footer').hidden=false;$('#training-manifest').hidden=false;setScene('manifest');renderManifest();
  for(const row of $('#training-modules').children)row.dataset.prepared='true';$('#training-program-status').textContent='PROGRAM BUS // CONNECTING';
  root.dataset.transition='reveal';if(!await wait(190)||!valid(token)||run!==takeoverRun)return false;
  root.dataset.transition='off';return true;
 })();return takeoverPromise;
}
function warpImpact(){
 const audio=window.ZionAudio,ctx=audio?.context;if(!ctx||audio.muted||ctx.state!=='running')return;
 try{const t=ctx.currentTime,o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.setValueAtTime(86,t);o.frequency.exponentialRampToValueAtTime(32,t+.25);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.045,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+.28);o.connect(g).connect(audio.destination);o.start(t);o.stop(t+.3);voices.add(o);o.onended=()=>{voices.delete(o);try{o.disconnect();g.disconnect();}catch{}};}catch{}
}
async function cinematicTakeover(token,run){
 if(config.sparringTeaser)return sparringTakeover(token,run);
 const current=()=>valid(token)&&run===takeoverRun;
 root.dataset.transition='surge';setScene('launch');window.ResidualExperience?.holdTrainingMusic?.();window.InviteSignal?.rain?.(12000);
 const surge=$('#training-takeover');surge.hidden=false;root.dataset.surgeReady=String(!!window.ProgramSurge?.start?.(surge,{duration:3000,quiet:quiet()}));
 if(!await wait(3000)||!current())return false;
 window.ProgramSurge?.stop?.();surge.hidden=true;
 $('#selection-stage').classList.remove('matrix-cinematic-rupture');$('#selection-stage').hidden=true;
 root.dataset.inlineCall='false';root.dataset.handoff='off';$('#training-operator').hidden=true;
 root.dataset.transition='void';setScene('black');warpImpact();
 if(!await wait(160)||!current())return false;
 deckReady=false;root.dataset.deck='syncing';$('#training-header').hidden=false;$('#training-footer').hidden=false;$('#training-manifest').hidden=false;
 root.dataset.transition='assemble';setScene('manifest');renderManifest();
 for(const row of $('#training-modules').children)row.dataset.prepared='true';
 $('#training-program-status').textContent='NEURAL SPACE // CONNECTING';
 startTrainingNarration(token);
 if(!await wait(1000)||!current())return false;
 root.dataset.transition='off';return true;
}
function waitForOperatorEnd(token){
 const video=$('#training-operator-video');if(operatorPlaybackEnded||state!=='operator'||video?.ended)return Promise.resolve(true);
 return new Promise(resolve=>{let done=false;const finish=ok=>{if(done)return;done=true;video.removeEventListener('ended',ended);video.removeEventListener('error',failed);mediaStops.delete(stop);resolve(ok&&valid(token));};const ended=()=>finish(true),failed=()=>finish(false),stop=()=>finish(false);video.addEventListener('ended',ended);video.addEventListener('error',failed);mediaStops.add(stop);});
}
async function sparringTakeover(token,run){
 const current=()=>valid(token)&&run===takeoverRun,film=$('#training-intro-video'),cinema=$('#training-cinema');
 let startVoice,finishPicture,pictureDone=false,started=false,voiceTime=0,voiceStartedAt=0,preserveFullShot=false,pictureWatchdog=null;
 const tankEnd=config.operator.gongAtLoad?waitForOperatorEnd(token):Promise.resolve(true);
 const revealCinema=()=>{root.dataset.transition='sparring-flash';setScene('cinema');$('#training-operator').hidden=true;$('#selection-stage').hidden=true;root.dataset.inlineCall='false';root.dataset.handoff='off';};
 const ready=new Promise(resolve=>{startVoice=resolve;}),picture=new Promise(resolve=>{finishPicture=resolve;});
 const cut=()=>{if(pictureDone)return;pictureDone=true;finishPicture(true);};
 const stopPicture=()=>cut();mediaStops.add(stopPicture);
 let lastPictureTime=-1;
 const armPictureWatchdog=()=>{if(pictureWatchdog!==null)clearTimeout(pictureWatchdog);pictureWatchdog=setTimeout(cut,2500);};
 const guard=()=>{if(film.currentTime>=5.366667){film.pause();cut();return;}if(Number.isFinite(film.currentTime)&&film.currentTime>lastPictureTime+.01){lastPictureTime=film.currentTime;armPictureWatchdog();}};
 film.addEventListener('timeupdate',guard);film.addEventListener('ended',cut);root.dataset.sparringTeaserActive='true';film.hidden=false;film.muted=true;film.defaultMuted=true;film.volume=0;film.currentTime=0;
 cinema.dataset.shot='morpheus';cinema.style.opacity='1';cinema.hidden=!!config.operator.gongAtLoad;$('#training-cinema-reaction').hidden=true;$('#training-cinema-wide').hidden=true;
 window.ResidualExperience?.holdTrainingMusic?.();
 startTrainingNarration(token,{
  onStart:()=>{started=true;voiceStartedAt=window.ZionAudio?.context?.currentTime||0;if(!config.operator.gongAtLoad)revealCinema();startVoice(true);},
  onTime:time=>{if(!current()||!Number.isFinite(time)||pictureDone)return;voiceTime=time;},
  onFinish:()=>{if(!started)startVoice(false);}
 });
 try{
  await ready;if(!current())return false;
  if(!await tankEnd||!current())return false;
  const elapsed=config.operator.gongAtLoad&&started?Math.max(voiceTime,(window.ZionAudio?.context?.currentTime||0)-voiceStartedAt):0;
  preserveFullShot=elapsed>=4.8;
  if(!config.operator.gongAtLoad&&!started)revealCinema();
  if(config.operator.gongAtLoad){revealCinema();cinema.hidden=false;root.style.setProperty('--sparring-flash-duration',Math.max(.1,1.4-elapsed)+'s');film.currentTime=preserveFullShot?0:Math.max(0,Math.min(5.366667,elapsed-.18));}
  else root.style.setProperty('--sparring-flash-duration','1.4s');
  {
   // The recorded dialogue leads this video by 180ms. White covers the seek/opening.
   // Keep the picture available even if narration could not start or Tank was delayed.
   if(!await wait(Math.max(0,180-elapsed*1000),true)||!current())return false;
   armPictureWatchdog();
   const playPicture=()=>{if(!current()||pictureDone)return;const retry=$('#training-media-play');retry.hidden=true;film.muted=true;film.defaultMuted=true;film.volume=0;const failed=()=>{if(!current()||pictureDone)return;retry.textContent='PLAY MORPHEUS';retry.hidden=false;retry.onclick=playPicture;};try{film.play()?.then(()=>{if(!current()||pictureDone){film.pause();return;}armPictureWatchdog();retry.hidden=true;}).catch(failed);}catch{failed();}};playPicture();
   if(!await wait(Math.max(0,1400-Math.max(.18,elapsed)*1000))||!current())return false;root.dataset.transition='sparring-shot';
   await picture;if(!current())return false;
  }
  syncSound();$('#selection-stage').hidden=true;$('#training-operator').hidden=true;root.dataset.inlineCall='false';root.dataset.handoff='off';
  deckReady=false;root.dataset.deck='syncing';
  // Cut on the final Morpheus frame, before the native Neo edit. Voice continues.
  film.pause();$('#training-media-play').hidden=true;cinema.hidden=true;root.dataset.sparringPan='false';
  root.dataset.sparringAssembly='true';
  $('#training-header').hidden=false;$('#training-footer').hidden=false;$('#training-manifest').hidden=false;
  root.dataset.transition='assemble';window.InviteSignal?.tick?.('A');setScene('manifest');renderManifest();for(const row of $('#training-modules').children)row.dataset.prepared='true';
  $('#training-program-status').textContent='NEURAL SPACE // CONNECTING';
  if(!await wait(2000,true)||!current())return false;
  root.dataset.sparringPan='false';root.dataset.sparringAssembly='false';root.dataset.transition='off';return true;
 }finally{mediaStops.delete(stopPicture);if(pictureWatchdog!==null)clearTimeout(pictureWatchdog);film.removeEventListener('timeupdate',guard);film.removeEventListener('ended',cut);film.pause();root.dataset.sparringAssembly='false';root.dataset.sparringPan='false';root.dataset.sparringTeaserActive='false';cinema.hidden=true;cinema.style.opacity='';cinema.style.transition='';syncSound();}
}
function startTrainingNarration(token,events={}){
 // The approved recording already contains the gong: never layer a second one.
 const begin=()=>{$('#training-briefing').disabled=true;window.InviteSignal?.stop?.();window.ResidualExperience?.duckTrainingMusic?.(.08,300);events.onStart?.();};
 if(!config.introductionAudio){window.InviteSignal?.stop?.();gongCue();window.ResidualExperience?.duckTrainingMusic?.(.48,1400);events.onFinish?.(false);return;}
 return playSound(config.introductionAudio,token,false,events.onTime||null,begin).then(ended=>{
  events.onFinish?.(ended);
  if(!valid(token))return;
  $('#training-briefing').disabled=false;
  if(!ended){window.InviteSignal?.stop?.();gongCue();}
  window.ResidualExperience?.duckTrainingMusic?.(.48,1400);
 });
}
function addCodeEffect(node){
 if(!node||Array.from(node.children).some(x=>x.dataset.codeEffect==='true'))return;
 const image=node.querySelector('img');if(!image)return;const code=document.createElement('div');code.className='character-code';code.dataset.codeEffect='true';code.setAttribute('aria-hidden','true');
 Object.assign(code.style,{maskImage:`url("${image.src}")`,maskSize:`${image.style.width||'100%'} ${image.style.height||'100%'}`,maskPosition:`${image.style.left||'0px'} ${image.style.top||'0px'}`,maskRepeat:'no-repeat',webkitMaskImage:`url("${image.src}")`,webkitMaskSize:`${image.style.width||'100%'} ${image.style.height||'100%'}`,webkitMaskPosition:`${image.style.left||'0px'} ${image.style.top||'0px'}`,webkitMaskRepeat:'no-repeat'});
 for(let i=0;i<20;i++){const col=document.createElement('span');col.style.setProperty('--code-column',String(i));col.textContent='ﾏﾄﾘｸｽ01ｱｲｳｴｵ110ﾈｵｻﾞｲｵﾝ001ﾏﾄﾘｸｽ01ｱｲｳｴｵ110ﾈｵｻﾞｲｵﾝ001';code.append(col);}node.append(code);
}
function gongCue(){
 const audio=window.ZionAudio,ctx=audio?.context;if(!ctx||audio.muted||ctx.state!=='running')return;
 try{const t=ctx.currentTime;for(const [hz,level] of [[98,.055],[149,.028],[247,.013],[397,.006]]){const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.setValueAtTime(hz,t);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(level,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+1.1);o.connect(g).connect(audio.destination);o.start(t);o.stop(t+1.12);voices.add(o);o.onended=()=>{voices.delete(o);try{o.disconnect();g.disconnect();}catch{}};}}catch{}
}
async function hearBriefing(){
 if(briefingPlaying){introSkip?.();return;}
 if(!config.briefingReplay||!config.introductionVideo||state!=='manifest'||$('#training-briefing').disabled)return;
 const token=epoch;briefingPlaying=true;updateAvailability();const button=$('#training-briefing');button.textContent='STOP BRIEFING';button.setAttribute('aria-pressed','true');window.ResidualExperience?.duckTrainingMusic?.(.035,1000);
 await playVideo($('#training-intro-video'),config.introductionVideo,token,{skippable:true});if(!valid(token))return;
 briefingPlaying=false;button.textContent='HEAR THE BRIEFING';button.setAttribute('aria-pressed','false');$('#training-media-play').hidden=true;updateAvailability();window.ResidualExperience?.duckTrainingMusic?.(.48,1400);
}
function layoutReady(){
 const host=$('#training-ready-slot'),copy=host?.children[0];if(!copy)return;
 const bounds=host.getBoundingClientRect(),scale=Math.max(.01,Math.min(bounds.width/Math.max(1,portraitWidth),bounds.height/Math.max(1,portraitHeight)));
 Object.assign(copy.style,{width:portraitWidth+'px',height:portraitHeight+'px',transform:`translateX(-50%) scale(${mirrored?-scale:scale},${scale})`});
}
function playLetterFilm(token,onFrame=()=>{}){
 const film=$('#training-letter-film');if(!film||!valid(token))return Promise.resolve(false);
 return new Promise(resolve=>{
  let done=false,frameShown=false,frameId=null;const revealFrame=()=>{if(done||frameShown)return;frameShown=true;onFrame();};const finish=ok=>{if(done)return;done=true;clearTimeout(timeout);film.removeEventListener('ended',ended);film.removeEventListener('error',failed);film.removeEventListener('playing',playing);if(frameId!==null)film.cancelVideoFrameCallback?.(frameId);mediaStops.delete(stop);film.pause();film.hidden=true;resolve(ok);};
  const ended=()=>finish(true),failed=()=>finish(false),stop=()=>finish(false),timeout=setTimeout(failed,5500);
  const playing=()=>{if(film.requestVideoFrameCallback)frameId=film.requestVideoFrameCallback(revealFrame);else revealFrame();};
  mediaStops.add(stop);film.addEventListener('ended',ended);film.addEventListener('error',failed);film.addEventListener('playing',playing);
  film.muted=true;film.defaultMuted=true;film.volume=0;film.playbackRate=1;film.defaultPlaybackRate=1;film.hidden=false;if(!film.src)film.src='./assets/crt-letter-flythrough.mp4';film.currentTime=0;
  try{film.play()?.catch(failed);}catch{failed();}
 });
}
function completionName(){return String(profile?.subject||'OPERATIVE').trim().slice(0,32).toUpperCase()||'OPERATIVE';}
async function trainingSignoff(token){
 const signal=$('#training-complete-signal');if(!signal||!archiveEnabled())return true;
 setScene('manifest');updateAvailability();root.dataset.completion='hold';signal.hidden=false;

 $('#training-archive-upload-label').textContent='ALL FOUR SKILLS // VERIFIED';$('#training-archive-percent').textContent='100%';$('#training-archive-fill').style.width='100%';$('#training-archive-meter').setAttribute('aria-valuenow','100');
 $('#training-complete-title').focus({preventScroll:true});window.InviteSignal?.tick?.('A',true);
 if(!await wait(quiet()?80:650)||!valid(token))return false;
 // Reading time is intentional, including for reduced-motion visitors.
 $('#training-letter-film')?.load?.();
 if(!await wait(2000,true)||!valid(token))return false;
 let phoneStarted=false;
 const rain=$('#training-takeover'),portal=$('#training-letter-portal'),duration=quiet()?240:3000;
 if(!quiet()&&portal&&window.CRTLetterPortal){
  portal.hidden=false;
  if(window.CRTLetterPortal.start(portal,{source:$('#training-complete-title'),duration:4000})){
   root.dataset.completion='portal';window.ResidualExperience?.holdTrainingMusic?.();window.InviteSignal?.rain?.(null);phoneStarted=true;
   if(!await wait(4000,true)||!valid(token)){window.CRTLetterPortal.stop();portal.hidden=true;return false;}
   // Keep the letter face moving until a decoded native frame is ready to replace it.
   await playLetterFilm(token,()=>{if(!valid(token))return;window.CRTLetterPortal.stop();portal.hidden=true;root.dataset.completion='film';});
   if(!valid(token))return false;
  }
  window.CRTLetterPortal.stop();portal.hidden=true;
 }
 // Initialise rain only after the movie's black end, when this canvas has its full viewport bounds.
 root.dataset.completion='dissolve';root.dataset.transition='surge';rain.hidden=false;
 window.ResidualExperience?.holdTrainingMusic?.();if(!phoneStarted)window.InviteSignal?.rain?.(null);root.dataset.surgeReady=String(!!window.ProgramSurge?.start?.(rain,{duration,quiet:quiet(),continuous:true}));
 if(!await wait(duration,true)||!valid(token))return false;
 rain.hidden=true;signal.hidden=true;root.dataset.completion='off';root.dataset.transition='off';setScene('complete');
 return true;
}
async function showCompletion(token){
 const panel=$('#training-ready'),host=$('#training-ready-slot');if(!panel||!portrait)return;
 if(!await trainingSignoff(token)||!valid(token))return;
 const copy=portrait.cloneNode(true);copy.classList.remove('training-portrait','portrait-crt');copy.classList.add('ready-portrait');host.replaceChildren(copy);
 panel.hidden=false;panel.dataset.resolved='false';$('#training-ready-message').textContent='';
 layoutReady();if(window.AfterDarkFinale){await window.AfterDarkFinale.show({panel,profile,valid:()=>valid(token),wait,quiet:quiet(),preservePhone:true,gatherCharacter:true});if(valid(token))root.dispatchEvent(new CustomEvent('zion:after-dark-ready',{detail:profile}));return;}gongCue();if(!await wait(500)||!valid(token))return;panel.dataset.resolved='true';
 const message='YOU ARE NOW READY TO ENTER THE MATRIX.';
 // Keep a stable accessible message while the visible terminal text types.
 if(quiet())$('#training-ready-message').textContent=message;
 else for(const character of message){if(!valid(token))return;$('#training-ready-message').textContent+=character;if(!await wait(17))return;}
 if(!valid(token))return;$('#training-ready-title').focus({preventScroll:true});root.dispatchEvent(new CustomEvent('zion:after-dark-ready',{detail:profile}));
}
function startUploadNoise(){
 const ctx=window.ZionAudio?.context;if(!ctx?.createBuffer||ctx.state!=='running')return ()=>{};
 let source,gain,done=false;
 const stop=()=>{if(done)return;done=true;mediaStops.delete(stop);try{source?.stop();source?.disconnect();gain?.disconnect();}catch{}if(source)voices.delete(source);};
 try{const b=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.18),ctx.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(i%1200<300?1:.15);source=ctx.createBufferSource();source.buffer=b;source.loop=true;gain=ctx.createGain();gain.gain.value=.012;source.connect(gain).connect(window.ZionAudio.destination);source.start();voices.add(source);mediaStops.add(stop);}catch{stop();}
 return stop;
}
function reset() {
  abortTakeover();window.AfterDarkFinale?.reset?.();root.dataset.sparringTeaserActive='false';root.dataset.completion='off';const signoff=$('#training-complete-signal');if(signoff)signoff.hidden=true;
  window.TrainingWireframe?.stop?.();
  const operatorSkip=$('#training-operator-skip');if(operatorSkip){operatorSkip.hidden=true;operatorSkip.onclick=null;}
  briefingPlaying=false;const briefing=$('#training-briefing');if(briefing){briefing.disabled=false;briefing.hidden=true;briefing.textContent='HEAR THE BRIEFING';briefing.setAttribute('aria-pressed','false');}const ready=$('#training-ready');if(ready)ready.hidden=true;
  const command=$('#training-command');if(command)command.hidden=true;
  const wasActive=state!=='off';epoch++;state='off';deckReady=false;root.dataset.deck='off';root.dataset.handoff='off';$('#training-operator').classList.remove('load-accepted');$('#training-load').disabled=true;stopHum();renderCommandWords(null);if(wasActive)window.ResidualExperience?.setTrainingAudio?.(false);
  for(const finish of [...pending])finish(false);pending.clear();
  for(const stop of [...mediaStops])stop();mediaStops.clear();introSkip=null;
  for(const source of voices){try{source.stop();}catch{}}voices.clear();
  for(const selector of ['#training-operator-video','#training-clip','#training-intro-video']){const video=$(selector);video.pause();video.removeAttribute('src');video.load();}
  $('#selection-stage').classList.remove('training-call-active','training-command-active','training-dissolving');root.dataset.inlineCall='false';root.hidden=true;root.dataset.phase='off';root.removeAttribute('aria-busy');
  for(const selector of ['#training-operator','#training-header','#training-footer','#training-manifest','#training-player','#training-media-play','#training-arrival-title','#training-skip','#training-cinema'])$(selector).hidden=true;
  $('#training-media-play').onclick=null;$('#training-media-play').textContent='PLAY PROGRAM';$('#training-avatar').replaceChildren();portrait=null;
  if(wasActive&&window.ResidualExperience?.state==='selecting')$('#selection-stage').hidden=false;
}
$('.stage').addEventListener('zion:identity-locked',event=>{start(event.detail).catch(()=>{reset();window.ResidualExperience?.review?.();});});
$('#training-briefing')?.addEventListener('click',()=>hearBriefing().catch(()=>{if(state!=='off'){briefingPlaying=false;updateAvailability();}}));
$('#training-replay')?.addEventListener('click',()=>{const detail=profile;start(detail).catch(()=>reset());});
$('#training-return').addEventListener('click',()=>window.ResidualExperience?.review?.());
$('#training-skip').addEventListener('click',()=>introSkip?.());
$('#training-sound').addEventListener('click',()=>$('#sound-toggle').click());
$('#training-load').addEventListener('click',()=>loadTraining().catch(()=>{if(state!=='off'){setScene('manifest');$('#training-player').hidden=true;updateAvailability();}}));
window.addEventListener('resize',()=>{layoutAvatar();layoutProgramPreviews();});window.visualViewport?.addEventListener('resize',()=>{layoutAvatar();layoutProgramPreviews();});
if(typeof ResizeObserver!=='undefined'){const observer=new ResizeObserver(layoutAvatar);observer.observe($('#training-hero-slot'));}
window.TrainingConstruct={prepare,arm,start,reset,syncSound,get state(){return state;}};
})();
