// ===================== MOTION PREFERENCE =====================
// Respected everywhere below: continuous rAF-driven motion (hero scene,
// parallax, magnetic buttons, tilt) is skipped entirely when the user has
// asked the OS for reduced motion. CSS handles the reveal/opacity side;
// this handles the JS-driven transform loops CSS can't reach.
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ===================== PAGE-LOAD CURTAIN =====================
// A brief, quiet unveil instead of content just popping in — the hero's
// reveal animations already run underneath while the curtain is up, so
// lifting it uncovers a scene that's already mid-motion, not a blank page.
(function initLoader(){
  const loader = document.getElementById('loader');
  const clear = ()=>{
    document.body.classList.remove('loading');
    if(loader) loader.classList.add('done');
  };
  if(!loader){ clear(); return; }
  const holdTime = prefersReducedMotion ? 0 : 700;
  if(document.readyState === 'complete'){
    setTimeout(clear, holdTime);
  } else {
    window.addEventListener('load', ()=> setTimeout(clear, holdTime));
  }
  // never let a slow asset trap someone behind the curtain
  setTimeout(clear, 4000);
})();

// ===================== NAVBAR SCROLL STATE =====================
const navbar = document.getElementById('navbar');
const progressBar = document.getElementById('progressBar');

// ===================== MOBILE NAV DRAWER =====================
// Below the 768px breakpoint .nav-links becomes an off-canvas drawer;
// this just toggles it open/closed and keeps focus/scroll sane while open.
// No-op above that breakpoint since .nav-toggle stays display:none there.
(function initMobileNav(){
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');
  const navScrim = document.getElementById('navScrim');
  if(!navToggle || !navLinks) return;

  function closeNav(){
    navLinks.classList.remove('open');
    navToggle.classList.remove('active');
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.setAttribute('aria-label', 'Open menu');
    if(navScrim) navScrim.classList.remove('open');
    document.body.classList.remove('nav-open');
  }
  function openNav(){
    navLinks.classList.add('open');
    navToggle.classList.add('active');
    navToggle.setAttribute('aria-expanded', 'true');
    navToggle.setAttribute('aria-label', 'Close menu');
    if(navScrim) navScrim.classList.add('open');
    document.body.classList.add('nav-open');
  }

  navToggle.addEventListener('click', ()=>{
    navLinks.classList.contains('open') ? closeNav() : openNav();
  });
  navLinks.querySelectorAll('a').forEach(link=>{
    link.addEventListener('click', closeNav);
  });
  if(navScrim) navScrim.addEventListener('click', closeNav);
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape') closeNav();
  });
  // if the viewport is resized past the drawer breakpoint while open, reset
  window.addEventListener('resize', ()=>{
    if(window.innerWidth > 768) closeNav();
  }, { passive:true });
})();

function onScroll(){
  const scrollY = window.scrollY;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  const progress = docHeight > 0 ? (scrollY / docHeight) * 100 : 0;
  progressBar.style.width = progress + '%';
  navbar.classList.toggle('scrolled', scrollY > 40);
}
window.addEventListener('scroll', onScroll, { passive:true });
onScroll();

// ===================== SCROLL REVEAL (IntersectionObserver) =====================
// Splits the text of an element into per-word spans (".word > .word-inner")
// while preserving any nested tags (em, span.hl, etc.) untouched — each word
// gets an --i index so CSS can stagger it into view on scroll.
function splitIntoWords(el){
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
  const textNodes = [];
  let node;
  while((node = walker.nextNode())) textNodes.push(node);
  textNodes.forEach(textNode=>{
    const parts = textNode.textContent.split(/(\s+)/);
    const frag = document.createDocumentFragment();
    parts.forEach(part=>{
      if(part.trim() === ''){
        frag.appendChild(document.createTextNode(part));
      } else {
        const word = document.createElement('span');
        word.className = 'word';
        const inner = document.createElement('span');
        inner.className = 'word-inner';
        inner.textContent = part;
        word.appendChild(inner);
        frag.appendChild(word);
      }
    });
    textNode.parentNode.replaceChild(frag, textNode);
  });
  el.querySelectorAll('.word').forEach((w, i)=> w.style.setProperty('--i', i));
}
document.querySelectorAll('.split-reveal').forEach(splitIntoWords);

const revealEls = document.querySelectorAll(
  '.reveal-up, .reveal-scale, .reveal-wipe, .reveal-lines, .reveal-flip, .reveal-slide-r, .reveal-slide-l, .reveal-pop, .reveal-blur, .split-reveal'
);
const revealObserver = new IntersectionObserver((entries)=>{
  entries.forEach(entry=>{
    if(entry.isIntersecting){
      entry.target.classList.add('in');
    }
  });
}, { threshold:0.18, rootMargin:'0px 0px -80px 0px' });
revealEls.forEach(el=>revealObserver.observe(el));

// ===================== HERO VIDEO =====================
// The hero's visual is a looping video (an iridescent glossy ribbon render)
// instead of a generated 3D scene. Kept simple: play only while in view,
// respect reduced-motion by leaving it paused on its poster frame.
const heroStage = document.getElementById('heroStage');
const hero = document.querySelector('.hero');
const heroVideo = document.getElementById('heroVideo');

if(heroVideo){
  if(prefersReducedMotion){
    heroVideo.pause();
  } else {
    const videoVisibilityObserver = new IntersectionObserver((entries)=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting) heroVideo.play().catch(()=>{});
        else heroVideo.pause();
      });
    }, { threshold: 0 });
    videoVisibilityObserver.observe(hero);
  }
}


// ===================== HERO CURSOR SPOTLIGHT =====================
// A soft glow that trails the pointer with the same heavily-damped feel as
// the orb's parallax — reinforces depth in the hero without adding a second,
// competing motion language.
const heroSpotlight = document.getElementById('heroSpotlight');
let spot = null;
if(heroSpotlight && hero && !prefersReducedMotion){
  spot = { tx: hero.clientWidth / 2, ty: hero.clientHeight * 0.4, cx: 0, cy: 0 };
  spot.cx = spot.tx; spot.cy = spot.ty;
  hero.addEventListener('mouseenter', ()=> heroSpotlight.classList.add('active'));
  hero.addEventListener('mouseleave', ()=> heroSpotlight.classList.remove('active'));
  hero.addEventListener('mousemove', (e)=>{
    const rect = hero.getBoundingClientRect();
    spot.tx = e.clientX - rect.left;
    spot.ty = e.clientY - rect.top;
  });
}
function applyHeroSpotlight(){
  if(!spot) return;
  spot.cx += (spot.tx - spot.cx) * 0.07;
  spot.cy += (spot.ty - spot.cy) * 0.07;
  heroSpotlight.style.transform = `translate(${spot.cx}px, ${spot.cy}px)`;
}

// ===================== HERO SCROLL TRANSFORM =====================
const heroContentEl = document.querySelector('.hero-content');
const scrollCueEl = document.getElementById('scrollCue');
function applyHeroTransform(){
  const scrollY = window.scrollY;
  const heroHeight = hero.offsetHeight;
  const scrollProgress = Math.min(scrollY / heroHeight, 1.4);

  const translateY = scrollProgress * 200;
  const scale = Math.max(1 - scrollProgress * 0.3, 0.62);
  const opacity = Math.max(1 - scrollProgress * 1.1, 0);

  heroStage.style.transform = `translateY(${translateY}px) scale(${scale})`;
  heroStage.style.opacity = opacity;

  if(heroContentEl){
    heroContentEl.style.transform = `translateY(${scrollProgress * 120}px)`;
    heroContentEl.style.opacity = Math.max(1 - scrollProgress * 1.6, 0);
  }
  if(scrollCueEl){
    scrollCueEl.style.opacity = Math.max(1 - scrollProgress * 5, 0);
  }
}

// ===================== PARALLAX ELEMENTS (about bio card) =====================
// Tracks live tilt state per element so the scroll-parallax pass and the
// hover-tilt handler below both contribute to the same transform without
// fighting over inline style.transform on every frame.
const parallaxEls = document.querySelectorAll('.parallax-el');
const parallaxTiltState = new Map();
parallaxEls.forEach(el => parallaxTiltState.set(el, { rx:0, ry:0, scale:1 }));

function applyParallax(){
  const scrollY = window.scrollY;
  parallaxEls.forEach(el=>{
    const speed = parseFloat(el.dataset.speed) || 0.2;
    const rect = el.getBoundingClientRect();
    const elCenter = rect.top + scrollY + rect.height/2;
    const distanceFromViewportCenter = (elCenter - scrollY) - window.innerHeight/2;
    const offset = distanceFromViewportCenter * speed * -0.15;
    const s = parallaxTiltState.get(el);
    el.style.transform = `translateY(${offset}px) perspective(900px) rotateX(${s.rx}deg) rotateY(${s.ry}deg) scale(${s.scale})`;
  });
}

// ===================== 3D TILT ON HOVER (about bio card) =====================
// Hover handlers only update state; the main loop below applies the transform,
// so this never needs its own rAF chain.
const tiltEls = document.querySelectorAll('[data-tilt]');
tiltEls.forEach(el=>{
  const maxTilt = 6;
  const selfTiltState = parallaxTiltState.get(el);
  if(!selfTiltState) return;

  el.addEventListener('mousemove', (e)=>{
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    selfTiltState.ry = x * -maxTilt;
    selfTiltState.rx = y * maxTilt;
    selfTiltState.scale = 1.02;
  });
  el.addEventListener('mouseleave', ()=>{
    selfTiltState.rx = 0; selfTiltState.ry = 0; selfTiltState.scale = 1;
  });
});

// ===================== AMBIENT GRID DRIFT =====================
const gridBg = document.querySelector('.grid-bg');
function applyGridParallax(){
  gridBg.style.transform = `translateY(${window.scrollY * 0.15}px)`;
}

// ===================== SINGLE MAIN LOOP =====================
// Every continuous scroll/hover-driven effect above is a plain function that
// reads current state and writes styles once. They're all called from one
// rAF chain instead of each running its own — one layout-reading pass per
// frame instead of eight, and one place to pause everything at once.
if(!prefersReducedMotion){
  function mainLoop(){
    applyHeroTransform();
    applyParallax();
    applyGridParallax();
    applyHeroSpotlight();
    requestAnimationFrame(mainLoop);
  }
  requestAnimationFrame(mainLoop);
}

// ===================== MAGNETIC NAV LOGO =====================
// One small, deliberate premium touch — restrained on purpose. The logo
// leans gently toward the cursor within its own bounds and eases back on
// leave; nothing else on the page gets this treatment, so it stays a signal
// rather than noise.
if(!prefersReducedMotion){
  const navLogo = document.querySelector('.nav-logo');
  if(navLogo){
    const strength = 7;
    navLogo.addEventListener('mousemove', (e)=>{
      const rect = navLogo.getBoundingClientRect();
      const x = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2);
      const y = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2);
      navLogo.style.transition = 'transform .15s ease-out';
      navLogo.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
    });
    navLogo.addEventListener('mouseleave', ()=>{
      navLogo.style.transition = 'transform .5s var(--ease-soft)';
      navLogo.style.transform = 'translate(0, 0)';
    });
  }
}
