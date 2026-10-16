/* Site-wide per-page audio. The visitor starts with sound enabled on each
   new entry; browsers may require a gesture before actual playback can start. */
(async function mountDemiAudio(){
  if(document.getElementById('ddPageAudioButton'))return;

  // A new site visit (including a reload) always starts with sound ON. Keep a
  // visitor's manual mute only when moving between pages within this visit.
  let wanted=true;
  try{
    const referrer=document.referrer?new URL(document.referrer,location.href):null;
    const nav=performance.getEntriesByType('navigation')[0];
    const internalLink=referrer?.origin===location.origin&&nav?.type==='navigate';
    if(internalLink)wanted=sessionStorage.getItem('dd_audio_wanted')!=='0';
    else sessionStorage.removeItem('dd_audio_wanted');
  }catch{wanted=true;}

  const site=await (typeof SITE!=='undefined'?SITE:fetch('/api/site').then(r=>r.json()));
  const cfg=site?.settings?.pageAudio||{};
  const pathname=location.pathname.toLowerCase();
  const key=(typeof ddPageBackgroundKey==='function'?ddPageBackgroundKey():'') || (pathname==='/'?'home':pathname.replace(/^\//,'').replace(/\.html$/,''));
  const entry=cfg[key]&&typeof cfg[key]==='object'?cfg[key]:{};
  const src=String(entry.url||'').trim();
  // No saved MP3/WAV file for this page means no sound button at all.
  const configured=entry.enabled!==false&&/^\/uploads\/[a-zA-Z0-9._-]+\.(?:mp3|wav)$/i.test(src);
  if(!configured)return;
  // A stale/deleted upload must not leave an inert sound icon on the page.
  try{
    const response=await fetch(src,{method:'HEAD',cache:'no-store'});
    if(!response.ok||!/^audio\/(?:mpeg|wav|x-wav|wave)\b/i.test(response.headers.get('content-type')||''))return;
  }catch{return;}
  if(key==='home')document.body.classList.add('dd-audio-home');

  const button=document.createElement('button');
  button.id='ddPageAudioButton';
  button.className='dd-audio-button';
  button.type='button';
  button.innerHTML=`<svg class="dd-audio-unmuted" viewBox="0 0 32 32" aria-hidden="true"><path d="M5 12H11L18 6V26L11 20H5Z"/><path d="M22 11Q27 16 22 21"/><path d="M25 6Q34 16 25 26"/></svg><svg class="dd-audio-muted" viewBox="0 0 32 32" aria-hidden="true"><path d="M5 12H11L18 6V26L11 20H5Z"/><path d="M22 11Q27 16 22 21"/><path d="M3 29L29 3"/></svg>`;
  document.body.appendChild(button);

  // Follow the actual (scaled) SUPPORT button rather than applying transforms to the icon.
  const updatePosition=()=>{
    const support=document.getElementById('ddSupportOpen');
    if(!support)return false;
    const rect=support.getBoundingClientRect();
    if(!rect.width||!rect.height)return false;
    const width=Math.max(24,Math.min(38,rect.height*.85));
    const gap=Math.max(9,Math.min(19,rect.height*.35));
    button.style.width=`${width}px`;
    button.style.height=`${width}px`;
    button.style.right=`${Math.max(7,document.documentElement.clientWidth-rect.left+gap)}px`;
    button.style.bottom=`${Math.max(5,innerHeight-rect.bottom+(rect.height-width)/2)}px`;
    return true;
  };
  let tries=0;
  const waitForSupport=()=>{
    if(updatePosition()){
      const root=document.getElementById('ddSupportRoot');
      if(root&&window.MutationObserver){const observer=new MutationObserver(updatePosition);observer.observe(root,{attributes:true,attributeFilter:['style']})}
    }else if(++tries<160)requestAnimationFrame(waitForSupport);
  };
  waitForSupport();
  addEventListener('resize',updatePosition,{passive:true});
  window.visualViewport?.addEventListener('resize',updatePosition,{passive:true});
  document.getElementById('langToggle')?.addEventListener('click',()=>requestAnimationFrame(updatePosition));

  let playing=false;
  const language=()=>document.documentElement.lang==='ru'?'ru':'en';
  const audio=document.createElement('audio');
  const label=()=>{
    const ru=language()==='ru';
    button.classList.toggle('is-playing',wanted);
    const text=wanted?(ru?'Выключить звук':'Turn sound off'):(ru?'Включить звук':'Turn sound on');
    button.setAttribute('aria-label',text);
    button.setAttribute('title',text);
    button.setAttribute('aria-pressed',String(wanted));
  };
  label();
  audio.src=src;
  audio.loop=entry.loop!==false;
  const volume=Number(entry.volume);
  audio.volume=Math.min(1,Math.max(0,(Number.isFinite(volume)?volume:50)/100));
  audio.preload='none';
  audio.setAttribute('playsinline','');
  let lastStored=0;
  const savePosition=()=>{
    if(!playing)return;
    const t=audio.currentTime;
    if(Number.isFinite(t)&&t>=0){
      try{sessionStorage.setItem('dd_audio_position',JSON.stringify({src,time:t}))}catch{}
    }
  };
  try{
    const saved=JSON.parse(sessionStorage.getItem('dd_audio_position')||'null');
    if(saved?.src===src&&Number.isFinite(saved.time)&&saved.time>0){
      audio.addEventListener('loadedmetadata',()=>{if(saved.time<audio.duration-1)audio.currentTime=saved.time},{once:true});
    }
  }catch{}
  audio.addEventListener('timeupdate',()=>{if(audio.currentTime-lastStored>=2||audio.currentTime<lastStored){lastStored=audio.currentTime;savePosition()}});
  addEventListener('pagehide',savePosition);
  audio.addEventListener('ended',()=>{playing=false;label()});
  const tryPlay=async()=>{
    if(!wanted)return;
    try{
      await audio.play();
      playing=true;
    }catch{
      // Chrome and Safari often require a new user gesture on navigation.
      playing=false;
    }
    label();
  };
  button.addEventListener('click',()=>{
    if(wanted){
      savePosition();wanted=false;try{sessionStorage.setItem('dd_audio_wanted','0')}catch{}audio.pause();playing=false;label();
    }else{
      wanted=true;try{sessionStorage.setItem('dd_audio_wanted','1')}catch{}void tryPlay();
    }
  });
  // Audio is ON by default. Autoplay can be blocked, so start on the first allowed interaction.
  if(wanted)void tryPlay();
  const retryOnGesture=()=>{if(wanted&&!playing)void tryPlay()};
  document.addEventListener('pointerdown',retryOnGesture,{capture:true});
  document.addEventListener('keydown',retryOnGesture,{capture:true});
})();
