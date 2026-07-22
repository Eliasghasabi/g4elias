// ===================== MOTION PREFERENCE =====================
// Respected everywhere below: continuous rAF-driven motion (hero scene,
// parallax, magnetic buttons, tilt) is skipped entirely when the user has
// asked the OS for reduced motion. CSS handles the reveal/opacity side;
// this handles the JS-driven transform loops CSS can't reach.
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

// ===================== HERO 3D SCENE — organic floating orb (Three.js) =====================
// A single soft, breathing wireframe orb built from displaced icosphere geometry,
// surrounded by a slow constellation of glowing points and a faint drifting dust
// field. Motion is idle-first (it lives on its own) with only a gentle, heavily
// damped parallax response to the cursor — nothing snaps or trails abruptly.
const heroStage = document.getElementById('heroStage');
const hero = document.querySelector('.hero');

const hero3D = (function initHero3D(){
  const canvas = document.getElementById('heroCanvas');
  if(!canvas || typeof THREE === 'undefined' || prefersReducedMotion) return null;

  let width = hero.clientWidth, height = hero.clientHeight || window.innerHeight;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x090909, 0.0011);
  const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 3000);
  camera.position.set(0, 0, 620);

  const group = new THREE.Group();
  scene.add(group);

  const dustGroup = new THREE.Group();
  scene.add(dustGroup);

  // ---- soft radial glow sprite, generated on a canvas (no external assets) ----
  function makeGlowTexture(){
    const size = 128;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(c);
  }
  const glowTex = makeGlowTexture();

  // ---- sparse ambient dust field, drifting almost imperceptibly for depth ----
  const DUST_COUNT = 220;
  const dustPositions = new Float32Array(DUST_COUNT * 3);
  const dustSizes = new Float32Array(DUST_COUNT);
  const dustPhases = new Float32Array(DUST_COUNT);
  for(let i = 0; i < DUST_COUNT; i++){
    const radius = 420 + Math.random() * 900;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos((Math.random() * 2) - 1);
    dustPositions[i*3]   = radius * Math.sin(phi) * Math.cos(theta);
    dustPositions[i*3+1] = radius * Math.sin(phi) * Math.sin(theta) * 0.6;
    dustPositions[i*3+2] = radius * Math.cos(phi) - 200;
    dustSizes[i] = 1.1 + Math.random() * 2.0;
    dustPhases[i] = Math.random() * Math.PI * 2;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  dustGeo.setAttribute('aSize', new THREE.BufferAttribute(dustSizes, 1));
  dustGeo.setAttribute('aPhase', new THREE.BufferAttribute(dustPhases, 1));
  const dustMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      attribute float aSize;
      attribute float aPhase;
      uniform float uTime;
      varying float vOpacity;
      void main(){
        vec3 p = position;
        p.y += sin(uTime * 0.09 + aPhase) * 22.0;
        p.x += cos(uTime * 0.07 + aPhase) * 16.0;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float pulse = 0.3 + 0.3 * sin(uTime * 0.4 + aPhase);
        vOpacity = pulse;
        gl_PointSize = aSize * (300.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying float vOpacity;
      void main(){
        float d = length(gl_PointCoord - vec2(0.5));
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vec3(1.0), a * vOpacity * 0.45);
      }
    `,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
  dustGroup.add(new THREE.Points(dustGeo, dustMat));

  // ---- fibonacci-distributed node points across a sphere, gently orbiting ----
  const NODE_COUNT = 150;
  const RADIUS = 172;
  const positions = new Float32Array(NODE_COUNT * 3);
  const sizes = new Float32Array(NODE_COUNT);
  const phases = new Float32Array(NODE_COUNT);
  const nodeVecs = [];

  for(let i = 0; i < NODE_COUNT; i++){
    const y = 1 - (i / (NODE_COUNT - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
    const vx = x * RADIUS, vy = y * RADIUS, vz = z * RADIUS;
    positions[i*3] = vx; positions[i*3+1] = vy; positions[i*3+2] = vz;
    sizes[i] = 1.8 + Math.random() * 2.2;
    phases[i] = Math.random() * Math.PI * 2;
    nodeVecs.push(new THREE.Vector3(vx, vy, vz));
  }

  const pointsGeo = new THREE.BufferGeometry();
  pointsGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  pointsGeo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  pointsGeo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

  const pointsMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uMap: { value: glowTex } },
    vertexShader: `
      attribute float aSize;
      attribute float aPhase;
      uniform float uTime;
      varying float vOpacity;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float pulse = 0.5 + 0.4 * sin(uTime * 0.9 + aPhase);
        vOpacity = pulse;
        gl_PointSize = aSize * pulse * (360.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      varying float vOpacity;
      void main(){
        vec4 tex = texture2D(uMap, gl_PointCoord);
        gl_FragColor = vec4(vec3(1.0), tex.a * vOpacity);
      }
    `,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });

  const pointCloud = new THREE.Points(pointsGeo, pointsMat);
  group.add(pointCloud);

  // ---- thin constellation lines between nearby nodes, kept sparse for elegance ----
  const linePositions = [];
  const maxDist = 78;
  for(let i = 0; i < nodeVecs.length; i++){
    for(let j = i + 1; j < nodeVecs.length; j++){
      if(nodeVecs[i].distanceTo(nodeVecs[j]) < maxDist){
        linePositions.push(nodeVecs[i].x, nodeVecs[i].y, nodeVecs[i].z, nodeVecs[j].x, nodeVecs[j].y, nodeVecs[j].z);
      }
    }
  }
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
  const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.07 });
  group.add(new THREE.LineSegments(lineGeo, lineMat));

  // ---- glowing core with a fresnel rim-light shader ----
  const coreGeo = new THREE.IcosahedronGeometry(52, 4);
  const coreMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      uniform float uTime;
      varying vec3 vNormal;
      varying vec3 vPos;
      void main(){
        vNormal = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vPos = mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      varying vec3 vPos;
      void main(){
        vec3 viewDir = normalize(-vPos);
        float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 2.6);
        vec3 col = mix(vec3(0.06,0.06,0.07), vec3(1.0), fresnel);
        gl_FragColor = vec4(col, fresnel * 0.85 + 0.03);
      }
    `,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  group.add(core);

  // ---- organic outer shell: an icosphere whose vertices breathe outward and
  // inward on layered sine waves, so the wireframe ripples softly instead of
  // sitting as a rigid geometric shape ----
  const shellGeo = new THREE.IcosahedronGeometry(210, 3);
  const shellEdges = new THREE.EdgesGeometry(shellGeo);
  // map edge-geometry vertices back to base-radius vectors so we can displace them each frame
  const edgePos = shellEdges.attributes.position;
  const edgeBase = new Float32Array(edgePos.array.length);
  edgeBase.set(edgePos.array);
  const shellMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.05 });
  const shell = new THREE.LineSegments(shellEdges, shellMat);
  group.add(shell);

  function updateShell(t){
    const pos = edgePos.array;
    for(let i = 0; i < pos.length; i += 3){
      const bx = edgeBase[i], by = edgeBase[i+1], bz = edgeBase[i+2];
      const len = Math.sqrt(bx*bx + by*by + bz*bz) || 1;
      const nx = bx/len, ny = by/len, nz = bz/len;
      const wobble = 1 + Math.sin(t * 0.35 + nx * 2.4 + ny * 1.6) * 0.018 + Math.cos(t * 0.22 + nz * 3.1) * 0.012;
      pos[i]   = bx * wobble;
      pos[i+1] = by * wobble;
      pos[i+2] = bz * wobble;
    }
    edgePos.needsUpdate = true;
  }

  // ---- a single slim orbiting ring for quiet depth ----
  const ringGeo = new THREE.TorusGeometry(248, 0.3, 8, 128);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.075 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2.25;
  group.add(ring);

  function onResize(){
    width = hero.clientWidth;
    height = hero.clientHeight || window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }
  window.addEventListener('resize', onResize);

  // heavily damped pointer influence — the orb leans toward the cursor slowly
  // and settles, it never chases it directly
  let mouseX = 0, mouseY = 0, curX = 0, curY = 0;
  document.addEventListener('mousemove', (e) => {
    const rect = hero.getBoundingClientRect();
    mouseX = (e.clientX - (rect.left + rect.width / 2)) / rect.width;
    mouseY = (e.clientY - (rect.top + rect.height / 2)) / rect.height;
  });

  const clock = new THREE.Clock();
  let scrollTarget = 0, scrollCur = 0;

  function render(){
    // delta-clamped so a stutter or tab-switch never causes a jump —
    // motion stays equally smooth at 30fps, 60fps or 144fps.
    const delta = Math.min(clock.getDelta(), 1/30);
    const t = clock.getElapsedTime();
    pointsMat.uniforms.uTime.value = t;
    dustMat.uniforms.uTime.value = t;
    coreMat.uniforms.uTime.value = t;
    updateShell(t);

    // gentle, slow-settling parallax (low-pass filtered, never snaps)
    const followSpeed = 1 - Math.pow(0.0002, delta);
    curX += (mouseX - curX) * followSpeed;
    curY += (mouseY - curY) * followSpeed;
    scrollCur += (scrollTarget - scrollCur) * (1 - Math.pow(0.015, delta));

    // idle autonomous rotation always runs underneath the pointer influence,
    // so the piece feels alive even when nobody is interacting with it
    group.rotation.y = t * 0.055 + curX * 0.35 + scrollCur;
    group.rotation.x = -curY * 0.2 + Math.sin(t * 0.12) * 0.03;
    ring.rotation.z = t * 0.08;

    // slow, independent parallax layer for the dust field
    dustGroup.rotation.y = -t * 0.012 + curX * 0.06;
    dustGroup.rotation.x = curY * 0.035;

    const breathe = 1 + Math.sin(t * 0.4) * 0.02;
    core.scale.setScalar(breathe);

    renderer.render(scene, camera);
    requestAnimationFrame(render);
  }
  render();

  return {
    setScrollProgress(p){ scrollTarget = p * 2.6; }
  };
})();

// ===================== HERO SCROLL TRANSFORM =====================
function applyHeroTransform(){
  const scrollY = window.scrollY;
  const heroHeight = hero.offsetHeight;
  const scrollProgress = Math.min(scrollY / heroHeight, 1.4);

  const translateY = scrollProgress * 200;
  const scale = Math.max(1 - scrollProgress * 0.3, 0.62);
  const opacity = Math.max(1 - scrollProgress * 1.1, 0);

  heroStage.style.transform = `translateY(${translateY}px) scale(${scale})`;
  heroStage.style.opacity = opacity;

  if(hero3D) hero3D.setScrollProgress(scrollProgress);

  const heroContent = document.querySelector('.hero-content');
  if(heroContent){
    heroContent.style.transform = `translateY(${scrollProgress * 120}px)`;
    heroContent.style.opacity = Math.max(1 - scrollProgress * 1.6, 0);
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

// ===================== SCROLL-SCRUBBED STACK TIMELINE RAIL =====================
// A vertical rail beside the "learning" grid fills smoothly as the section
// travels through the viewport — this one is meaningful (it visualises
// progress through a real list), unlike a purely decorative scrub effect.
const stackSection = document.querySelector('.stack');
const stackRailFill = document.getElementById('stackRailFill');
let railProgress = 0;
function applyStackRail(){
  if(!stackSection || !stackRailFill) return;
  const rect = stackSection.getBoundingClientRect();
  const vh = window.innerHeight;
  const total = rect.height + vh * 0.6;
  const traveled = vh * 0.85 - rect.top;
  const target = Math.max(0, Math.min(1, traveled / total));
  railProgress += (target - railProgress) * 0.08;
  stackRailFill.style.transform = `scaleY(${railProgress})`;
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
    applyStackRail();
    requestAnimationFrame(mainLoop);
  }
  requestAnimationFrame(mainLoop);
} else {
  // Reduced motion: set final resting states once, no continuous loop.
  applyStackRail();
  if(stackRailFill) stackRailFill.style.transform = 'scaleY(1)';
}
