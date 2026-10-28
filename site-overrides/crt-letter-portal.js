/* Zoom into the CRT face. The code-wall interior is the supplied film excerpt. */
(()=>{'use strict';const {setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame,cancelAnimationFrame}=window.ProgramLifecycle;const performance={now:window.ProgramLifecycle.now};let active=null;
const clamp=x=>Math.max(0,Math.min(1,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
function motion(p){return{scale:Math.exp(Math.log(110)*Math.pow(clamp(p),2.15))};}
function stop(){if(!active)return;cancelAnimationFrame(active.raf);const old=active;active=null;old.ctx.clearRect(0,0,old.w,old.h);}
function start(canvas,{source,duration=4000,quiet=false}={}){
 stop();if(quiet||!Number.isFinite(duration)||duration<=0||!canvas?.getContext||!source?.getBoundingClientRect)return false;
 const ctx=canvas.getContext('2d');if(!ctx)return false;
 const bounds=canvas.getBoundingClientRect(),w=bounds.width,h=bounds.height;if(w<1||h<1)return false;
 const d=Math.min(window.devicePixelRatio||1,1.5,1400/Math.max(w,h));canvas.width=Math.round(w*d);canvas.height=Math.round(h*d);ctx.setTransform(d,0,0,d,0,0);
 const r=source.getBoundingClientRect(),css=window.getComputedStyle?.(source)||{},fontSize=parseFloat(css.fontSize)||Math.min(w*.082,68),lineHeight=parseFloat(css.lineHeight)||fontSize*1.05,spacing=parseFloat(css.letterSpacing)||0;
 const tw=Math.max(1,r.width),th=Math.max(1,r.height),face=document.createElement('canvas');face.width=Math.ceil(tw*d);face.height=Math.ceil(th*d);const f=face.getContext('2d');if(!f)return false;
 f.setTransform(d,0,0,d,0,0);f.font=`${css.fontWeight||700} ${fontSize}px ${css.fontFamily||'monospace'}`;f.textBaseline='top';f.fillStyle=css.color||'#62ff9a';f.shadowColor='#62ff9a';f.shadowBlur=8;
 let anchorX=tw*.4,anchorY=th*.7;
 const lines=(source.innerText||'TRAINING\nCOMPLETE').trim().split(/\n+/);
 lines.forEach((line,row)=>{
  const total=f.measureText(line).width+Math.max(0,line.length-1)*spacing;let x=css.textAlign==='center'?(tw-total)/2:css.textAlign==='right'?tw-total:0;const y=row*lineHeight+(lineHeight-fontSize)*.5;
  for(const ch of line){const cw=f.measureText(ch).width;if(line==='COMPLETE'&&ch==='O'){anchorX=x+cw*.5;anchorY=y+fontSize*.53;}f.fillText(ch,x,y);x+=cw+spacing;}
 });
 // The phosphor raster becomes visible as the camera reaches the letter face.
 f.shadowBlur=0;f.globalCompositeOperation='destination-out';f.fillStyle='#000';f.globalAlpha=.5;for(let y=1;y<th;y+=3)f.fillRect(0,y,tw,.65);f.globalAlpha=.2;for(let x=2;x<tw;x+=3)f.fillRect(x,0,.45,th);f.globalAlpha=1;f.globalCompositeOperation='source-over';
 const t0=performance.now(),own={ctx,w,h,raf:0};active=own;
 function draw(now){
  if(active!==own)return;const p=clamp((now-t0)/duration),m=motion(p),q=smooth(p);m.scale*=1+Math.max(0,(now-t0-duration)/duration)*.45;ctx.clearRect(0,0,w,h);ctx.globalAlpha=clamp(p/.2);ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);
  const cx=(r.left-bounds.left+anchorX)*(1-q)+w*.5*q,cy=(r.top-bounds.top+anchorY)*(1-q)+h*.5*q;
  ctx.globalAlpha=1;ctx.imageSmoothingEnabled=p<.45;ctx.drawImage(face,0,0,face.width,face.height,cx-anchorX*m.scale,cy-anchorY*m.scale,tw*m.scale,th*m.scale);ctx.imageSmoothingEnabled=true;
  own.raf=requestAnimationFrame(draw);
 }
 draw(t0);return true;
}
window.CRTLetterPortal={start,stop,motion};})();
