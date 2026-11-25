/* Ethos Vision / hero lens. A real-time cinema lens built with Three.js.
   Scroll pulls focus: the EV mark parts, the iris opens and the camera travels through the glass into the reel. */
import {
  WebGLRenderer, WebGLRenderTarget, HalfFloatType, Scene, PerspectiveCamera, Group, Mesh, Points, Color, Vector2, Shape, ExtrudeGeometry,
  LatheGeometry, RingGeometry, CircleGeometry, SphereGeometry, PlaneGeometry, BoxGeometry, BufferGeometry,
  Float32BufferAttribute, MeshPhysicalMaterial, MeshStandardMaterial, MeshBasicMaterial, PointsMaterial, ShaderMaterial,
  CanvasTexture, TextureLoader, VideoTexture, PMREMGenerator, InstancedMesh, Object3D, DoubleSide, BackSide,
  AdditiveBlending, SRGBColorSpace, ACESFilmicToneMapping, PointLight, DirectionalLight, ShapeGeometry, MathUtils
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

(() => {
  const hero = document.querySelector('.hero');
  const stage = document.querySelector('.hero-stage');
  const canvas = document.querySelector('.hero-gpu');
  if (!hero || !stage || !canvas) return;
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const params = new URLSearchParams(location.search);
  const forced = params.has('lensp') ? Number(params.get('lensp')) : null;
  const small = () => innerWidth < 760;

  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance', stencil: false });
  } catch (error) { console.warn('Ethos lens: WebGL unavailable, keeping the still emblem.'); return; }
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  const camera = new PerspectiveCamera(32, 1, 0.05, 80);
  camera.position.set(0, 0, 13);

  /* Studio lighting, baked into an environment map: one white softbox, a violet wall and a magenta rim. */
  const envScene = new Scene();
  envScene.add(new Mesh(new BoxGeometry(30, 30, 30), new MeshBasicMaterial({ color: 0x08060d, side: BackSide })));
  const panel = (w, h, hex, power, x, y, z) => {
    const m = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ color: new Color(hex).multiplyScalar(power), side: DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); envScene.add(m);
  };
  panel(7, 2.4, 0xffffff, 7, -6, 7, 5);
  panel(14, .5, 0xf1e6ff, 9, 0, 8, 7);
  panel(5, 10, 0x8a3cff, 5, 10, 0, -1);
  panel(12, 1.2, 0xc04dff, 4, 0, -8, -6);
  panel(4, 7, 0x6f7dff, 1.6, -10, -1, 2);
  panel(3, 3, 0xffffff, 3, 4, 3, 10);
  panel(16, 6, 0xf4eeff, 2.4, 0, 5, 11);
  panel(8, 8, 0xffffff, .55, -9, 2, 8);
  panel(16, 4, 0x6a32b8, .7, 0, -5, 11);
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(envScene, 0.03).texture;
  pmrem.dispose();

  const key = new DirectionalLight(0xffffff, 1.4); key.position.set(-4, 6, 8); scene.add(key);
  const rim = new PointLight(0xa35bff, 40, 18); rim.position.set(4, 2, -2); scene.add(rim);


  /* Materials */
  const chrome = new MeshPhysicalMaterial({ color: 0xe9e2fb, metalness: 1, roughness: .17, clearcoat: .5, clearcoatRoughness: .1 });
  const sheen = document.createElement('canvas'); sheen.width = sheen.height = 512;
  {
    const c = sheen.getContext('2d'), g = c.createLinearGradient(0, 0, 512, 512);
    g.addColorStop(0, '#ffffff'); g.addColorStop(.38, '#e4dcf0'); g.addColorStop(.55, '#a79cb9'); g.addColorStop(.72, '#d9d0e6'); g.addColorStop(1, '#8a7ea0');
    c.fillStyle = g; c.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(${Math.random() < .5 ? '255,255,255' : '40,30,60'},${Math.random() * .06})`; c.fillRect(0, Math.random() * 512, 512, Math.random() * 1.6); }
  }
  const sheenMap = new CanvasTexture(sheen); sheenMap.colorSpace = SRGBColorSpace; sheenMap.repeat.set(1 / 4.8, 1 / 4.8); sheenMap.offset.set(.5, .5);
  const brushed = new MeshPhysicalMaterial({ color: 0xffffff, map: sheenMap, metalness: 1, roughness: .2, clearcoat: .6, clearcoatRoughness: .08 });
  const violetEdge = new MeshPhysicalMaterial({ color: 0xa565ff, metalness: 1, roughness: .2, emissive: 0x5a17c4, emissiveIntensity: .9 });
  const anodized = new MeshPhysicalMaterial({ color: 0x17141d, metalness: .75, roughness: .36, clearcoat: .7, clearcoatRoughness: .25 });
  const matte = new MeshStandardMaterial({ color: 0x050407, metalness: .2, roughness: .9, side: DoubleSide });
  const bladeMat = new MeshPhysicalMaterial({ color: 0x302a3a, metalness: .9, roughness: .3, clearcoat: .4, side: DoubleSide, polygonOffset: true, polygonOffsetFactor: -1 });
  const irisInverse = { value: null };
  bladeMat.onBeforeCompile = shader => {
    shader.uniforms.irisInverse = irisInverse;
    shader.vertexShader = 'uniform mat4 irisInverse;\nvarying vec2 vIris;\n' + shader.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n  vIris = (irisInverse * modelMatrix * vec4(transformed, 1.0)).xy;');
    shader.fragmentShader = 'varying vec2 vIris;\n' + shader.fragmentShader.replace('void main() {', 'void main() {\n  if (length(vIris) > 1.69) discard;');
  };
  const glow = new MeshBasicMaterial({ color: new Color(0xb978ff).multiplyScalar(1.6), toneMapped: false });

  const world = new Group(); scene.add(world);
  const lens = new Group(); world.add(lens);

  const lathe = (pts, mat, segments = 128) => {
    const m = new Mesh(new LatheGeometry(pts.map(([r, z]) => new Vector2(r, z)), segments), mat);
    m.rotation.x = Math.PI / 2; return m;
  };
  // Front bezel: a polished lip
  lens.add(lathe([[1.70, .30], [1.86, .36], [2.12, .38], [2.32, .30], [2.40, .14], [2.39, -.04], [2.33, -.12]], chrome));
  // Engraving face on the bezel
  const ringCanvas = document.createElement('canvas'); ringCanvas.width = ringCanvas.height = 1024;
  const ringTexture = new CanvasTexture(ringCanvas); ringTexture.colorSpace = SRGBColorSpace; ringTexture.anisotropy = 4;
  function engrave() {
    const c = ringCanvas.getContext('2d'); c.clearRect(0, 0, 1024, 1024);
    c.translate(512, 512);
    const text = 'ETHOS VISION   ✦   CINEMATIC OPTICAL SERIES   ✦   EV—01   ✦   24–70 MM   1:1.4   ✦   ';
    c.font = '500 30px Archivo, Arial, sans-serif'; c.fillStyle = 'rgba(236,224,255,.78)'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const radius = 512 * (2.0 / 2.14);
    let angle = -Math.PI / 2;
    const total = [...text].reduce((sum, ch) => sum + c.measureText(ch).width + 3.2, 0);
    const scale = (Math.PI * 2 * radius) / total;
    for (const ch of text) {
      const w = (c.measureText(ch).width + 3.2) * scale;
      angle += w / 2 / radius;
      c.save(); c.rotate(angle + Math.PI / 2); c.translate(0, -radius); c.fillText(ch, 0, 0); c.restore();
      angle += w / 2 / radius;
    }
    c.strokeStyle = 'rgba(190,140,255,.35)'; c.lineWidth = 2;
    c.beginPath(); c.arc(0, 0, 512 * (1.88 / 2.14), 0, Math.PI * 2); c.stroke();
    c.setTransform(1, 0, 0, 1, 0, 0);
    ringTexture.needsUpdate = true;
  }
  engrave();
  document.fonts?.ready.then(engrave).catch(() => {});
  const face = new Mesh(new RingGeometry(1.78, 2.14, 128, 1), new MeshPhysicalMaterial({ color: 0x0f0c14, metalness: .6, roughness: .3, clearcoat: 1, emissiveMap: ringTexture, emissive: 0xffffff, emissiveIntensity: .5, transparent: false }));
  face.position.z = .385; lens.add(face);

  // Focus ring with grip ridges (rotates as you scroll: pulling focus)
  const ridges = [[2.30, -.12]];
  for (let i = 0; i <= 28; i++) ridges.push([i % 2 ? 2.31 : 2.38, -.16 - i * .03]);
  ridges.push([2.30, -1.02]);
  const focusRing = lathe(ridges, anodized, 160); lens.add(focusRing);
  // Index marks on the focus ring
  const marks = new InstancedMesh(new BoxGeometry(.018, .09, .02), glow, 36);
  const dummy = new Object3D();
  for (let i = 0; i < 36; i++) {
    const a = i / 36 * Math.PI * 2, long = i % 6 === 0;
    dummy.position.set(Math.cos(a) * 2.405, Math.sin(a) * 2.405, -1.08); dummy.rotation.set(0, 0, a - Math.PI / 2);
    dummy.scale.set(1, long ? 1.8 : 1, 1); dummy.updateMatrix(); marks.setMatrixAt(i, dummy.matrix);
  }
  lens.add(marks);
  lens.add(lathe([[2.30, -1.02], [2.40, -1.05], [2.40, -1.16], [2.32, -1.2]], chrome));
  lens.add(lathe([[2.32, -1.2], [2.26, -1.6], [2.22, -2.2], [2.05, -2.45], [1.7, -2.5]], anodized));
  lens.add(lathe([[2.24, -1.75], [2.29, -1.78], [2.29, -1.86], [2.24, -1.9]], chrome));
  // Inner barrel wall
  lens.add(lathe([[1.70, .30], [1.62, .05], [1.58, -.6], [1.56, -1.0]], matte));

  // Iris: nine blades turning on their pivots
  const BLADES = 9, PIVOT = 1.72;
  function bladeShape() {
    const shape = new Shape(), N = 26, L = 3.0, R = 2.0, h0 = MathUtils.degToRad(166);
    const cx = R * Math.cos(h0 + Math.PI / 2), cy = R * Math.sin(h0 + Math.PI / 2);
    const left = [], right = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, s = t * L, a = h0 - Math.PI / 2 + s / R;
      const px = cx + R * Math.cos(a), py = cy + R * Math.sin(a);
      const nx = Math.cos(a), ny = Math.sin(a);
      const w = 1.05 * Math.sin(Math.PI * Math.min(1, t * .95 + .08)) + .12;
      left.push([px - nx * w * .5, py - ny * w * .5]); right.push([px + nx * w * .5, py + ny * w * .5]);
    }
    shape.moveTo(...left[0]); left.slice(1).forEach(p => shape.lineTo(...p));
    right.reverse().forEach(p => shape.lineTo(...p));
    return shape;
  }
  const bladeGeo = new ExtrudeGeometry(bladeShape(), { depth: .012, bevelEnabled: true, bevelThickness: .01, bevelSize: .012, bevelSegments: 2, curveSegments: 1 });
  const iris = new Group(); iris.position.z = -.62; lens.add(iris);
  irisInverse.value = iris.matrixWorld.clone();
  const blades = [];
  for (let i = 0; i < BLADES; i++) {
    const holder = new Group(); holder.rotation.z = i / BLADES * Math.PI * 2;
    const pivot = new Group(); pivot.position.x = PIVOT; pivot.position.z = i * .03;
    const blade = new Mesh(bladeGeo, bladeMat); blade.rotation.x = .07; pivot.add(blade); holder.add(pivot); iris.add(holder); blades.push(pivot);
  }
  // Light-tight back plate around the iris
  const plate = new Mesh(new RingGeometry(1.5, 2.3, 96), matte); plate.position.z = -.66; lens.add(plate);

  // The sensor: the studio reel plays behind the iris
  const loader = new TextureLoader();
  // Browsers block video and image textures on pages opened straight from disk (file://), so the screen stays dark there.
  const local = location.protocol === 'file:';
  const poster = local ? null : loader.load('./assets/videos/studio-reel.webp', t => { t.colorSpace = SRGBColorSpace; });
  const fitCover = t => { t.repeat.set(9 / 16, 1); t.offset.set((1 - 9 / 16) / 2, 0); };
  if (poster) fitCover(poster);
  const screenMat = new MeshBasicMaterial({ map: poster, toneMapped: false, color: new Color(.32, .3, .36) });
  const screen = new Mesh(new CircleGeometry(1.62, 96), screenMat); screen.position.z = -.9; lens.add(screen);
  let video = null, videoTexture = null;
  function wantVideo(on) {
    if (on && local) return;
    if (on && !video) {
      video = document.createElement('video');
      Object.assign(video, { muted: true, loop: true, playsInline: true, preload: 'auto', crossOrigin: 'anonymous' });
      video.setAttribute('muted', ''); video.setAttribute('playsinline', '');
      video.src = './assets/videos/studio-reel.mp4';
      videoTexture = new VideoTexture(video); videoTexture.colorSpace = SRGBColorSpace; fitCover(videoTexture);
      video.addEventListener('playing', () => { screenMat.map = videoTexture; screenMat.needsUpdate = true; }, { once: true });
      video.play().catch(() => {});
    } else if (!on && video) {
      video.pause(); video.removeAttribute('src'); video.load(); video = null;
      videoTexture?.dispose(); videoTexture = null; screenMat.map = poster; screenMat.needsUpdate = true;
    }
  }

  // Front element: coated glass with the purple-green bloom of a real lens coating
  const glassR = 3.3, rim2 = 1.72, cap = glassR - Math.sqrt(glassR * glassR - rim2 * rim2);
  const glass = new Mesh(new SphereGeometry(glassR, 96, 24, 0, Math.PI * 2, 0, Math.asin(rim2 / glassR)), new MeshPhysicalMaterial({
    color: 0x000000, metalness: 0, roughness: .04, transparent: true, opacity: 1, depthWrite: false, blending: AdditiveBlending,
    iridescence: 1, iridescenceIOR: 1.45, iridescenceThicknessMinimum: 180, iridescenceThicknessMaximum: 520, envMapIntensity: 1.7, clearcoat: 1
  }));
  glass.rotation.x = Math.PI / 2; glass.position.z = .28 - (glassR - cap); lens.add(glass);

  /* The EV mark, traced from the studio emblem and extruded as polished chrome with violet edges. */
  const A = [[0, 64], [390, 57], [408, 66], [520, 262], [683, 60], [778, 60], [522, 482], [308, 136], [46, 136]];
  const B = [[40, 195], [322, 195], [356, 262], [136, 262], [136, 365], [404, 365], [446, 426], [78, 426], [48, 410], [40, 385]];
  const S = 4.5 / 778, CX = 389, CY = 270;
  const toShape = pts => { const s = new Shape(); pts.forEach(([x, y], i) => s[i ? 'lineTo' : 'moveTo']((x - CX) * S, -(y - CY) * S)); s.closePath(); return s; };
  const extrude = { depth: .32, bevelEnabled: true, bevelThickness: .07, bevelSize: .05, bevelSegments: 5, curveSegments: 1 };
  const mark = new Group(); world.add(mark);
  const partA = new Mesh(new ExtrudeGeometry(toShape(A), extrude), [brushed, violetEdge]);
  const partB = new Mesh(new ExtrudeGeometry(toShape(B), extrude), [brushed, violetEdge]);
  [partA, partB].forEach(p => { p.geometry.translate(0, 0, -.16); mark.add(p); });

  /* Dust in the projector beam */
  const DUST = small() ? 220 : 520;
  const dustPositions = new Float32Array(DUST * 3), dustSeeds = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) {
    dustPositions[i * 3] = (Math.random() - .5) * 9; dustPositions[i * 3 + 1] = (Math.random() - .5) * 7; dustPositions[i * 3 + 2] = (Math.random() - .4) * 7;
    dustSeeds[i] = Math.random() * 100;
  }
  const dustGeo = new BufferGeometry(); dustGeo.setAttribute('position', new Float32BufferAttribute(dustPositions, 3));
  const dust = new Points(dustGeo, new PointsMaterial({ color: 0xd6b8ff, size: .022, transparent: true, opacity: .55, blending: AdditiveBlending, depthWrite: false }));
  world.add(dust);

  /* Post: a restrained bloom on the violet edges and highlights */
  let composer = null, bloom = null;
  let bloomAllowed = params.get('lensbloom') !== '0';
  function buildComposer() {
    if (small() || !bloomAllowed) { composer?.dispose(); composer = null; bloom = null; return; }
    if (composer) return;
    // Multisampled target keeps edges smooth when the glow pass is on.
    composer = new EffectComposer(renderer, new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 4 }));
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new Vector2(256, 256), .5, .55, .82);
    // The glow is soft by nature, so it is computed at half resolution: about a quarter of the cost.
    const setBloomSize = bloom.setSize.bind(bloom);
    bloom.setSize = (w, h) => setBloomSize(Math.max(1, w >> 1), Math.max(1, h >> 1));
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  /* Layout and choreography */
  let width = 1, height = 1, quality = 1, base = { x: 0, y: 0, s: 1 }, dpr = 1;
  function resize() {
    const r = stage.getBoundingClientRect();
    width = Math.max(1, Math.round(r.width)); height = Math.max(1, Math.round(r.height));
    // Keep the 3D canvas under ~2.2 million pixels whatever the screen, then scale by measured quality.
    const native = Math.min(devicePixelRatio || 1, small() ? 1.75 : 1.5);
    const budget = Math.sqrt(3.2e6 / (width * height));
    dpr = Math.max(.5, Math.min(native, budget) * quality * (params.has('lensdpr') ? Number(params.get('lensdpr')) : 1));
    renderer.setPixelRatio(dpr); renderer.setSize(width, height, false);
    camera.aspect = width / height; camera.updateProjectionMatrix();
    buildComposer();
    if (composer) { composer.setPixelRatio(dpr); composer.setSize(width, height); }
    const halfH = Math.tan(MathUtils.degToRad(camera.fov / 2)) * 13, halfW = halfH * camera.aspect;
    if (camera.aspect < 1.05) base = { x: 0, y: -halfH * .40, s: Math.min(.7, halfW / 3.1) };
    else base = { x: halfW * .42, y: -halfH * .03, s: Math.min(1, halfW * .52 / 2.6) };
  }

  const smooth = t => t * t * (3 - 2 * t);
  const range = (v, a, b) => smooth(MathUtils.clamp((v - a) / (b - a), 0, 1));
  let target = 0, progress = forced ?? 0, time = 0, pointer = { x: 0, y: 0 }, eased = { x: 0, y: 0 };
  const readout = document.querySelector('.lens-readout b');
  const stops = ['16', '11', '8', '5.6', '4', '2.8', '2', '1.4'];
  let lastStop = '';

  function compose(dt) {
    progress = forced ?? progress + (target - progress) * Math.min(1, dt * 16);
    const p = progress;
    const center = range(p, 0, .32), part = range(p, .16, .58), dolly = range(p, .46, 1);
    eased.x += (pointer.x - eased.x) * Math.min(1, dt * 4); eased.y += (pointer.y - eased.y) * Math.min(1, dt * 4);
    const idle = motionAllowed() ? 1 : 0, still = 1 - dolly;

    world.position.set(MathUtils.lerp(base.x, 0, center), MathUtils.lerp(base.y, 0, center) + Math.sin(time * .7) * .05 * idle * still, 0);
    world.scale.setScalar(MathUtils.lerp(base.s, 1, center));
    lens.rotation.set(MathUtils.lerp(.1, 0, center) - eased.y * .16 * still, MathUtils.lerp(-.5, 0, center) + eased.x * .26 * still, 0);
    focusRing.rotation.y = p * Math.PI * .9; marks.rotation.z = p * Math.PI * .9;

    mark.position.set(0, 0, 1.25 + Math.sin(time * .9) * .04 * idle);
    mark.rotation.set(MathUtils.lerp(.06, 0, center) - eased.y * .22 * still, MathUtils.lerp(-.46, 0, center) + eased.x * .34 * still, 0);
    partA.position.set(part * 4.2, part * 2.6, part * 3.2); partA.rotation.set(-part * .5, part * .4, -part * .25);
    partB.position.set(-part * 4.4, -part * 2.4, part * 3); partB.rotation.set(part * .45, -part * .5, part * .3);

    const open = MathUtils.lerp(.12 + Math.sin(time * .5) * .025 * idle, 1.4, part);
    blades.forEach(b => { b.rotation.z = open; });
    screenMat.color.setScalar(MathUtils.lerp(.34, 1, part));
    glass.material.opacity = 1 - dolly * .8;

    camera.position.set(0, 0, MathUtils.lerp(13, 3.3, Math.pow(dolly, 1.2)));
    camera.lookAt(0, 0, -1);
    if (bloom) bloom.strength = MathUtils.lerp(.5, .2, dolly);

    const positions = dustGeo.attributes.position.array;
    if (idle) { for (let i = 0; i < DUST; i++) { positions[i * 3 + 1] += Math.sin(time * .3 + dustSeeds[i]) * .0009; positions[i * 3] += .0006; if (positions[i * 3] > 4.5) positions[i * 3] = -4.5; } dustGeo.attributes.position.needsUpdate = true; }

    hero.style.setProperty('--lens-p', p.toFixed(4));
    hero.style.setProperty('--lens-copy', (1 - range(p, .02, .2)).toFixed(3));
    if (readout) { const stop = stops[Math.min(stops.length - 1, Math.round(part * (stops.length - 1)))]; if (stop !== lastStop) { lastStop = stop; readout.textContent = 'f/' + stop; } }
    wantVideo(part > .12 && motionAllowed() && !navigator.connection?.saveData);
  }

  function draw() { iris.updateWorldMatrix(true, false); irisInverse.value.copy(iris.matrixWorld).invert(); composer ? composer.render() : renderer.render(scene, camera); }

  /* Scheduling: render only when the hero is on screen, the tab is visible and the film player is closed. */
  const cinema = document.querySelector('.cinema');
  let visible = true, frame = 0, last = 0, slow = 0, lost = false;
  function motionAllowed() { return !root.classList.contains('motion-off') && !reduced.matches; }
  function running() { return !lost && visible && !document.hidden && !cinema?.open && motionAllowed(); }
  function measure() {
    const r = hero.getBoundingClientRect(), travel = Math.max(1, hero.offsetHeight - innerHeight);
    target = motionAllowed() ? MathUtils.clamp(-r.top / travel, 0, 1) : 0;
  }
  // Adaptive quality: if frames run long for about a second, step resolution down, then drop the glow.
  const steps = [1, .85];
  let step = 0, ema = 16.7, settle = 0;
  function adapt(gap) {
    if (gap > 250 || forced !== null) return;
    ema += (gap - ema) * .05;
    if (++settle < 60) return;
    if (ema > 24) {
      settle = 0;
      if (composer) { bloomAllowed = false; buildComposer(); resize(); }
      else if (step < steps.length - 1) { step++; quality = steps[step]; resize(); }
      canvas.dataset.quality = `${quality}${composer ? '' : '-noglow'}`;
    }
  }
  function loop(now) {
    frame = 0; if (!running()) { last = 0; return; }
    frame = requestAnimationFrame(loop);
    const gap = last ? now - last : 16.7; last = now;
    adapt(gap);
    const dt = Math.min(gap / 1000, .05); time += dt;
    compose(dt); draw();
  }
  function wake() {
    root.classList.toggle('lens-motion', motionAllowed());
    if (running()) { if (!frame) { last = 0; frame = requestAnimationFrame(loop); } }
    else { cancelAnimationFrame(frame); frame = 0; if (!motionAllowed() || !visible) wantVideo(false); measure(); compose(1); draw(); }
    canvas.dataset.running = String(running());
  }
  addEventListener('scroll', measure, { passive: true });
  addEventListener('resize', () => { resize(); measure(); if (!running()) { compose(1); draw(); } });
  addEventListener('pointermove', e => {
    if (!fine.matches || !visible) return;
    pointer.x = (e.clientX / innerWidth - .5) * 2; pointer.y = (e.clientY / innerHeight - .5) * 2;
  }, { passive: true });
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; wake(); }, { threshold: 0 }).observe(hero);
  new MutationObserver(wake).observe(root, { attributes: true, attributeFilter: ['class'] });
  if (cinema) new MutationObserver(wake).observe(cinema, { attributes: true, attributeFilter: ['open'] });
  document.addEventListener('visibilitychange', wake);
  reduced.addEventListener('change', wake);
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; cancelAnimationFrame(frame); wantVideo(false); root.classList.remove('lens-ready'); });
  addEventListener('pagehide', () => { cancelAnimationFrame(frame); frame = 0; wantVideo(false); });

  if (params.has('lensdebug')) window.__lens = { scene, camera, blades, mark, lens, world, draw, compose, renderer, get composer() { return composer; } };
  resize(); measure(); compose(1); draw();
  root.classList.add('lens-ready');
  canvas.dataset.renderer = 'three';
  wake();
})();
