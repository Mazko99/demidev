(async()=>{
  await renderChrome();
  const site=await SITE;
  const loginArt=$('#loginArt');
  const customLoginBackground=window.ddResolvedPageBackground?window.ddResolvedPageBackground(site.settings||{},'login'):'';
  if(loginArt){
    const bundledLoginArt='/assets/images/login-art.png';
    loginArt.alt='';
    loginArt.hidden=true;
    if(!customLoginBackground){
      const configuredLoginArt=String(site.settings?.loginArt||bundledLoginArt).trim()||bundledLoginArt;
      let usingFallback=configuredLoginArt===bundledLoginArt;
      const reveal=()=>{
        loginArt.hidden=false;
      };
      loginArt.addEventListener('load',reveal,{once:true});
      loginArt.addEventListener('error',()=>{
        /* Keep the configured URL untouched in settings. If that file is temporarily
           unavailable, render the bundled artwork instead of flashing a broken image. */
        if(!usingFallback){
          usingFallback=true;
          loginArt.src=bundledLoginArt;
        }else{
          loginArt.hidden=true;
        }
      });
      loginArt.src=configuredLoginArt;
      if(loginArt.complete&&loginArt.naturalWidth)reveal();
    }
  }

  // Never expose or prefill the administrator credentials on the customer page.
  const clearAdminAutofill=()=>{
    [$('#registerForm'),$('#loginForm')].forEach(form=>{
      if(!form)return;const email=form.querySelector('input[type=email]'),password=form.querySelector('input[type=password]');
      if(String(email?.value||'').trim().toLowerCase()==='admin@demideville.local'){email.value='';if(password)password.value=''}
    });
  };
  clearAdminAutofill();
  setTimeout(clearAdminAutofill,120);
  setTimeout(clearAdminAutofill,700);

  /* Header and support are provided by renderChrome() in common.js. */

  /* Header and support are provided by renderChrome() in common.js. */

  const msg=$('#authMessage');
  const show=(t,ok=false)=>{
    msg.textContent=t;
    msg.classList.add('show');
    msg.style.color=ok?'#065c24':'#8a0808';
  };
  const storeToken=(token,remember)=>{
    localStorage.removeItem('dd_token');
    sessionStorage.removeItem('dd_token');
    (remember?localStorage:sessionStorage).setItem('dd_token',token);
  };

  try{
    if(getToken()){
      const r=await fetch('/api/auth/me',{headers:authHeaders()});
      if(r.ok){
        const {user}=await r.json();
        showUser(user);
      }else{
        localStorage.removeItem('dd_token');
        sessionStorage.removeItem('dd_token');
      }
    }
  }catch{}

  $('#registerForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const f=new FormData(e.target);
    const body={
      name:f.get('name'),
      email:f.get('email'),
      password:f.get('password'),
      newsletter:!!f.get('newsletter')
    };
    const r=await fetch('/api/auth/register',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(body)
    });
    const d=await r.json();
    if(!r.ok)return show(d.error||'Registration failed');
    storeToken(d.token,!!f.get('remember'));
    show('Account created.',true);
    if(sessionStorage.getItem('dd_checkout_return')==='1'){
      sessionStorage.removeItem('dd_checkout_return');location.assign('/checkout.html');return;
    }
    showUser(d.user);
  });

  $('#loginForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const f=new FormData(e.target);
    const r=await fetch('/api/auth/login',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({email:f.get('email'),password:f.get('password')})
    });
    const d=await r.json();
    if(!r.ok)return show(d.error||'Login failed');
    storeToken(d.token,!!f.get('remember'));
    show('Logged in.',true);
    if(sessionStorage.getItem('dd_checkout_return')==='1'){
      sessionStorage.removeItem('dd_checkout_return');location.assign('/checkout.html');return;
    }
    showUser(d.user);
  });

  function showUser(user){
    $('.auth-stack').style.display='none';
    const p=$('#userPanel');
    p.style.display='block';
    p.innerHTML=`<h2>${esc(user.name)}</h2><p>${esc(user.email)}</p><p><a class="btn-black" style="display:flex;align-items:center;justify-content:center;text-decoration:none" href="${user.role==='admin'?'/admin':'/account.html'}">${user.role==='admin'?'OPEN ADMIN PANEL':'OPEN ACCOUNT'}</a></p><button class="btn-black" id="logoutBtn">Logout</button>`;
    $('#logoutBtn').onclick=async()=>{
      await fetch('/api/auth/logout',{method:'POST',headers:authHeaders()});
      localStorage.removeItem('dd_token');
      sessionStorage.removeItem('dd_token');
      location.reload();
    };
  }
})();

