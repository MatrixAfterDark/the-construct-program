(() => {
'use strict';const {setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame,cancelAnimationFrame}=window.ProgramLifecycle;const performance={now:window.ProgramLifecycle.now};
const stage=document.querySelector('.stage'), disk=document.querySelector('#disk'), prompt=document.querySelector('#insert'), readout=document.querySelector('#readout'), slider=document.querySelector('#timeline');
const video=document.querySelector('#construct-clip'),neural=document.querySelector('#neural-panel'),white=document.querySelector('#white-flash'),construct=document.querySelector('#construct-stage');let videoPrimed=false,entryBuffer=null,entryLoading=null,entrySource=null,entryGain=null,entryCompletion=null,entryResolve=null,entryRun=0,entryStartedAt=null;const terminalDisplay=document.querySelector('#terminal-display'),camera=document.querySelector('#terminal-camera'),experience=document.querySelector('#experience-frame');
const subject=((new URLSearchParams(location.search).get('name')||'').trim()||'OPERATIVE').slice(0,32).toUpperCase();
const duration=3500,stops=[[0,0],[420,.12],[1530,.53],[2710,.86],[2860,.86],[3260,1],[3500,1]];
let state='asleep',raf=0,mediaRaf=0,presentRaf=0,diskReveal=0,timers=[],sound=null,noise=null,master=null,slide=null,powerVoices=[],typingEl=null,lastTick=-1,muted=false;
const reduced=()=>!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
function later(f,ms){timers.push(setTimeout(f,ms));}
function cancel(){entryRun++;stopEntryAudio();clearTyping();cancelAnimationFrame(raf);cancelAnimationFrame(mediaRaf);cancelAnimationFrame(presentRaf);timers.forEach(clearTimeout);timers=[];if(slide){try{slide.stop();}catch{}slide=null;}powerVoices.forEach(o=>{try{o.stop();}catch{}});powerVoices=[];}
function clearTyping(){if(typingEl)typingEl.classList.remove('typing-row');typingEl=null;}
function line(text=''){const p=document.createElement('p');p.className='line';p.textContent=text;readout.append(p);return p;}
function progress(ms){for(let i=1;i<stops.length;i++){if(ms<=stops[i][0]){const [a,x]=stops[i-1],[b,y]=stops[i];return x+(y-x)*(ms-a)/(b-a)}}return 1;}
function render(ms){disk.hidden=diskReveal<=0;const s=stage.clientWidth/941,start=1422*s,end=1120*s-disk.offsetHeight;disk.style.transform=`translateY(${(end-start)*progress(ms)+274*s*(1-diskReveal)}px)`;slider.value=ms;document.querySelector('#time').value=(ms/1000).toFixed(2)+'s';stage.dataset.time=String(ms);document.querySelector('.contact-shadow').style.opacity='0';disk.style.filter=`brightness(${.94+.04*progress(ms)}) saturate(.95) drop-shadow(0 2px 2px #0007)`;}
function wakeAudio(){try{if(!sound){sound=new (window.AudioContext||window.webkitAudioContext)();master=sound.createGain();master.gain.value=.9;master.connect(sound.destination);noise=sound.createBuffer(1,Math.ceil(sound.sampleRate*.024),sound.sampleRate);const data=noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(1-i/data.length);}sound.resume().catch(()=>{});if(!entryLoading){entryLoading=fetch('./assets/jack-in-restored.m4a').then(r=>{if(!r.ok)throw new Error('Entry sound unavailable');return r.arrayBuffer();}).then(data=>sound.decodeAudioData(data)).then(buffer=>{entryBuffer=buffer;}).catch(()=>{entryLoading=null;});}}catch{sound=null;}document.querySelector('#sound-toggle').hidden=!sound;}
// Short filtered data clicks: restrained terminal chatter, no music or looping bed.
function typeTick(char){if(!sound||muted||sound.state!=='running'||/\s/.test(char))return;const t=sound.currentTime;if(t-lastTick<.032)return;lastTick=t;try{const n=sound.createBufferSource(),filter=sound.createBiquadFilter(),g=sound.createGain();n.buffer=noise;filter.type='bandpass';filter.frequency.value=1600+Math.random()*800;filter.Q.value=1.1;g.gain.setValueAtTime(.038,t);g.gain.exponentialRampToValueAtTime(.001,t+.023);n.connect(filter).connect(g).connect(master);n.start(t);n.stop(t+.024);const o=sound.createOscillator(),og=sound.createGain();o.type='square';o.frequency.value=1000+Math.random()*350;og.gain.setValueAtTime(.009,t);og.gain.exponentialRampToValueAtTime(.001,t+.012);o.connect(og).connect(master);o.start(t);o.stop(t+.013);}catch{}}
// Broadband friction and short resonant impacts give the drive a physical scale.
function driveNoise(at,duration,level,frequency,endFrequency){
 const n=sound.createBufferSource(),f=sound.createBiquadFilter(),g=sound.createGain();
 const buffer=sound.createBuffer(1,Math.ceil(sound.sampleRate*duration),sound.sampleRate),data=buffer.getChannelData(0);let low=0;
 for(let i=0;i<data.length;i++){const white=Math.random()*2-1;low=.82*low+.18*white;data[i]=.65*white+.35*low;}
 n.buffer=buffer;f.type='bandpass';f.Q.value=.8;f.frequency.setValueAtTime(frequency,at);f.frequency.linearRampToValueAtTime(endFrequency,at+duration);
 g.gain.setValueAtTime(.0001,at);g.gain.linearRampToValueAtTime(level,at+Math.min(.018,duration*.15));g.gain.exponentialRampToValueAtTime(.0001,at+duration);
 n.connect(f).connect(g).connect(master);n.start(at);n.stop(at+duration);powerVoices.push(n);return n;
}
function driveKnock(at,level,pitch){
 driveNoise(at,.045,level*.7,2200,650);
 const o=sound.createOscillator(),g=sound.createGain();o.type='triangle';o.frequency.setValueAtTime(pitch,at);o.frequency.exponentialRampToValueAtTime(pitch*.35,at+.055);
 g.gain.setValueAtTime(level,at);g.gain.exponentialRampToValueAtTime(.0001,at+.075);o.connect(g).connect(master);o.start(at);o.stop(at+.08);powerVoices.push(o);
}
function diskSlide(){if(!sound||muted||sound.state!=='running')return;try{const t=sound.currentTime;slide=driveNoise(t,1.1,.065,1700,650);driveNoise(t+.08,.65,.022,420,240);}catch{}}
function diskSeat(){if(!sound||muted||sound.state!=='running')return;try{
 const t=sound.currentTime;driveKnock(t,.105,185);driveKnock(t+.065,.052,310);
 // A small spindle motor starts after the latch, followed by three head seeks.
 driveNoise(t+.16,.95,.032,540,900);
 const motor=sound.createOscillator(),f=sound.createBiquadFilter(),g=sound.createGain();motor.type='sawtooth';motor.frequency.setValueAtTime(48,t+.13);motor.frequency.exponentialRampToValueAtTime(96,t+.37);f.type='lowpass';f.frequency.value=650;
 g.gain.setValueAtTime(.0001,t+.13);g.gain.linearRampToValueAtTime(.014,t+.3);g.gain.setValueAtTime(.012,t+.78);g.gain.exponentialRampToValueAtTime(.0001,t+1.15);
 motor.connect(f).connect(g).connect(master);motor.start(t+.13);motor.stop(t+1.16);powerVoices.push(motor);
 for(const delay of [.4,.58,.83])driveKnock(t+delay,.025,235);
 }catch{}}
function diskClick(){if(!sound||muted||sound.state!=='running')return;try{const t=sound.currentTime,o=sound.createOscillator(),g=sound.createGain();o.type='square';o.frequency.setValueAtTime(105,t);o.frequency.exponentialRampToValueAtTime(40,t+.08);g.gain.setValueAtTime(.035,t);g.gain.exponentialRampToValueAtTime(.001,t+.1);o.connect(g).connect(master);o.start(t);o.stop(t+.11);}catch{}}
function resumeOpeningWhenVisible(callback,phase){const run=entryRun;const resume=()=>{if(document.hidden)return;document.removeEventListener('visibilitychange',resume);if(state===phase&&run===entryRun)callback();};document.addEventListener('visibilitychange',resume);}
function typeRows(rows,phase,done,initialDelay=550){let row=0;function begin(){if(state!==phase)return;if(phase==='revealing'&&document.hidden){resumeOpeningWhenVisible(begin,phase);return;}if(row>=rows.length){clearTyping();done();return;}const spec=rows[row++],el=typeof spec.el==='function'?spec.el():spec.el;clearTyping();typingEl=el;el.classList.add('typing-row');el.textContent='';if(spec.className)el.classList.add(spec.className);if(reduced()){el.textContent=spec.text;spec.after?.();later(begin,spec.pause);return;}let i=0;function char(){if(state!==phase)return;if(phase==='revealing'&&document.hidden){resumeOpeningWhenVisible(char,phase);return;}el.textContent=spec.text.slice(0,++i);typeTick(spec.text[i-1]);if(i<spec.text.length)later(char,spec.speed);else {spec.after?.();later(begin,spec.pause);}}later(char,spec.speed);}later(begin,initialDelay);}
function presentDisk(){
 if(reduced()){diskReveal=1;render(0);return;}
 const start=performance.now();function tick(now){if(state!=='revealing'&&state!=='presenting'&&state!=='idle')return;const q=Math.min(1,(now-start)/2000);diskReveal=q*q*q*(q*(q*6-15)+10);render(0);if(q<1)presentRaf=requestAnimationFrame(tick);else if(state==='presenting'){state='idle';stage.classList.add('ready');prompt.disabled=false;disk.disabled=false;}}presentRaf=requestAnimationFrame(tick);
}
function opening(){state='revealing';const welcome=document.querySelector('#welcome'),programId=document.querySelector('#program-id');programId.hidden=false;prompt.hidden=false;prompt.disabled=true;disk.disabled=true;const rows=[[welcome,'WELCOME, '+subject+'.',40,650],[document.querySelector('#program-title'),'THE MATRIX AFTER DARK',30,350],[document.querySelector('#program-kind'),'CONSTRUCT PROGRAM',30,450],[document.querySelector('#action-copy'),'[ INSERT FLOPPY DISK ]',30,200]];rows.forEach(([el])=>el.textContent='');typeRows(rows.map(([el,text,speed,pause],i)=>({el,text,speed,pause,after:i===2?presentDisk:undefined})),'revealing',()=>{if(diskReveal<1){state='presenting';return;}state='idle';stage.classList.add('ready');prompt.disabled=false;disk.disabled=false;},150);}
function accepted(){
 state='reading';stage.classList.add('accepted');stage.classList.add('booting');diskSeat();readout.replaceChildren();readout.hidden=false;prompt.hidden=true;
 stage.dispatchEvent(new CustomEvent('zion:disk-inserted',{detail:{subject}}));
 const bar=document.createElement('div');bar.className='media-read';bar.setAttribute('role','progressbar');bar.setAttribute('aria-label','Reading program disk');bar.setAttribute('aria-valuemin','0');bar.setAttribute('aria-valuemax','8');bar.setAttribute('aria-valuenow','0');const blocks=[];
 for(let i=0;i<8;i++){const block=document.createElement('span');block.className='read-block';bar.append(block);blocks.push(block);}readout.append(bar);
 blocks.forEach((block,i)=>later(()=>{if(state!=='reading')return;block.classList.add('filled');bar.setAttribute('aria-valuenow',String(i+1));typeTick('█');},180+i*145));
 later(()=>{if(state!=='reading')return;state='booting';readout.replaceChildren();const rows=[['ACCESS GRANTED',30,650],['NEURAL LINK REQUIRED',36,700]];typeRows(rows.map(([text,speed,pause],i)=>({el:()=>line(),text,speed,pause,className:i===1?'jack-title':''})),'booting',()=>{stage.dispatchEvent(new CustomEvent('zion:boot-complete',{detail:{subject}}));startNeural();},80);},1600);
}
function syncNeuralSound(){const button=document.querySelector('#neural-sound');if(!button)return;button.setAttribute('aria-pressed',String(!muted));button.setAttribute('data-muted',String(muted));button.setAttribute('aria-label',muted?'Enable sound':'Mute sound');button.title=muted?'Sound off':'Sound on';}
function syncMediaSound(){syncNeuralSound();window.ResidualExperience?.syncSound();document.querySelector('#link-sound').textContent=muted?'SOUND OFF':'SOUND ON';video.muted=muted;video.volume=.85;document.querySelector('#video-sound').textContent=muted?'SOUND OFF':'SOUND ON';}
function primeConstruct(){if(videoPrimed)return;videoPrimed=true;try{video.volume=0;video.muted=muted;const p=video.play();p?.then(()=>{if(!['handoff','construct-video'].includes(state)){video.pause();video.currentTime=0;}syncMediaSound();}).catch(()=>{videoPrimed=false;});}catch{videoPrimed=false;}}
function linkSound(){if(!sound||muted||sound.state!=='running')return;diskClick();try{const t=sound.currentTime,o=sound.createOscillator(),g=sound.createGain();o.type='sine';o.frequency.setValueAtTime(135,t);o.frequency.exponentialRampToValueAtTime(480,t+1.8);g.gain.setValueAtTime(.001,t);g.gain.linearRampToValueAtTime(.027,t+.5);g.gain.exponentialRampToValueAtTime(.001,t+2);o.connect(g).connect(master);o.start(t);o.stop(t+2.05);powerVoices.push(o);}catch{}}
// Continuous activity trace, transitioning from calibration to a stable signal.
function drawNeuralActivity(ms){
 const still=reduced(),brain=document.querySelector('#cortex-brain');
 if(brain&&brain.offsetWidth){const frame=still?2:Math.floor(ms/320)%8;brain.style.backgroundPosition=`${frame%4*100/3}% ${frame<4?0:100}%`;}
 const canvas=document.querySelector('#neural-wave');if(!canvas||!canvas.offsetWidth)return;
 const ctx=canvas.getContext('2d');if(!ctx)return;
 const stable=still?1:Math.max(0,Math.min(1,(ms-3850)/1300)),clock=still?3:ms/1000,head=still?480:(ms*.16)%480;
 ctx.clearRect(0,0,480,44);
 // EEG-inspired decorative signal: phase drift, mixed rhythms and band-limited
 // irregularity. This is a fictional diagnostic, not a recorded medical trace.
 function hash(n){const q=Math.sin(n*127.1+19.3)*43758.5453;return(q-Math.floor(q))*2-1;}
 function band(t,rate){const q=t*rate,i=Math.floor(q),f=q-i,u=f*f*(3-2*f);return hash(i)*(1-u)+hash(i+1)*u;}
 function y(x){
  const t=clock-(480-x)/200,pi=Math.PI*2;
  const envelope=.72+.19*Math.sin(t*1.17)+.12*band(t,1.8);
  const alpha=(Math.sin(pi*9.3*t+.8*band(t,2.1))*3.8+Math.sin(pi*11.7*t+.5*Math.sin(t*2.3))*1.5)*envelope;
  const theta=Math.sin(pi*4.4*t+.7*band(t,.9))*2.1;
  const beta=Math.sin(pi*19.7*t+band(t,3))*1.05+band(t,57)*1.4;
  const drift=band(t,1.4)*1.3;
  const calibration=(1-stable)*(band(t,32)*5+Math.sin(pi*26.3*t)*2.2);
  return 22+18*Math.tanh((alpha+theta+beta+drift+calibration)/18);
 }
 function trace(bright){ctx.beginPath();let drawing=false;for(let x=0;x<=480;x+=2){const age=(head-x+480)%480;if(bright&&age>115){drawing=false;continue;}const yy=y(x);drawing?ctx.lineTo(x,yy):ctx.moveTo(x,yy);drawing=true;}ctx.strokeStyle=bright?'#92ffac':'#38bd6666';ctx.lineWidth=bright?1.7:1;ctx.stroke();}
 trace(false);trace(true);
}
function neuralStatus(text){const el=document.querySelector('#link-status');el.textContent='';let i=0;function char(){if(state!=='neural')return;el.textContent=text.slice(0,++i);typeTick(text[i-1]);if(i<text.length)later(char,24);}char();}
// Source mechanical impact at 3.85s; the original 6.4s flash is retained.
function neuralConnectionState(ms){
 const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};let offset;
 if(ms<900)offset=7;else if(ms<2850)offset=7-12.5*ease((ms-900)/1950);
 else if(ms<3450)offset=-5.5;else offset=-5.5-5*ease((ms-3450)/400);
 return{linked:ms>=3850,offset,frame:ms<3850?0:ms<4100?2:ms<4600?3:ms<5200?4:5};
}
function startNeural(){if(entryLoading&&!entryBuffer){state='neural-preparing';const run=entryRun;entryLoading.then(()=>{if(state==='neural-preparing'&&run===entryRun)startNeural();});return;}cancel();state='neural';entrySound();stage.classList.remove('booting');stage.classList.add('neural');prompt.hidden=true;readout.hidden=true;neural.hidden=false;syncNeuralSound();document.querySelector('#link-subject').textContent='SUBJECT: '+subject;const start=performance.now();document.querySelector('#link-purpose').textContent='';typeRows([{el:document.querySelector('#link-purpose'),text:'CONNECTING TO THE CONSTRUCT',speed:24,pause:0}],'neural',()=>{},100);let connected=false,lastStatus='';function tick(now){if(state!=='neural')return;const audioMs=typeof sound!=='undefined'&&sound&&typeof sound.currentTime==='number'&&typeof entryStartedAt==='number'?Math.max(0,(sound.currentTime-entryStartedAt)*1000):now-start;const ms=Math.min(6400,audioMs),connection=neuralConnectionState(ms);drawNeuralActivity(ms);document.querySelector('#cortex-connector').setAttribute('data-linked',String(connection.linked));document.querySelector('#diag-link').setAttribute('data-active',String(connection.linked));document.querySelector('#diag-ready').setAttribute('data-active',String(ms>=5500));const percent=Math.min(100,Math.floor(ms/64)),frame=connection.frame,sprite=document.querySelector('#link-sprite');sprite.setAttribute('data-approach',String(!connection.linked));sprite.style.setProperty('--plug-offset',connection.offset+'%');sprite.style.backgroundPosition=`${(frame%3)*50}% ${frame<3?0:100}%`;document.querySelector('#link-percent').textContent=percent+'%';document.querySelector('#link-progress').style.width=percent+'%';document.querySelector('#link-track').setAttribute('aria-valuenow',String(percent));const status=ms<900?'SIGNAL // ACQUIRING':ms<3850?'SIGNAL // CALIBRATING':ms<4600?'NEURAL LINK // STABLE':ms<5500?'CONSTRUCT // LOADING':'CONSTRUCT // READY';if(status!==lastStatus){lastStatus=status;neuralStatus(status);}if(connection.linked&&!connected){connected=true;}if(ms<6400)raf=requestAnimationFrame(tick);else beginConstruct();}raf=requestAnimationFrame(tick);}
// Entry is a single complete recording, disconnected before native dialogue.
function stopEntryAudio(){
 entryStartedAt=null;
 if(entrySource){entrySource.onended=null;try{entrySource.stop();}catch{}try{entrySource.disconnect();}catch{}entrySource=null;}
 if(entryGain){try{entryGain.disconnect();}catch{}entryGain=null;}
 const done=entryResolve;entryResolve=null;entryCompletion=null;if(done)done();
}
function entrySound(){
 stopEntryAudio();if(!sound||!entryBuffer||sound.state!=='running')return;
 try{
  const source=sound.createBufferSource(),gain=sound.createGain();source.buffer=entryBuffer;gain.gain.value=.9;
  source.connect(gain);gain.connect(master);entrySource=source;entryGain=gain;
  entryCompletion=new Promise(resolve=>{entryResolve=resolve;});
  source.onended=()=>{if(entrySource===source)stopEntryAudio();};
  entryStartedAt=sound.currentTime;source.start(entryStartedAt,0);source.stop(sound.currentTime+entryBuffer.duration);
 }catch{stopEntryAudio();}
}
function beginConstruct(){
 const run=entryRun;state='handoff';stage.classList.add('neural-bloom');white.style.transition='opacity .28s ease-out';white.style.opacity='1';video.currentTime=0;syncMediaSound();
 later(()=>{if(!['handoff','construct-video'].includes(state))return;document.querySelector('.viewport').hidden=true;terminalDisplay.hidden=true;construct.hidden=false;},300);
 later(()=>playConstructAfterEntry(run),1000);
}
async function playConstructAfterEntry(run){
 await entryCompletion;if(run!==entryRun||state!=='handoff')return;
 stopEntryAudio();powerVoices.forEach(voice=>{try{voice.stop();}catch{}});powerVoices=[];
 if(slide){try{slide.stop();}catch{}slide=null;}
 document.querySelector('#selection-music')?.pause?.();
 // Original native video and embedded dialogue; no jack-in source remains.
 try{await video.play();}catch{if(run===entryRun&&state==='handoff')playbackBlocked();}
}
function playbackBlocked(){if(state!=='handoff')return;document.querySelector('.viewport').hidden=true;construct.hidden=false;white.style.opacity='0';document.querySelector('#play-clip').hidden=false;}
// Reveal from the media clock, so buffering never exposes the black opening.
function watchVideoEnd(){
 if(!['construct-video','residual-transition'].includes(state))return;
 const remaining=video.duration-video.currentTime;
 // Some mobile players reach their final paused frame without dispatching ended.
 if(video.ended||(Number.isFinite(video.duration)&&video.duration>0&&video.paused&&Number.isFinite(remaining)&&remaining<=.08&&remaining>=-.25)){finishConstruct({type:'ended'});return;}
 if(state==='construct-video'&&Number.isFinite(remaining)&&remaining<=.65&&!reduced())finishConstruct({type:'transition'});
 // Keep observing after the visual handoff; narration must not depend on one event.
 if(['construct-video','residual-transition'].includes(state))mediaRaf=requestAnimationFrame(watchVideoEnd);
}
function revealConstruct(){if(state!=='handoff')return;state='construct-video';mediaRaf=requestAnimationFrame(watchVideoEnd);document.querySelector('#play-clip').hidden=true;function waitForPicture(){if(state!=='construct-video')return;if(video.currentTime>=1.95){white.style.transition='opacity .65s ease-out';white.style.opacity='0';}else raf=requestAnimationFrame(waitForPicture);}raf=requestAnimationFrame(waitForPicture);}
function finishConstruct(event){if(state==='residual-transition'){if(event?.type==='transition')return;if(event?.type==='click')video.pause();state='residual';if(construct.style)construct.style.zIndex='';construct.hidden=true;window.ResidualExperience?.narrate();return;}if(!['construct-video','handoff'].includes(state))return;if(construct.style)construct.style.zIndex='';const early=event?.type==='transition',instant=event?.type==='click'||reduced();if(early)document.querySelector('.video-controls').hidden=true;cancel();state=early?'residual-transition':'residual';if(instant)video.pause();white.style.opacity='0';construct.classList.remove('crt-capture','signal-collapse');document.querySelector('#signal-transition').classList.remove('active','capture-line');neural.hidden=true;document.querySelector('#residual-stage').hidden=!!window.ResidualExperience;document.querySelector('#residual-subject').textContent='SUBJECT: '+subject;stage.dispatchEvent(new CustomEvent('zion:construct-complete',{detail:{subject}}));window.ResidualExperience?.begin(subject,{instant,deferNarration:early});if(!early||!window.ResidualExperience)construct.hidden=true;}

function resetPresentation(){construct.removeAttribute?.('data-source-mark');document.querySelector('.video-controls').hidden=false;construct.style.zIndex='';document.querySelector('#skip-clip').textContent='SKIP';window.ResidualExperience?.reset();document.querySelector('.screen').append(neural);terminalDisplay.hidden=true;terminalDisplay.classList.remove('active');camera.style.transform='none';document.querySelector('#signal-transition').classList.remove('active','capture-line');video.pause();video.currentTime=0;white.style.opacity='0';construct.hidden=true;neural.hidden=true;document.querySelector('#residual-stage').hidden=true;document.querySelector('.viewport').hidden=false;document.querySelector('#play-clip').hidden=true;construct.classList.remove('tracking','signal-collapse','crt-capture');document.querySelector('#video-interference').style.opacity='0';stage.classList.remove('neural');stage.classList.remove('neural-bloom');}

function powerSound(){if(!sound||muted||sound.state!=='running')return;diskClick();try{const t=sound.currentTime,o=sound.createOscillator(),g=sound.createGain();o.type='sine';o.frequency.setValueAtTime(54,t);o.frequency.linearRampToValueAtTime(78,t+1);g.gain.setValueAtTime(.001,t);g.gain.linearRampToValueAtTime(.023,t+.3);g.gain.exponentialRampToValueAtTime(.001,t+1.4);o.connect(g).connect(master);o.start(t);o.stop(t+1.45);powerVoices.push(o);}catch{}}
function powerOn(){cancel();resetPresentation();for(const c of ['accepted','inserting','booting','jack-required','ready'])stage.classList.remove(c);diskReveal=0;render(0);state='powering';stage.classList.remove('asleep');stage.classList.add('powering');document.querySelector('#opening').hidden=true;prompt.hidden=true;prompt.disabled=true;disk.disabled=true;readout.replaceChildren();readout.hidden=false;powerSound();later(()=>{if(state!=='powering')return;stage.classList.remove('powering');const cursor=line('█');cursor.classList.add('cursor');later(()=>{if(state==='powering')reset(false);},400);},reduced()?450:1250);}
function reset(sleep=false){cancel();resetPresentation();diskReveal=0;state=sleep?'asleep':'revealing';for(const c of ['accepted','inserting','booting','jack-required','asleep','powering','ready'])stage.classList.remove(c);readout.replaceChildren();readout.hidden=true;document.querySelector('#opening').hidden=false;prompt.disabled=false;prompt.innerHTML='<span class="action"><span id="action-copy"></span></span><span class="hint" id="hint-copy"></span>';render(0);if(sleep){stage.classList.add('asleep');document.querySelector('#opening').hidden=true;prompt.hidden=false;prompt.innerHTML='<span class="action">[ POWER ON TERMINAL ] <span class="cursor">█</span></span><span class="hint">TAP HERE TO BEGIN</span>';disk.disabled=true;}else opening();}
function insert(){if(state==='asleep'){wakeAudio();powerOn();return;}if(state==='jack-required'){wakeAudio();powerOn();return;}if(state!=='idle')return;wakeAudio();primeConstruct();window.ResidualExperience?.prime();cancel();stage.classList.remove('ready');diskReveal=1;state='inserting';stage.classList.add('inserting');document.querySelector('#opening').hidden=true;disk.disabled=true;prompt.hidden=true;readout.hidden=false;readout.replaceChildren();const cursor=line('█');cursor.classList.add('cursor');const start=performance.now();let slid=false;function tick(now){const ms=Math.min(duration,now-start);render(ms);if(ms>=1530&&!slid){slid=true;diskSlide();}if(ms<duration)raf=requestAnimationFrame(tick);else{cancel();accepted();}}raf=requestAnimationFrame(tick);}
prompt.addEventListener('click',insert);disk.addEventListener('click',insert);document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.tagName!=='INPUT'&&e.target.tagName!=='BUTTON'){e.preventDefault();insert();}});
const toggle=document.querySelector('#sound-toggle');toggle.hidden=true;toggle.addEventListener('click',()=>{muted=!muted;if(master)master.gain.value=muted?0:.9;toggle.textContent=muted?'SOUND OFF':'SOUND ON';toggle.setAttribute('aria-pressed',String(!muted));syncMediaSound();if(!muted)wakeAudio();});
document.querySelector('#neural-sound').addEventListener('click',()=>toggle.click());document.querySelector('#link-sound').addEventListener('click',()=>toggle.click());video.addEventListener('playing',revealConstruct);video.addEventListener('ended',finishConstruct);video.addEventListener('error',()=>{if(state==='handoff'){white.style.opacity='0';document.querySelector('#play-clip').hidden=false;document.querySelector('#play-clip').textContent='RETRY CONSTRUCT';}else if(['construct-video','residual-transition'].includes(state)){white.style.opacity='0';construct.hidden=false;construct.style.zIndex='80';document.querySelector('.video-controls').hidden=false;document.querySelector('#skip-clip').textContent='CONTINUE TO CHARACTER';}});video.addEventListener('timeupdate',()=>{if(state!=='construct-video'||!Number.isFinite(video.duration))return;construct.setAttribute?.('data-source-mark',String(video.currentTime>=14.5));const left=video.duration-video.currentTime;if(left<2.5){construct.classList.add('tracking');document.querySelector('#video-interference').style.opacity=String(Math.min(.3,(2.5-left)/2.5*.3));}});
document.querySelector('#skip-clip').addEventListener('click',finishConstruct);document.querySelector('#play-clip').addEventListener('click',()=>{if(state!=='handoff')return;wakeAudio();syncMediaSound();playConstructAfterEntry(entryRun);});document.querySelector('#video-sound').addEventListener('click',()=>{muted=!muted;if(master)master.gain.value=muted?0:.9;syncMediaSound();toggle.textContent=muted?'SOUND OFF':'SOUND ON';toggle.setAttribute('aria-pressed',String(!muted));if(!muted)wakeAudio();});document.querySelector('#replay-sequence').addEventListener('click',()=>{wakeAudio();powerOn();});
const debug=new URLSearchParams(location.search).has('debug');document.querySelector('.debug').classList.toggle('open',debug);slider.max=duration;slider.addEventListener('input',()=>{cancel();diskReveal=1;state='scrubbing';render(+slider.value);});document.querySelector('#reset').onclick=()=>reset(false);document.querySelector('#rectangle').onclick=()=>stage.classList.toggle('rectangle');document.querySelector('#layers').onclick=()=>{const g=document.querySelector('.glass');if(g)g.hidden=!g.hidden;};new ResizeObserver(()=>render(+slider.value)).observe(stage);
window.ZionAudio={get context(){return sound;},get destination(){return master;},get muted(){return muted;},tick:typeTick};
window.ZionTerminal={insert,reset:()=>reset(false),seek(ms){cancel();diskReveal=1;state='scrubbing';render(Math.max(0,Math.min(duration,ms)));},get state(){return state;},duration};startTerminal();
async function startTerminal(){
 // Decode every physical image layer (including the disk) before first reveal.
 await Promise.all(Array.from(stage.querySelectorAll('img.layer, #disk img'),image=>{
  if(image.decode)return image.decode().catch(()=>{});
  if(image.complete)return Promise.resolve();
  return new Promise(resolve=>{image.addEventListener('load',resolve,{once:true});image.addEventListener('error',resolve,{once:true});});
 }));
 // Browsers can show their loading screen while scripts already run; wait for page load first.
 if(document.readyState!=='complete')await new Promise(resolve=>window.addEventListener('load',resolve,{once:true}));
 // Let the visible tab paint before starting the terminal's first animation.
 await new Promise(resolve=>{const visible=()=>{if(document.hidden)return;document.removeEventListener('visibilitychange',visible);requestAnimationFrame(()=>requestAnimationFrame(()=>{if(document.hidden){document.addEventListener('visibilitychange',visible);}else resolve();}));};if(document.hidden)document.addEventListener('visibilitychange',visible);else visible();});
 stage.classList.add('art-ready');
 if(new URLSearchParams(location.search).get('preview')!=='accessories')powerOn();
}

})();
