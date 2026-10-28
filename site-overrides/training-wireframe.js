/* Approved combat sprites and matching fine-grid skill sprite loops. */
(() => {
'use strict';const {setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame,cancelAnimationFrame}=window.ProgramLifecycle;const performance={now:window.ProgramLifecycle.now};
let frame=0, canvas=null, reduced=false, startTime=0, mode='combat',playbackRate=1;
const TAU=Math.PI*2;
const combatAtlas={"image":"./assets/combat-poses-fine-grid-v2.png","width":1122,"height":1402,"duration":6.4,"frames":[{"rect":[40,1,196,260],"baseline":250,"referenceHeight":236,"anchor":100.25},{"rect":[308,1,248,260],"baseline":250,"referenceHeight":236,"anchor":112.75},{"rect":[588,1,271,260],"baseline":250,"referenceHeight":236,"anchor":113.25},{"rect":[886,1,189,260],"baseline":250,"referenceHeight":236,"anchor":95.75},{"rect":[50,264,166,277],"baseline":268,"referenceHeight":256,"anchor":90.25},{"rect":[358,264,142,277],"baseline":268,"referenceHeight":256,"anchor":62.75},{"rect":[619,264,220,277],"baseline":268,"referenceHeight":256,"anchor":82.25},{"rect":[931,264,124,277],"baseline":268,"referenceHeight":256,"anchor":50.75},{"rect":[40,544,182,283],"baseline":274,"referenceHeight":255,"anchor":100.25},{"rect":[321,544,189,283],"baseline":274,"referenceHeight":255,"anchor":99.75},{"rect":[566,544,305,283],"baseline":274,"referenceHeight":255,"anchor":135.25},{"rect":[939,544,114,283],"baseline":274,"referenceHeight":255,"anchor":42.75},{"rect":[40,830,177,241],"baseline":235,"referenceHeight":255,"anchor":100.25},{"rect":[286,830,209,241],"baseline":235,"referenceHeight":255,"anchor":134.75},{"rect":[534,830,318,241],"baseline":235,"referenceHeight":255,"anchor":167.25},{"rect":[868,830,210,241],"baseline":235,"referenceHeight":255,"anchor":113.75},{"rect":[70,1074,119,326],"baseline":285,"referenceHeight":273,"anchor":70.25},{"rect":[327,1074,167,326],"baseline":285,"referenceHeight":273,"anchor":93.75},{"rect":[582,1074,253,326],"baseline":285,"referenceHeight":273,"anchor":119.25},{"rect":[902,1074,162,326],"baseline":285,"referenceHeight":273,"anchor":79.75}],"sequence":[{"frame":0,"duration":0.4},{"frame":1,"duration":0.2},{"frame":2,"duration":0.2},{"frame":3,"duration":0.2},{"frame":5,"duration":0.2},{"frame":6,"duration":0.4},{"frame":7,"duration":0.2},{"frame":4,"duration":0.2},{"frame":9,"duration":0.2},{"frame":10,"duration":0.4},{"frame":11,"duration":0.2},{"frame":8,"duration":0.2},{"frame":12,"duration":0.2},{"frame":13,"duration":0.6000000000000001},{"frame":14,"duration":0.8},{"frame":15,"duration":0.2},{"frame":16,"duration":0.2},{"frame":17,"duration":0.4},{"frame":18,"duration":0.8},{"frame":19,"duration":0.2}]};
let combatImage=null,combatLoading=null,combatReady=false;
// Cache a phosphor texture once per atlas; preserve the uploaded pose artwork.
function greenTexture(image){
 if(typeof document==='undefined'||!document.createElement)return image;
 try{const texture=document.createElement('canvas'),w=image.naturalWidth||image.width,h=image.naturalHeight||image.height;if(!w||!h)return image;texture.width=w;texture.height=h;
 const ctx=texture.getContext('2d',{willReadFrequently:true});if(!ctx?.getImageData)return image;ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,w,h),d=pixels.data;
 const light=new Uint8Array(w*h);for(let i=0;i<light.length;i++)light[i]=Math.max(d[i*4],d[i*4+1],d[i*4+2]);
 const smooth=x=>{x=Math.min(1,Math.max(0,x));return x*x*(3-2*x);},sample=(xx,yy)=>light[Math.max(0,Math.min(h-1,yy))*w+Math.max(0,Math.min(w-1,xx))];
 for(let i=0;i<light.length;i++){const x=i%w,y=Math.floor(i/w),level=light[i],near=(sample(x-2,y)+sample(x+2,y)+sample(x,y-2)+sample(x,y+2))/4;
 const line=smooth((level-62)/155),detail=.12+.88*smooth((level-near+4)/36),at=i*4;d[at+3]=Math.round(d[at+3]*line*detail*.86);d[at]=5;d[at+1]=237;d[at+2]=76;}

 ctx.putImageData(pixels,0,0);return texture;}catch{return image;}
}
function prepare(){
 if(!combatLoading&&typeof Image!=='undefined')combatLoading=new Promise(resolve=>{combatImage=new Image();combatImage.onload=()=>{combatImage=gridTexture(combatImage,1.25);combatReady=true;if(canvas&&mode==='combat'&&reduced)paint(canvas,mode,.22);resolve(true);};combatImage.onerror=()=>resolve(false);combatImage.src=combatAtlas.image;});
 return Promise.all([combatLoading||Promise.resolve(false),prepareSkills()]);
}
function combatFrame(seconds){let at=((seconds%combatAtlas.duration)+combatAtlas.duration)%combatAtlas.duration;for(const step of combatAtlas.sequence){if(at<step.duration)return step.frame;at-=step.duration;}return 0;}
function paintCombat(ctx,w,h,time,thumbnail){
 const index=combatFrame(time*2.4);
 function pose(at,alpha,offset=0){const f=combatAtlas.frames[at],[sx,sy,sw,sh]=f.rect,scale=Math.min(w*.9/sw,h*.86/sh,h*.72/f.referenceHeight);
 const dx=(w-sw*scale)/2+offset,dy=(h-sh*scale)/2;
 ctx.globalAlpha=alpha;ctx.drawImage(combatImage,sx,sy,sw,sh,dx,dy,sw*scale,sh*scale);}
 ctx.imageSmoothingEnabled=true;ctx.globalCompositeOperation='screen';ctx.filter='none';
 // One wire mesh at a time; translucent older poses would fill its open cells.
 pose(index,1);ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;ctx.filter='none';
}

// Sprite artwork matches the approved anatomical quad grid, rather than a substitute mesh.
const skillAtlas={"image":"./assets/skills-original-poses-wire-v3.png","width":1448,"height":1086,"frames":[[0,0,362,360],[362,0,362,360],[724,0,362,360],[1086,0,362,360],[0,360,362,340],[362,360,362,340],[724,360,362,340],[1086,360,362,340],[0,700,362,360],[362,700,362,360],[724,700,362,360],[1086,700,362,360]],"sequences":{"dance":[0,1,2,1,3,1],"social":[4,5,6,7,6,7],"drink":[8,9,10,9,11,8]},"blendFraction":0.22};
let skillImage=null,skillLoading=null,skillReady=false;
function gridTexture(image,levelScale=1){
 if(typeof document==='undefined'||!document.createElement)return image;
 try{const texture=document.createElement('canvas'),w=image.naturalWidth||image.width,h=image.naturalHeight||image.height;if(!w||!h)return image;texture.width=w;texture.height=h;const ctx=texture.getContext('2d',{willReadFrequently:true});if(!ctx?.getImageData)return image;ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,w,h),d=pixels.data;
 for(let i=0;i<d.length;i+=4){const level=Math.max(d[i],d[i+1],d[i+2])*levelScale;d[i+3]=Math.round(d[i+3]*Math.max(0,Math.min(1,(level-30)/190)));d[i]=5;d[i+1]=237;d[i+2]=76;}ctx.putImageData(pixels,0,0);return texture;}catch{return image;}
}
function prepareSkills(){
 if(!skillLoading&&typeof Image!=='undefined')skillLoading=new Promise(resolve=>{skillImage=new Image();skillImage.onload=()=>{skillImage=gridTexture(skillImage);skillReady=true;if(canvas&&mode!=='combat'&&reduced)paint(canvas,mode,.22);resolve(true);};skillImage.onerror=()=>{skillLoading=null;resolve(false);};skillImage.src=skillAtlas.image;});return skillLoading||Promise.resolve(false);
}
function paintSkillMesh(ctx,w,h,skill,time,thumbnail=false){
 if(!skillReady)return;
 const seq=skillAtlas.sequences[skill],position=time*2.4/(6.4/seq.length),step=Math.floor(position),index=seq[step%seq.length],previous=seq[(step+seq.length-1)%seq.length],fraction=position-step;
 // Each pose uses the same cell, camera scale and floor. Never fit individual silhouettes.
 const [sx,sy,sw,sh]=skillAtlas.frames[index],scale=Math.min(w*.9/sw,h*.86/sh),dx=(w-sw*scale)/2,dy=(h-sh*scale)/2;
 ctx.imageSmoothingEnabled=true;ctx.filter='none';ctx.globalCompositeOperation='source-over';
 const blend=thumbnail?1:Math.min(1,fraction/skillAtlas.blendFraction),ease=blend*blend*(3-2*blend);
 if(ease<1){ctx.globalAlpha=1-ease;ctx.drawImage(skillImage,...skillAtlas.frames[previous],dx,dy,sw*scale,sh*scale);}
 ctx.globalAlpha=ease;ctx.drawImage(skillImage,sx,sy,sw,sh,dx,dy,sw*scale,sh*scale);ctx.globalAlpha=1;
}

const lerp=(a,b,t)=>a+(b-a)*t;
function skillPose(skill,time=0){
 const t=time*TAU,beat=(Math.sin(t)+1)/2;
 const p={head:[0,1.78,0],neck:[0,1.55,0],hip:[0,.96,0],ls:[-.27,1.48,0],rs:[.27,1.48,0],le:[-.43,1.18,.05],re:[.43,1.18,.05],lh:[-.42,.97,.1],rh:[.42,.97,.1],lk:[-.19,.52,.05],rk:[.19,.52,.05],lf:[-.24,.04,.12],rf:[.24,.04,.12]};
 if(skill==='combat'){
  p.hip=[-.04,.87,0];p.lk=[-.39,.44,.12];p.lf=[-.61,.04,.1];p.rk=[.36,.42,-.03];p.rf=[.58,.04,-.12];
  p.le=[-.4,1.37,.26];p.lh=[-.17,1.48,.37];p.re=[lerp(.4,.7,beat),lerp(1.2,1.4,beat),.22];p.rh=[lerp(.4,1.07,beat),lerp(1.45,1.42,beat),.3];
 }else if(skill==='dance'){
  const sway=Math.sin(t)*.15;p.hip=[sway,.93+Math.sin(t*2)*.035,0];p.head=[sway*.5,1.8,0];p.neck=[sway*.5,1.57,0];
  p.ls=[-.27+sway*.5,1.48,0];p.rs=[.27+sway*.5,1.48,0];p.le=[-.47,1.45+Math.sin(t)*.2,.15];p.lh=[-.65,1.64+Math.sin(t)*.25,.1];p.re=[.46,1.45-Math.sin(t)*.2,.15];p.rh=[.65,1.64-Math.sin(t)*.25,.1];
  p.lk=[-.22+sway,.5,.1];p.rk=[.22+sway,.5,-.04];p.lf=[-.33+sway*.7,.04,.12];p.rf=[.33+sway*.7,.04,-.08];
 }else if(skill==='social'){
  const shake=Math.sin(t*2)*.045;p.re=[.48,1.22+shake*.5,.16];p.rh=[.68,1.08+shake,.35];p.lh=[-.36,1.01,.05];p.head=[0,1.78-Math.max(0,Math.sin(t))*.035,.015];
 }else if(skill==='drink'){
  p.re=[.46,1.16,.2];p.rh=[lerp(.49,.12,beat),lerp(1.33,1.66,beat),.28];
 }
 return p;
}
function stop(){if(frame)cancelAnimationFrame(frame);frame=0;canvas=null;}
function start(node,skill,quiet=false,rate=1){playbackRate=Number.isFinite(rate)?Math.max(.1,Math.min(4,rate)):1;prepare();stop();canvas=node;mode=skill;reduced=quiet;startTime=0;frame=requestAnimationFrame(draw);}
function draw(now){
 if(!canvas)return;if(!startTime)startTime=now;
 paint(canvas,mode,reduced?.22:(now-startTime)*playbackRate/2400);
 if(!reduced)frame=requestAnimationFrame(draw);else frame=0;
}
function paint(canvas,mode,time,thumbnail=false){
 const rect=canvas.getBoundingClientRect(),w=Math.max(1,rect.width),h=Math.max(1,rect.height),dpr=Math.min(window.devicePixelRatio||1,2);
 if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
 const ctx=canvas.getContext('2d');if(!ctx){stop();return;}ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);ctx.fillStyle='#020805';ctx.fillRect(0,0,w,h);
 if(['dance','social','drink'].includes(mode)){paintSkillMesh(ctx,w,h,mode,time,thumbnail);return;}
 if(mode==='combat'&&combatReady){paintCombat(ctx,w,h,time,thumbnail);return;}
 const scale=Math.min(w*(mode==='social'?.28:.34),h*.43),angle=-.23;
 const project=([x,y,z])=>[w*.5+(x*Math.cos(angle)+z*Math.sin(angle))*scale,h*.88-y*scale+z*scale*.16];
 function line(a,b,color='#05ed4c',width=.7){const u=project(a),v=project(b);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(...u);ctx.lineTo(...v);ctx.stroke();}
 for(let i=-6;i<=6;i++)line([i*.3,0,-1.1],[i*.3,0,2.2],'#18472a');for(let i=-4;i<=7;i++)line([-1.8,0,i*.3],[1.8,0,i*.3],'#18472a');
 function ring(center,rx,ry,z=0){let last;for(let j=0;j<=10;j++){const a=j/10*TAU,p=[center[0]+Math.cos(a)*rx,center[1]+Math.sin(a)*ry,center[2]+z];if(last)line(last,p);last=p;}}
 function tube(a,b,r1,r2){const n=8,axis=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],len=Math.hypot(...axis)||1,u=[axis[1]/len,-axis[0]/len,0],ul=Math.hypot(...u)||1;u[0]/=ul;u[1]/=ul;const v=[-axis[2]*u[1]/len,axis[2]*u[0]/len,(axis[0]*u[1]-axis[1]*u[0])/len];const rings=[];for(let k=0;k<3;k++){const f=k/2,c=a.map((x,i)=>lerp(x,b[i],f)),r=lerp(r1,r2,f),points=[];for(let j=0;j<n;j++){const t=j/n*TAU;points.push(c.map((x,i)=>x+r*(u[i]*Math.cos(t)+v[i]*Math.sin(t))));}rings.push(points);for(let j=0;j<n;j++)line(points[j],points[(j+1)%n]);}for(let k=0;k<2;k++)for(let j=0;j<n;j++){line(rings[k][j],rings[k+1][j]);line(rings[k][j],rings[k+1][(j+1)%n],'#05ed4c');}}
 function person(p,offset=0){if(offset)for(const k in p)p[k]=[p[k][0]+offset,p[k][1],p[k][2]];
  tube(p.hip,p.neck,.19,.27);tube(p.ls,p.le,.085,.065);tube(p.le,p.lh,.065,.045);tube(p.rs,p.re,.085,.065);tube(p.re,p.rh,.065,.045);
  tube([p.hip[0]-.13,p.hip[1],0],p.lk,.105,.075);tube(p.lk,p.lf,.075,.05);tube([p.hip[0]+.13,p.hip[1],0],p.rk,.105,.075);tube(p.rk,p.rf,.075,.05);
  for(let z=-1;z<=1;z++)ring(p.head,.13*Math.sqrt(1-z*z*.24),.19*Math.sqrt(1-z*z*.24),z*.075);
  for(const a of [0,Math.PI/2]){let last;for(let j=0;j<=10;j++){const t=j/10*TAU,pt=[p.head[0]+.13*Math.cos(t)*Math.cos(a),p.head[1]+.19*Math.sin(t),p.head[2]+.13*Math.cos(t)*Math.sin(a)];if(last)line(last,pt);last=pt;}}
  line(p.lf,[p.lf[0],.02,p.lf[2]+.16]);line(p.rf,[p.rf[0],.02,p.rf[2]+.16]);
  return p;
 }
 if(mode==='social'){
  const a=person(skillPose(mode,time),-.64),b=skillPose(mode,time);for(const k in b)b[k][0]*=-1;person(b,.64);line(a.rh,[0,1.08,.35],'#05ed4c',1.4);
 }else {const p=person(skillPose(mode,time));if(mode==='drink'){const c=p.rh;line(c,[c[0],c[1]+.13,c[2]]);ring([c[0],c[1]+.2,c[2]],.065,.07);}}
 if(!thumbnail){ctx.fillStyle='#62ff9a';ctx.font='9px monospace';ctx.fillText('MOTION STUDY / '+mode.toUpperCase(),12,18);ctx.fillStyle='#315d3d';ctx.fillText('FRAME '+String(Math.floor(time*48)%9999).padStart(4,'0')+'  //  NEURAL WRITE',12,h-12);
 }
}
function preview(node,skill,time=.22){if(node?.getContext)paint(node,skill,time,true);}
window.TrainingWireframe={start,stop,skillPose,preview,prepare,combatFrame};
prepare();
})();
