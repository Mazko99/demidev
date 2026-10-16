/* Site-wide per-page sound toggle. Audio never forces unmuted autoplay: the
   listener chooses sound first; after navigation we retry where permitted. */
(async function mountDemiAudio(){
  if(document.getElementById('ddPageAudioButton'))return;
  const site=await (typeof SITE!=='undefined'?SITE:fetch('/api/site').then(r=>r.json()));
  const cfg=site?.settings?.pageAudio||{};
  const pathname=location.pathname.toLowerCase();
  const key=(typeof ddPageBackgroundKey==='function'?ddPageBackgroundKey():'') || (pathname==='/'?'home':pathname.replace(/^\//,'').replace(/\.html$/,''));
  const entry=cfg[key]&&typeof cfg[key]==='object'?cfg[key]:{};
  const src=String(entry.url||'').trim();
  const configured=entry.enabled===true&&(/^(?:\/uploads\/[a-zA-Z0-9._-]+|https:\/\/\S+)$/i.test(src));
  if(key==='home')document.body.classList.add('dd-audio-home');

  const button=document.createElement('button');
  button.id='ddPageAudioButton';
  button.className='dd-audio-button';
  button.type='button';
  button.innerHTML=`<svg class="dd-audio-unmuted" viewBox="0 0 32 32" aria-hidden="true"><path d="M5 12H11L18 6V26L11 20H5Z"/><path d="M22 11Q27 16 22 21"/><path d="M25 6Q34 16 25 26"/></svg><svg class="dd-audio-muted" viewBox="0 0 32 32" aria-hidden="true"><path d="M5 12H11L18 6V26L11 20H5Z"/><path d="M22 11Q27 16 22 21"/><path d="M3 29L29 3"/></svg>`;
  button.disabled=!configured;
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
  let wanted=sessionStorage.getItem('dd_audio_wanted')==='1';
  const language=()=>document.documentElement.lang==='ru'?'ru':'en';
  const audio=configured?document.createElement('audio'):null;
  const label=()=>{
    const ru=language()==='ru';
    button.classList.toggle('is-playing',playing);
    const text=!configured?(ru?'Аудио не настроено':'No audio on this page')
      :playing?(ru?'Выключить звук':'Turn sound off'):(ru?'Включить звук':'Turn sound on');
    button.setAttribute('aria-label',text);
    button.setAttribute('title',text);
    button.setAttribute('aria-pressed',String(playing));
  };
  label();
  if(!audio)return;
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
      savePosition();wanted=false;sessionStorage.setItem('dd_audio_wanted','0');audio.pause();playing=false;label();
    }else{
      wanted=true;sessionStorage.setItem('dd_audio_wanted','1');void tryPlay();
    }
  });
  // On a new page, continue only if the visitor previously opted in.
  if(wanted){
    void tryPlay();
    const retryOnGesture=()=>{if(wanted&&!playing)void tryPlay()};
    document.addEventListener('pointerdown',retryOnGesture,{capture:true});
    document.addEventListener('keydown',retryOnGesture,{capture:true});
  }
})();
