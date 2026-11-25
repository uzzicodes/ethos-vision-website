/* Ethos / realtime optical sculpture. Native WebGL, procedural materials, no framework or post-processing. */
(() => {
  'use strict';
  const host = document.querySelector('.sculpture-wrap');
  const canvas = document.querySelector('.hero-gpu');
  if (!host || !canvas) return;
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let gl;
  try { gl = canvas.getContext('webgl', {alpha:true,antialias:true,depth:true,stencil:false,premultipliedAlpha:false,preserveDrawingBuffer:false,powerPreference:'high-performance'}); } catch {}
  if (!gl) { canvas.remove(); return; }
  const vertex = `attribute vec3 position;attribute vec3 normal;uniform mat4 model;uniform mat4 projection;uniform mat4 view;varying vec3 worldPosition;varying vec3 worldNormal;void main(){vec4 p=model*vec4(position,1.0);worldPosition=p.xyz;worldNormal=normalize(mat3(model)*normal);gl_Position=projection*view*p;}`;
  const fragment = `precision mediump float;varying vec3 worldPosition;varying vec3 worldNormal;uniform vec3 camera;uniform float time;uniform float material;
  vec3 studio(vec3 r){float h=r.y*.5+.5;vec3 c=mix(vec3(.009,.005,.023),vec3(.22,.065,.39),h);float strip=pow(max(0.0,1.0-abs(r.x*.58+r.y*.76-r.z*.29)),44.0);float side=pow(max(0.0,dot(r,normalize(vec3(-.7,.45,.2)))),18.0);float violet=pow(max(0.0,dot(r,normalize(vec3(.7,.2,-.5)))),9.0);return c+vec3(.91,.83,1.0)*strip*2.4+vec3(.62,.4,1.0)*side*1.2+vec3(.29,.018,.7)*violet*.8;}
  void main(){vec3 n=normalize(worldNormal);if(!gl_FrontFacing)n=-n;vec3 v=normalize(camera-worldPosition);vec3 r=reflect(-v,n);float fres=pow(1.0-max(dot(n,v),0.0),3.0);vec3 l=normalize(vec3(-3.0,4.0,5.0));float ndl=max(dot(n,l),0.0);float spec=pow(max(dot(reflect(-l,n),v),0.0),55.0);vec3 c=studio(r)*(0.55+fres*.7)+vec3(.08,.015,.16)*ndl+spec*vec3(.85,.68,1.0);float alpha=1.0;if(material>1.5){c=vec3(.62,.19,1.0)*(0.5+fres)+studio(r)*.6;alpha=.10+fres*.48;}else if(material>.5){c=mix(c,vec3(.45,.12,.9),.32)+spec*.25;}c=c/(vec3(1.0)+c);c=pow(c,vec3(.78));gl_FragColor=vec4(c,alpha);}`;
  function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
  let program;
  try {
    program=gl.createProgram();const vs=shader(gl.VERTEX_SHADER,vertex),fs=shader(gl.FRAGMENT_SHADER,fragment);gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
    gl.deleteShader(vs);gl.deleteShader(fs);
  } catch (error) { canvas.remove(); console.warn('Ethos optical scene uses its static fallback.',error.message); return; }
  gl.useProgram(program);
  const locations={};for(const name of ['model','projection','view','camera','time','material'])locations[name]=gl.getUniformLocation(program,name);
  const pLocation=gl.getAttribLocation(program,'position'),nLocation=gl.getAttribLocation(program,'normal');
  function mesh(vertices,normals,indices){
    const p=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,p);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);
    const n=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,n);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(normals),gl.STATIC_DRAW);
    const i=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,i);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.STATIC_DRAW);
    return {p,n,i,count:indices.length};
  }
  function torus(radius,tube,segments=88,sides=12){
    const p=[],n=[],ix=[];
    for(let i=0;i<=segments;i++){const u=i/segments*Math.PI*2,cu=Math.cos(u),su=Math.sin(u);
      for(let j=0;j<=sides;j++){const v=j/sides*Math.PI*2,cv=Math.cos(v),sv=Math.sin(v);p.push((radius+tube*cv)*cu,(radius+tube*cv)*su,tube*sv);n.push(cv*cu,cv*su,sv);}}
    for(let i=0;i<segments;i++)for(let j=0;j<sides;j++){const a=i*(sides+1)+j,b=a+sides+1;ix.push(a,b,a+1,b,b+1,a+1);}
    return mesh(p,n,ix);
  }
  function sphere(){const p=[],n=[],ix=[],a=14,b=10;for(let y=0;y<=b;y++)for(let x=0;x<=a;x++){const u=x/a*Math.PI*2,v=y/b*Math.PI,s=Math.sin(v),px=s*Math.cos(u),py=Math.cos(v),pz=s*Math.sin(u);p.push(px,py,pz);n.push(px,py,pz);}for(let y=0;y<b;y++)for(let x=0;x<a;x++){const k=y*(a+1)+x;ix.push(k,k+a+1,k+1,k+1,k+a+1,k+a+2);}return mesh(p,n,ix);}
  const chrome=torus(2.05,.19),trim=torus(2.22,.065),glass=torus(2.28,.16,80,10),orb=sphere();
  const identity=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
  function mul(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o;}
  function rx(a){const c=Math.cos(a),s=Math.sin(a);return new Float32Array([1,0,0,0,0,c,s,0,0,-s,c,0,0,0,0,1]);}
  function ry(a){const c=Math.cos(a),s=Math.sin(a);return new Float32Array([c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1]);}
  function rz(a){const c=Math.cos(a),s=Math.sin(a);return new Float32Array([c,s,0,0,-s,c,0,0,0,0,1,0,0,0,0,1]);}
  function translate(x,y,z,scale=1){const m=identity();m[0]=m[5]=m[10]=scale;m[12]=x;m[13]=y;m[14]=z;return m;}
  function perspective(aspect){const f=1/Math.tan(44*Math.PI/360),near=.1,far=30;return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]);}
  const view=translate(0,0,-6.5);gl.uniformMatrix4fv(locations.view,false,view);gl.uniform3f(locations.camera,0,0,6.5);
  gl.enable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(0,0,0,0);
  let renderedFrames=0;
  let frame=0,visible=true,last=0,phase=0,quality=1,slowFrames=0,destroyed=false;
  let pointerX=0,pointerY=0,currentX=0,currentY=0,rect=null;
  function size(){const r=canvas.getBoundingClientRect();const dpr=Math.min(devicePixelRatio||1,innerWidth<650?1.15:1.4)*quality;let w=Math.max(1,Math.round(r.width*dpr)),h=Math.max(1,Math.round(r.height*dpr));const max=innerWidth<650?420000:850000;if(w*h>max){const s=Math.sqrt(max/(w*h));w=Math.floor(w*s);h=Math.floor(h*s);}if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);gl.uniformMatrix4fv(locations.projection,false,perspective(w/h));}rect=null;}
  function drawObject(m,model,material){gl.bindBuffer(gl.ARRAY_BUFFER,m.p);gl.vertexAttribPointer(pLocation,3,gl.FLOAT,false,0,0);gl.enableVertexAttribArray(pLocation);gl.bindBuffer(gl.ARRAY_BUFFER,m.n);gl.vertexAttribPointer(nLocation,3,gl.FLOAT,false,0,0);gl.enableVertexAttribArray(nLocation);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,m.i);gl.uniformMatrix4fv(locations.model,false,model);gl.uniform1f(locations.material,material);gl.drawElements(gl.TRIANGLES,m.count,gl.UNSIGNED_SHORT,0);}
  function draw(dt=0){
    phase+=dt;currentX+=(pointerX-currentX)*Math.min(1,dt*7+.06);currentY+=(pointerY-currentY)*Math.min(1,dt*7+.06);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.uniform1f(locations.time,phase);
    const group=mul(ry(currentX*.28),rx(currentY*.19));
    gl.depthMask(false);drawObject(glass,mul(group,mul(ry(-.52+Math.sin(phase*.19)*.18),mul(rx(.45),rz(-phase*.09)))),2);gl.depthMask(true);
    drawObject(chrome,mul(group,mul(rx(.38+Math.sin(phase*.23)*.12),mul(ry(phase*.13+.25),rz(phase*.06)))),0);
    drawObject(trim,mul(group,mul(ry(.9-phase*.18),mul(rx(-.3),rz(-phase*.11)))),1);
    for(let i=0;i<5;i++){const a=phase*.17+i*Math.PI*2/5,r=2.42;const m=mul(group,translate(Math.cos(a)*r,Math.sin(a)*r,Math.sin(a*2)*.4,.055+(i%2)*.025));drawObject(orb,m,i%2);}
    if(++renderedFrames%30===0)canvas.dataset.frame=String(renderedFrames);
  }
  function allowed(){return !destroyed&&visible&&!document.hidden&&!root.classList.contains('motion-off')&&!reduced.matches&&!document.querySelector('.cinema').open;}
  function loop(now){frame=0;if(!allowed()){last=0;return;}frame=requestAnimationFrame(loop);const cap=innerWidth<650?30:60;if(last&&now-last<1000/cap-1)return;const gap=last?now-last:1000/cap;last=now;
    if(gap>1000/cap*1.65&&gap<180)slowFrames++;else slowFrames=Math.max(0,slowFrames-1);
    if(slowFrames>18&&quality>.65){quality=.65;slowFrames=0;size();canvas.dataset.quality='adaptive';}
    draw(Math.min(gap/1000,.05));
  }
  function wake(){if(allowed()){if(!frame){last=0;frame=requestAnimationFrame(loop);}}else{cancelAnimationFrame(frame);frame=0;last=0;}canvas.dataset.running=String(allowed());}
  host.addEventListener('pointerenter',()=>{rect=host.getBoundingClientRect();},{passive:true});
  host.addEventListener('pointermove',event=>{if(!rect)rect=host.getBoundingClientRect();pointerX=((event.clientX-rect.left)/rect.width-.5)*2;pointerY=((event.clientY-rect.top)/rect.height-.5)*2;},{passive:true});
  host.addEventListener('pointerleave',()=>{pointerX=pointerY=0;rect=null;},{passive:true});
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;wake();},{rootMargin:'100px',threshold:0}).observe(host);
  new MutationObserver(wake).observe(root,{attributes:true,attributeFilter:['class']});
  new MutationObserver(wake).observe(document.querySelector('.cinema'),{attributes:true,attributeFilter:['open']});
  new ResizeObserver(()=>{size();if(!allowed())draw();}).observe(host);
  document.addEventListener('visibilitychange',wake);reduced.addEventListener('change',wake);
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();destroyed=true;cancelAnimationFrame(frame);root.classList.remove('gpu-ready');canvas.hidden=true;});
  addEventListener('pagehide',()=>{cancelAnimationFrame(frame);frame=0;});
  addEventListener('pageshow',wake);
  size();draw();root.classList.add('gpu-ready');canvas.dataset.renderer='webgl';canvas.dataset.quality='balanced';wake();
})();
