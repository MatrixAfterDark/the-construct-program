/* The selected portrait supplies the silhouette: no substitute character artwork. */
(()=>{'use strict';const {setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame,cancelAnimationFrame}=window.ProgramLifecycle;const performance={now:window.ProgramLifecycle.now};let active=null;const glyphs='ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿ0123456789';
function stop(){if(active)cancelAnimationFrame(active.raf);active=null;}
function revealFront(p,top,bottom,column=0){const t=Math.max(0,Math.min(1,(p-.06)/.58)),e=t*t*(3-2*t);return top-18+(bottom-top+36)*e+Math.sin(column*1.73)*8*e*(1-e)*4;}
// Each vertical stream has its own speed, phase and luminous head. Glyph identity
// travels with the stream, so settled code scrolls rather than flickering in place.
function flowAt(x,y,now,step,height){
 const column=Math.round(x/step),speed=18+(column*37%53),travel=now/1000*speed+column*13;
 const shift=((travel%step)+step)%step,row=Math.floor(y/step-travel/step);
 const phase=((y-travel)%(height+72)+(height+72))%(height+72),head=Math.exp(-phase/24);
 const shimmer=.5+.5*Math.sin(now/(310+column%7*73)+column*.91);
 return{shift,index:((row*17+column*31)%glyphs.length+glyphs.length)%glyphs.length,glow:head,pulse:shimmer};
}
function start(canvas,slot,{duration=6000,quiet=false}={}){
 stop();if(!canvas?.getContext||!slot)return false;const ctx=canvas.getContext('2d');if(!ctx)return false;
 const r=canvas.getBoundingClientRect(),w=Math.max(1,r.width),h=Math.max(1,r.height),dpr=Math.min(window.devicePixelRatio||1,2),own={raf:0,top:0,bottom:h,start:performance.now()};active=own;slot.style?.setProperty?.('--character-resolve','0');canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
 const portrait=slot.querySelector('.ready-portrait'),image=portrait?.querySelector('img');
 function build(mask){if(active!==own||!portrait||!image)return;try{
  const pr=portrait.getBoundingClientRect(),scale=pr.width/(parseFloat(portrait.style.width)||pr.width),field=document.createElement('canvas');field.width=Math.ceil(w);field.height=Math.ceil(h);const c=field.getContext('2d',{willReadFrequently:true});
  const mirror=/scale\(-/.test(portrait.style.transform);c.save();c.translate(pr.left-r.left+(mirror?pr.width:0),pr.top-r.top);if(mirror)c.scale(-1,1);c.beginPath();c.rect(0,0,pr.width,pr.height);c.clip();c.drawImage(image,(parseFloat(image.style.left)||0)*scale,(parseFloat(image.style.top)||0)*scale,(parseFloat(image.style.width)||image.naturalWidth)*scale,(parseFloat(image.style.height)||image.naturalHeight)*scale);
  if(mask){c.globalCompositeOperation='destination-in';const full=portrait.style.maskSize?.includes('%'),size=(portrait.style.maskSize||'').split(' '),pos=(portrait.style.maskPosition||'').split(' ');c.drawImage(mask,full?0:(parseFloat(pos[0])||0)*scale,full?0:(parseFloat(pos[1])||0)*scale,full?pr.width:(parseFloat(size[0])||pr.width)*scale,full?pr.height:(parseFloat(size[1])||pr.height)*scale);}
  c.restore();const pixels=c.getImageData(0,0,field.width,field.height).data;let top=h,bottom=0;
  for(let y=0;y<h;y+=3)for(let x=0;x<w;x+=3){const i=(y*field.width+x)*4;if(pixels[i+3]<55)continue;top=Math.min(top,y);bottom=Math.max(bottom,y);}
  own.top=top<h?top:0;own.bottom=bottom||h;own.mask=field;own.flow=document.createElement('canvas');own.flow.width=field.width;own.flow.height=field.height;
 }catch{own.mask=null;}}

 const maskUrl=portrait?.style.maskImage?.match(/^url\(["']?(.*?)["']?\)$/)?.[1];
 if(maskUrl){const mask=new Image();mask.onload=()=>build(mask);mask.onerror=()=>build(null);mask.src=maskUrl;}else build(null);
 function flowingCode(now,opacity,p){
  if(!own.flow||!own.mask||opacity<=0)return;const ink=own.flow.getContext('2d');if(!ink?.drawImage)return;
  ink.clearRect(0,0,w,h);ink.globalCompositeOperation='source-over';const gap=w<500?4.5:5.5,line=6.5;
  ink.font=(w<500?'6':'7')+'px "IBM Plex Mono",monospace';ink.textAlign='center';ink.textBaseline='middle';
  for(let x=2,col=0;x<w;x+=gap,col++){
   const speed=42+col*37%65,travel=now/1000*speed+col*17,offset=travel%line,period=100+col%5*21;
   ink.save();ink.beginPath();ink.rect(x-gap/2,0,gap,Math.max(0,revealFront(p,own.top,own.bottom,col)));ink.clip();
   for(let y=-line;y<h+line;y+=line){const py=y+offset,row=Math.floor(y/line)-Math.floor(travel/line),phase=((py-travel)%period+period)%period,head=Math.exp(-phase/22);
    ink.globalAlpha=.34+head*.66;ink.fillStyle=head>.75?'#c8ffdb':head>.28?'#62ff9a':'#05ed4c';ink.fillText(glyphs[((row*17+col*31)%glyphs.length+glyphs.length)%glyphs.length],x,py);
   }
   ink.restore();
  }
  ink.globalAlpha=1;ink.globalCompositeOperation='destination-in';ink.drawImage(own.mask,0,0);ink.globalCompositeOperation='source-over';ctx.globalAlpha=opacity;ctx.drawImage(own.flow,0,0,w,h);ctx.globalAlpha=1;
 }
 function draw(now){
  if(active!==own)return;const p=quiet?1:Math.min(1,(now-own.start)/duration),resolve=Math.max(0,Math.min(1,(p-.82)/.18));
  slot.style?.setProperty?.('--character-resolve',String(resolve));ctx.clearRect(0,0,w,h);
  // Only falling streams are drawn. No particles are pulled from the sides or below.
  flowingCode(quiet?0:now,Math.min(1,p*10)*(1-resolve),p);
  if(p<1)own.raf=requestAnimationFrame(draw);else own.raf=0;
 }
 own.raf=requestAnimationFrame(draw);return true;
}
window.FinalCharacterCode={start,stop,revealFront,flowAt};})();
