/* Layered invitation-style rain, shared by the transition and completion screen. */
(()=>{'use strict';const {setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame,cancelAnimationFrame}=window.ProgramLifecycle;const performance={now:window.ProgramLifecycle.now};const glyphs='ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜ0123456789ZXCVBNM';let state=null;
function stop(){if(!state)return;cancelAnimationFrame(state.raf);state=null;}
function start(canvas,{duration=3000,quiet=false,ambient=false,continuous=false}={}){stop();if(!canvas?.getContext)return false;let ctx=canvas.getContext('2d');if(!ctx)return false;let w,h,streams,atlas;const t0=performance.now();state={raf:0};const own=state;let ambience=ambient?1:0,targetAmbience=ambience;
function resize(){const oldW=w,oldH=h;const r=canvas.getBoundingClientRect(),d=Math.min(window.devicePixelRatio||1,2);w=Math.max(1,r.width);h=Math.max(1,r.height);canvas.width=Math.round(w*d);canvas.height=Math.round(h*d);ctx.setTransform(d,0,0,d,0,0);const step=w<600?6.5:8,count=Math.ceil(w/step)+2;
 if(streams){for(const stream of streams){stream.x*=w/oldW;stream.head*=h/oldH;}return;}
 streams=Array.from({length:count*3},(_,i)=>{const layer=Math.floor(i/count),size=layer===2?14+Math.floor(Math.random()*3):layer===1?11+Math.floor(Math.random()*3):8+Math.floor(Math.random()*3),len=30+Math.floor(Math.random()*36);return{x:((i%count)-1)*step+(layer*step/3)+(Math.random()-.5)*3,head:Math.random()*(h+len*size),speed:(layer===2?85:layer===1?60:35)+Math.random()*120,len,size,seed:Math.floor(Math.random()*1000),rate:55+Math.random()*95,dim:(layer===2?.6:layer===1?.4:.2)+Math.random()*.22};});
 atlas=document.createElement('canvas');atlas.width=glyphs.length*22;atlas.height=72;const a=atlas.getContext('2d');a.font='16px "IBM Plex Mono",monospace';a.textAlign='center';a.textBaseline='middle';['#d7ffda','#62ff9a','#119039'].forEach((c,row)=>{a.fillStyle=c;a.shadowBlur=row===0?5:0;a.shadowColor='#62ff9a';for(let i=0;i<glyphs.length;i++)a.fillText(glyphs[i],i*22+11,row*24+12);});
}
resize();let last=t0;
own.carry=(next,{ambient:backdrop=true}={})=>{if(!next?.getContext)return false;const nextContext=next.getContext('2d');if(!nextContext)return false;const previous=canvas;canvas=next;ctx=nextContext;resize();try{ctx.drawImage(previous,0,0,previous.width,previous.height,0,0,w,h);}catch{}continuous=true;targetAmbience=backdrop?1:0;return true;};
own.sample=seed=>{const s=streams[seed%streams.length],spacing=s.size*.95,first=Math.max(0,Math.ceil((s.head-h)/spacing)),last=Math.min(s.len-1,Math.floor(s.head/spacing));if(last<first)return{x:s.x,y:((seed*139)%991)/991*h};const j=first+seed%(last-first+1);return{x:s.x,y:s.head-j*spacing};};
function draw(now){if(state!==own)return;const r=canvas.getBoundingClientRect();if(Math.abs(r.width-w)>1||Math.abs(r.height-h)>1)resize();const elapsed=now-t0,p=ambient?0:Math.min(1,elapsed/duration),dt=Math.min(40,now-last)/1000;last=now;ambience+=(targetAmbience-ambience)*Math.min(1,dt*1.3);
ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);const fade=(1-ambience*.45)*(quiet?1:Math.min(1,elapsed/160))*(continuous?1:ambient?1:1-Math.max(0,(p-.87)/.13));ctx.globalCompositeOperation='screen';
for(let i=0;i<streams.length;i++){const s=streams[i];s.head+=quiet?0:s.speed*dt*((1-ambience)*(1+p*2.8)+ambience*.32);if(s.head-s.len*s.size>h+40)s.head=-Math.random()*h*.3;const idx=Math.floor(now/s.rate)+s.seed,scale=s.size/16;
for(let j=0;j<s.len;j++){const y=s.head-j*s.size*.95;if(y<-24||y>h+24)continue;const row=j===0?0:j<5?1:2;ctx.globalAlpha=fade*s.dim*(j===0?1:Math.pow(1-j/s.len,1.15)*.94);const g=(idx+j*7+i*j)%glyphs.length;ctx.drawImage(atlas,g*22,row*24,22,24,s.x-11*scale,y-12*scale,22*scale,24*scale);}}
ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';if(!ambient&&!continuous&&p>=1){stop();return;}if(!quiet)own.raf=requestAnimationFrame(draw);
}draw(t0);return true;}
function carry(canvas,options){return state?.carry?.(canvas,options)||false;}
function sample(seed){return state?.sample?.(seed)||null;}
window.ProgramSurge={start,stop,carry,sample};})();
