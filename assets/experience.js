/* Ethos / motion direction. Browser-native choreography with one managed reel decoder. */
(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const root=document.documentElement, hero=$('.hero'), header=$('.header'), cinema=$('.cinema');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'), fine=matchMedia('(hover:hover) and (pointer:fine)');
  const animations=new Set();
  const moving=new Set();
  let heroVisible=true,reelVisible=false,scrollFrame=0,compact=false;
  function motion(){return !root.classList.contains('motion-off')&&!reduced.matches;}
  function animate(el,frames,options){
    if(!motion()||!el.animate)return;
    const a=el.animate(frames,{duration:900,easing:'cubic-bezier(.2,.75,.2,1)',fill:'both',...options});
    animations.add(a);a.onfinish=()=>{animations.delete(a);a.cancel();};a.oncancel=()=>animations.delete(a);
    return a;
  }
  function splitText(el){
    const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);const nodes=[];
    while(walker.nextNode())if(walker.currentNode.textContent.trim())nodes.push(walker.currentNode);
    for(const node of nodes){const fragment=document.createDocumentFragment();for(const word of node.textContent.split(/(\s+)/)){
      if(!word.trim()){fragment.append(document.createTextNode(word));continue;}
      const clip=document.createElement('span'),inner=document.createElement('span');clip.className='word-clip';inner.className='word-motion';inner.textContent=word;clip.append(inner);fragment.append(clip);
    }node.replaceWith(fragment);}
  }
  $$('main h2:not(.sr-only)').forEach(splitText);
  root.classList.add('experience-ready');
  function intro(){
    $$('.hero-title-word').forEach((el,i)=>animate(el,[{transform:'translate3d(0,110%,0) rotateZ(3deg)',opacity:.2},{transform:'translate3d(0,0,0) rotateZ(0deg)',opacity:1}],{duration:1150,delay:120+i*130}));
    $$('.hero-copy>.eyebrow,.hero-copy>.copy,.hero-actions,.hero-topline').forEach((el,i)=>animate(el,[{opacity:0,transform:'translate3d(0,20px,0)'},{opacity:1,transform:'translate3d(0,0,0)'}],{duration:800,delay:180+i*100}));
  }
  const reveal=new IntersectionObserver(entries=>entries.forEach(entry=>{
    if(!entry.isIntersecting)return;reveal.unobserve(entry.target);
    const words=$$('.word-motion',entry.target);
    if(words.length){words.forEach((word,i)=>animate(word,[{transform:'translate3d(0,108%,0) rotateZ(2deg)'},{transform:'translate3d(0,0,0) rotateZ(0deg)'}],{duration:950,delay:Math.min(i*35,280)}));}
    else animate(entry.target,[{opacity:.05,translate:'0 32px'},{opacity:1,translate:'0 0'}],{duration:900});
  }),{threshold:.12,rootMargin:'0px 0px -35px 0px'});
  $$('main h2:not(.sr-only),.partner-card,.process-step,.service-art,.studio-note>.reveal,.footer-display').forEach(el=>reveal.observe(el));
  const filmReveal=new IntersectionObserver(entries=>entries.forEach(entry=>{
    if(!entry.isIntersecting)return;filmReveal.unobserve(entry.target);
    const image=$('.film-media>img',entry.target),info=$('.film-bottom',entry.target);
    animate(image,[{transform:'scale(1.12)',opacity:.35},{transform:'scale(1)',opacity:1}],{duration:1250});
    animate(info,[{translate:'0 24px',opacity:0},{translate:'0 0',opacity:1}],{duration:950,delay:130});
  }),{threshold:.15});
  $$('.film').forEach(el=>filmReveal.observe(el));

  // CSS handles repeatable motion; its timeline pauses outside the viewport.
  const loopObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{
    if(entry.isIntersecting)moving.add(entry.target);else moving.delete(entry.target);
    entry.target.classList.toggle('is-playing',entry.isIntersecting&&motion()&&!document.hidden);
  }),{threshold:0,rootMargin:'50px'});
  $$('.motion-tape,.reel-orbit').forEach(el=>loopObserver.observe(el));
  new IntersectionObserver(entries=>{heroVisible=entries[0].isIntersecting;hero.classList.toggle('scene-awake',heroVisible&&motion()&&!document.hidden);},{threshold:.02}).observe(hero);

  // The studio reel is a real edit of supplied films. It loads only when this panel is seen.
  const reel=$('.reel-ambient'),reelStage=$('.reel-stage');
  let pendingReel=null;
  function stopReel(release=false){if(!reel)return;reel.pause();reel.classList.remove('is-playing');if(release&&reel.getAttribute('src')){reel.removeAttribute('src');reel.load();}}
  function startReel(){
    if(!reel||!reelVisible||!motion()||document.hidden||cinema.open||navigator.connection?.saveData||navigator.connection?.effectiveType==='2g')return;
    if(!reel.getAttribute('src'))reel.src=reel.dataset.src;
    if(pendingReel||!reel.paused)return;
    const request=reel.play();pendingReel=request;
    if(request)request.then(()=>{if(reelVisible&&motion()&&!document.hidden&&!cinema.open)reel.classList.add('is-playing');else stopReel();}).catch(()=>{}).finally(()=>{if(pendingReel===request)pendingReel=null;});
  }
  if(reelStage)new IntersectionObserver(entries=>{reelVisible=entries[0].isIntersecting;if(reelVisible)startReel();else stopReel(true);},{threshold:.3}).observe(reelStage);
  if(reelStage)reelStage.addEventListener('pointerenter',startReel,{passive:true});
  $$('.film').forEach(film=>film.addEventListener('pointerenter',()=>stopReel(true),{passive:true}));

  // One scroll callback updates only visible elements. Native scrolling remains intact.
  function scroll(){
    scrollFrame=0;const next=scrollY>100;if(next!==compact){compact=next;header.classList.toggle('is-compact',compact);}
    if(!motion())return;
    if(heroVisible&&!root.classList.contains('lens-ready')){const p=Math.max(0,Math.min(1,scrollY/(hero.offsetHeight||1)));$('.hero-copy').style.opacity=String(1-p*.85);$('.hero-copy').style.translate=`0 ${p*45}px`;}
    if(reelVisible&&innerWidth>650){const r=reelStage.getBoundingClientRect(),p=Math.max(0,Math.min(1,(innerHeight-r.top)/(innerHeight+r.height)));reelStage.style.setProperty('--reel-scale',String(.92+p*.08));}
  }
  addEventListener('scroll',()=>{if(!scrollFrame)scrollFrame=requestAnimationFrame(scroll);},{passive:true});
  addEventListener('resize',()=>{if(!scrollFrame)scrollFrame=requestAnimationFrame(scroll);});

  // Magnetic buttons are independent of the native optical cursor.
  $$('.hero-actions .button,.contact .button,.reel-play').forEach(button=>{
    let rect=null,frame=0,x=0,y=0;
    const reset=()=>{cancelAnimationFrame(frame);frame=0;rect=null;button.style.removeProperty('translate');button.classList.remove('is-magnetic');};
    button.addEventListener('pointerenter',()=>{if(motion()&&fine.matches)rect=button.getBoundingClientRect();},{passive:true});
    button.addEventListener('pointermove',event=>{
      if(!motion()||!fine.matches)return;x=event.clientX;y=event.clientY;if(frame)return;
      frame=requestAnimationFrame(()=>{frame=0;const r=rect||(rect=button.getBoundingClientRect());button.classList.add('is-magnetic');button.style.translate=`${((x-r.left)/r.width-.5)*11}px ${((y-r.top)/r.height-.5)*9}px`;});
    },{passive:true});
    button.addEventListener('pointerleave',reset);button.addEventListener('blur',reset);
    new MutationObserver(()=>{if(!motion())reset();}).observe(root,{attributes:true,attributeFilter:['class']});
  });

  // Optional, original studio UI sounds. Never plays before the visitor enables it.
  const soundButton=$('.sound-toggle');let soundOn=false,audio=null,noise=null;
  function clickSound(){
    if(!soundOn||!audio||document.hidden)return;
    if(audio.state==='suspended')audio.resume().catch(()=>{});
    const source=audio.createBufferSource(),filter=audio.createBiquadFilter(),gain=audio.createGain();source.buffer=noise;filter.type='bandpass';filter.frequency.value=1900;filter.Q.value=.7;const now=audio.currentTime;gain.gain.setValueAtTime(.025,now);gain.gain.exponentialRampToValueAtTime(.0001,now+.055);source.connect(filter);filter.connect(gain);gain.connect(audio.destination);source.start(now);source.stop(now+.06);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
  }
  soundButton?.addEventListener('click',()=>{
    try{
      if(!audio){const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return;audio=new Context();noise=audio.createBuffer(1,Math.ceil(audio.sampleRate*.07),audio.sampleRate);const data=noise.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(1-i/data.length);}
      soundOn=!soundOn;soundButton.setAttribute('aria-pressed',String(soundOn));$('.sound-label',soundButton).textContent=soundOn?'Sound on':'Sound off';soundButton.setAttribute('aria-label',soundOn?'Mute studio interaction sounds':'Enable studio interaction sounds');if(soundOn){audio.resume().catch(()=>{});clickSound();}else audio.suspend();
    }catch{soundOn=false;soundButton.disabled=true;}
  });
  document.addEventListener('click',event=>{if(!event.target.closest('.sound-toggle')&&event.target.closest('a,button,summary'))clickSound();});

  function refresh(){
    hero.classList.toggle('scene-awake',heroVisible&&motion()&&!document.hidden&&!cinema.open);
    moving.forEach(el=>el.classList.toggle('is-playing',motion()&&!document.hidden&&!cinema.open));
    if(!motion()){
      animations.forEach(a=>a.cancel());$('.hero-copy').style.removeProperty('opacity');$('.hero-copy').style.removeProperty('translate');reelStage?.style.removeProperty('--reel-scale');stopReel(true);
    }else if(cinema.open||document.hidden)stopReel();else startReel();
    if(document.hidden){animations.forEach(a=>a.pause());if(audio)audio.suspend();}else{animations.forEach(a=>{if(a.playState==='paused')a.play();});if(audio&&soundOn)audio.resume().catch(()=>{});}
  }
  new MutationObserver(refresh).observe(root,{attributes:true,attributeFilter:['class']});
  new MutationObserver(refresh).observe(cinema,{attributes:true,attributeFilter:['open']});
  document.addEventListener('visibilitychange',refresh);reduced.addEventListener('change',refresh);
  addEventListener('pagehide',()=>{cancelAnimationFrame(scrollFrame);stopReel(true);if(audio)audio.suspend();});
  intro();refresh();scroll();
})();
