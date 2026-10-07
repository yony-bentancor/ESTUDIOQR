document.addEventListener('DOMContentLoaded',()=>{
  const stages=[...document.querySelectorAll('.eqr-stage')];
  const dots=[...document.querySelectorAll('.eqr-dots i')];
  if(!stages.length) return;

  const size=21;
  const matrix=Array.from({length:size},()=>Array(size).fill(false));

  function finder(ox,oy){
    for(let y=0;y<7;y++){
      for(let x=0;x<7;x++){
        const edge=x===0||y===0||x===6||y===6;
        const core=x>=2&&x<=4&&y>=2&&y<=4;
        if(edge||core) matrix[oy+y][ox+x]=true;
      }
    }
  }
  finder(0,0); finder(14,0); finder(0,14);

  for(let i=8;i<13;i++){
    matrix[6][i]=i%2===0;
    matrix[i][6]=i%2===0;
  }

  let seed=4471;
  const rand=()=>{
    seed=(seed*9301+49297)%233280;
    return seed/233280;
  };
  for(let y=0;y<size;y++){
    for(let x=0;x<size;x++){
      const reserved=(x<8&&y<8)||(x>12&&y<8)||(x<8&&y>12)||x===6||y===6;
      if(!reserved && rand()>.58) matrix[y][x]=true;
    }
  }

  const templates=[];
  matrix.forEach((row,y)=>{
    row.forEach((on,x)=>{
      if(on) templates.push({x,y});
    });
  });

  function mount(el,type){
    if(!el) return;
    el.innerHTML='';
    templates.forEach((p,n)=>{
      const s=document.createElement('span');
      s.className='eqr-px';
      s.dataset.x=p.x;
      s.dataset.y=p.y;
      s.dataset.n=n;
      el.appendChild(s);
    });
    position(el,type,false);
  }

  function position(el,type,animate=false){
    const px=[...el.querySelectorAll('.eqr-px')];
    const half=10;
    const base=type==='scan'?5.75:5.1;

    px.forEach((node,n)=>{
      const x=+node.dataset.x, y=+node.dataset.y;
      let tx=(x-half)*base, ty=(y-half)*base, z=0, sc=1, rot=0, op=1;

      if(type==='connect'){
        const a=(n*137.5)*Math.PI/180;
        const dist=9+(n%12)*1.7;
        tx=(x-half)*4.0 + Math.cos(a)*dist;
        ty=(y-half)*4.0 + Math.sin(a)*dist;
        z=((n%7)-3)*4;
        sc=.55+(n%5)*.06;
        rot=(n%2?-1:1)*(5+(n%8)*2);
        op=.78+(n%4)*.05;
      }

      if(type==='create'){
        tx=(x-half)*4.3;
        ty=(y-half)*3.6 + Math.sin(x*.75+y*.14)*14;
        z=Math.cos(x*.4+y*.25)*18;
        sc=.6+(Math.sin(x*.3+y*.2)+1)*.08;
        rot=Math.sin(y*.4)*13;
        op=.84;
      }

      if(type==='transform'){
        const nx=(x-half)/half;
        const ny=(y-half)/half;
        const rr=Math.min(1,Math.sqrt(nx*nx+ny*ny));
        const a=Math.atan2(ny,nx);
        const radial=rr*44;
        const sph=Math.sqrt(Math.max(0,1-Math.min(1,rr*rr)));
        tx=Math.cos(a)*radial;
        ty=Math.sin(a)*radial;
        z=sph*28;
        sc=.5+sph*.38;
        op=.72+sph*.25;
      }

      if(type==='boost'){
        const layer=(x+y)%4;
        tx=(x-half)*3.7+(layer-1.5)*7;
        ty=(y-half)*3.7-(layer-1.5)*5;
        z=(layer-1.5)*15;
        sc=.57+layer*.055;
        rot=-10+layer*6;
        op=.76+layer*.05;
      }

      node.style.transform=`translate3d(${tx}px,${ty}px,${z}px) scale(${sc}) rotate(${rot}deg)`;
      node.style.opacity=op;
      node.style.transitionDelay=animate ? `${(n%19)*5}ms` : '0ms';
    });
  }

  const configs=[
    ['[data-qr="scan"]','scan'],
    ['[data-qr="connect"]','connect'],
    ['[data-qr="create"]','create'],
    ['[data-qr="transform"]','transform'],
    ['[data-qr="boost"]','boost']
  ];

  configs.forEach(([sel,type])=>mount(document.querySelector(sel),type));

  function pulse(stage,index){
    stages.forEach((s,i)=>{
      s.classList.toggle('is-active',i===index);
      s.classList.toggle('is-playing',i===index);
    });
    dots.forEach((d,i)=>d.classList.toggle('active',i===index));

    const type=stage.dataset.stage;
    const target=stage.querySelector('[data-qr]');
    if(!target) return;

    // brief "departure" then return to its designed state
    [...target.querySelectorAll('.eqr-px')].forEach((node,n)=>{
      const a=(n*137.5)*Math.PI/180;
      const dx=Math.cos(a)*(10+(n%8)*2);
      const dy=Math.sin(a)*(10+(n%8)*2);
      const original=node.style.transform;
      node.animate([
        {transform:original, opacity:node.style.opacity || 1},
        {transform:`${original} translate3d(${dx}px,${dy}px,18px) scale(.76)`, opacity:.45},
        {transform:original, opacity:node.style.opacity || 1}
      ],{
        duration:700,
        delay:(n%13)*6,
        easing:'cubic-bezier(.2,.75,.2,1)'
      });
    });

    setTimeout(()=>stage.classList.remove('is-playing'),850);
  }

  stages.forEach((stage,index)=>{
    stage.addEventListener('mouseenter',()=>pulse(stage,index));
    stage.addEventListener('focus',()=>pulse(stage,index));
    stage.addEventListener('click',()=>pulse(stage,index));
  });

  // subtle automatic intro, once, showing the flow while keeping all 5 states visible.
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
    setTimeout(()=>{
      let i=0;
      const intro=setInterval(()=>{
        pulse(stages[i],i);
        i++;
        if(i>=stages.length){
          clearInterval(intro);
          setTimeout(()=>{
            stages.forEach((s,j)=>s.classList.toggle('is-active',j===0));
            dots.forEach((d,j)=>d.classList.toggle('active',j===0));
          },650);
        }
      },520);
    },650);
  }
});

/* PATCH 5.2 · navegación móvil Estudio QR */
(()=>{
  const initMobileNav=()=>{
    const button=document.querySelector('[data-eqr-mobile-toggle]');
    const nav=document.querySelector('[data-eqr-mobile-nav]');
    const backdrop=document.querySelector('[data-eqr-mobile-backdrop]');
    if(!button||!nav)return;

    const setOpen=(open)=>{
      nav.classList.toggle('is-mobile-open',open);
      button.classList.toggle('is-open',open);
      if(backdrop) backdrop.classList.toggle('is-open',open);
      button.setAttribute('aria-expanded',open?'true':'false');
      button.setAttribute('aria-label',open?'Cerrar menú':'Abrir menú');
      document.documentElement.classList.toggle('eqr-mobile-nav-open',open);
      document.body.classList.toggle('eqr-mobile-nav-open',open);
    };

    button.addEventListener('click',(event)=>{
      event.preventDefault();
      event.stopPropagation();
      setOpen(!nav.classList.contains('is-mobile-open'));
    });

    if(backdrop) backdrop.addEventListener('click',()=>setOpen(false));
    nav.querySelectorAll('a,button').forEach(el=>el.addEventListener('click',()=>setOpen(false)));
    document.addEventListener('keydown',event=>{if(event.key==='Escape')setOpen(false)});
    window.addEventListener('resize',()=>{if(window.innerWidth>1180)setOpen(false)});
  };

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',initMobileNav,{once:true});
  else initMobileNav();
})();
