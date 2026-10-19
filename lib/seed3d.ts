import * as THREE from 'three';

/**
 * Diorama 3D benih yang tumbuh: benih → tunas → pohon muda → pohon rindang → hutan.
 * Detail dari tekstur kanvas, daun digambar dengan InstancedMesh, batang digabung per pohon,
 * supaya tetap ringan di HP. Animasi berhenti saat tidak terlihat.
 */
export type SeedScene = { setStage(i: number): void; destroy(): void };

type TreeOpts = {
  seed: number; depth: number; trunkSplits: number; extra: number; len: number; radius: number;
  spread: number; upward: number; perTip: number; cluster: number; leaf: number; dark?: string; light?: string;
};

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const ss = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// Angka acak yang bisa diulang, supaya bentuk pohon selalu sama.
function rng(seed: number) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

type Draw = (x: CanvasRenderingContext2D, w: number, h: number) => void;
function tex(w: number, h: number, draw: Draw, rep?: [number, number]) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}
function speckle(x: CanvasRenderingContext2D, w: number, h: number, n: number, colors: string[], r0: number, r1: number, seed: number) {
  const R = rng(seed);
  for (let i = 0; i < n; i++) {
    x.fillStyle = colors[(R() * colors.length) | 0]; x.globalAlpha = 0.35 + R() * 0.5;
    x.beginPath(); x.arc(R() * w, R() * h, r0 + R() * (r1 - r0), 0, 7); x.fill();
  }
  x.globalAlpha = 1;
}
function leafTexture(round: boolean) {
  return tex(128, 256, (x, w, h) => {
    const gr = x.createLinearGradient(0, h, 0, 0);
    gr.addColorStop(0, round ? '#86b23c' : '#3d6a1a'); gr.addColorStop(1, round ? '#b4d866' : '#78a832');
    x.fillStyle = gr; x.beginPath(); x.moveTo(w / 2, h - 2);
    if (round) { x.bezierCurveTo(-w * 0.15, h * 0.75, 0, h * 0.05, w / 2, 6); x.bezierCurveTo(w, h * 0.05, w * 1.15, h * 0.75, w / 2, h - 2); }
    else { x.bezierCurveTo(0, h * 0.72, w * 0.12, h * 0.18, w / 2, 2); x.bezierCurveTo(w * 0.88, h * 0.18, w, h * 0.72, w / 2, h - 2); }
    x.fill();
    x.save(); x.clip();
    x.strokeStyle = 'rgba(225,245,190,.55)'; x.lineWidth = 3; x.beginPath(); x.moveTo(w / 2, h); x.lineTo(w / 2, 8); x.stroke();
    x.lineWidth = 1.3; x.strokeStyle = 'rgba(225,245,190,.3)';
    for (let i = 1; i < 8; i++) {
      const y = h * (0.9 - i * 0.105);
      x.beginPath(); x.moveTo(w / 2, y); x.quadraticCurveTo(w * 0.3, y - 10, w * 0.08, y - 30);
      x.moveTo(w / 2, y); x.quadraticCurveTo(w * 0.7, y - 10, w * 0.92, y - 30); x.stroke();
    }
    const sh = x.createLinearGradient(0, 0, w, 0);
    sh.addColorStop(0, 'rgba(0,0,0,.18)'); sh.addColorStop(0.5, 'rgba(255,255,255,.06)'); sh.addColorStop(1, 'rgba(0,0,0,.18)');
    x.fillStyle = sh; x.fillRect(0, 0, w, h); x.restore();
  });
}
// Daun: bidang yang melengkung, pangkal di titik asal.
function leafGeometry() {
  const g = new THREE.PlaneGeometry(1, 1, 2, 5); g.translate(0, 0.5, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, -0.28 * y * y + 0.18 * Math.abs(x)); }
  g.computeVertexNormals(); return g;
}
function merge(geos: THREE.BufferGeometry[]) {
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
  let off = 0;
  for (const g of geos) {
    pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); uv.push(...g.attributes.uv.array);
    for (const i of g.index!.array) idx.push(i + off);
    off += g.attributes.position.count; g.dispose();
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  m.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  m.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  m.setIndex(idx); return m;
}
function shadowDisc(r: number) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d')!; const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; return m;
}

export function hasWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

export function mountSeed(box: HTMLElement, initialStage: number, onUserStage?: () => void): SeedScene {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let target = initialStage;

  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  r.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.domElement.style.display = 'block'; r.domElement.style.width = '100%'; r.domElement.style.height = '100%';
  box.appendChild(r.domElement);

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(32, 1, 0.05, 60);
  scene.add(new THREE.HemisphereLight(0xe4f2ff, 0x5c4a30, 0.75 * Math.PI));
  const sun = new THREE.DirectionalLight(0xfff0d8, 1.6 * Math.PI); sun.position.set(3, 7, 4); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -3.4, right: 3.4, top: 4.5, bottom: -2.5, near: 1, far: 20 });
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02; scene.add(sun);
  const root = new THREE.Group(); scene.add(root);

  // Tekstur
  const soilTex = tex(256, 256, (x, w, h) => { x.fillStyle = '#5a3d24'; x.fillRect(0, 0, w, h); speckle(x, w, h, 1400, ['#3e2817', '#7a5536', '#6a4a2e', '#8c6a48', '#2f1e10'], 0.6, 2.6, 7); }, [3, 3]);
  const sideTex = tex(256, 128, (x, w, h) => {
    const gr = x.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#4f6f22'); gr.addColorStop(0.12, '#5a3d24'); gr.addColorStop(0.6, '#4a311c'); gr.addColorStop(1, '#3a2614');
    x.fillStyle = gr; x.fillRect(0, 0, w, h); speckle(x, w, h * 0.9, 900, ['#2f1e10', '#7a5536', '#8a8478', '#6a4a2e'], 0.5, 2.2, 11);
  }, [6, 1]);
  const grassTex = tex(256, 256, (x, w, h) => { x.fillStyle = '#5f8a2a'; x.fillRect(0, 0, w, h); speckle(x, w, h, 1600, ['#4a7420', '#76a23a', '#3d621a', '#8cb24a', '#6a5a30'], 0.8, 3, 3); }, [4, 4]);
  const barkTex = tex(64, 256, (x, w, h) => {
    x.fillStyle = '#6a4d33'; x.fillRect(0, 0, w, h); const R = rng(5);
    for (let i = 0; i < 70; i++) {
      x.strokeStyle = R() < 0.5 ? 'rgba(40,26,14,.55)' : 'rgba(150,120,90,.35)'; x.lineWidth = 0.6 + R() * 2;
      const sx = R() * w; x.beginPath(); x.moveTo(sx, 0);
      for (let y = 0; y <= h; y += 16) x.lineTo(sx + Math.sin(y * 0.05 + i) * 3, y);
      x.stroke();
    }
  }, [2, 3]);
  const seedTex = tex(128, 128, (x, w, h) => {
    const gr = x.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#5e3b1f'); gr.addColorStop(0.5, '#9a6a3c'); gr.addColorStop(1, '#5e3b1f');
    x.fillStyle = gr; x.fillRect(0, 0, w, h); speckle(x, w, h, 140, ['#c9a274', '#3e2614'], 0.6, 1.8, 9);
    x.strokeStyle = 'rgba(40,22,10,.6)'; x.lineWidth = 2; x.beginPath(); x.moveTo(w / 2, 0); x.lineTo(w / 2, h); x.stroke();
  });

  const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.95, ...o });
  const soilMat = std({ map: soilTex }), barkMat = std({ map: barkTex, roughness: 0.9 });
  const leafTex = leafTexture(false), cotyTex = leafTexture(true);
  const leafMat = std({ map: leafTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.7 });
  const cotyMat = std({ map: cotyTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.7 });
  const leafDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: leafTex, alphaTest: 0.5 });
  const cotyDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: cotyTex, alphaTest: 0.5 });
  const leafGeo = leafGeometry();
  const dmy = new THREE.Object3D(), col = new THREE.Color();

  // Diorama tanah: sisi tanah, atas rumput, petak tanah di tengah
  const ground = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.3, 0.45, 64, 1), [std({ map: sideTex }), std({ map: grassTex }), soilMat]);
  ground.position.y = -0.225; ground.receiveShadow = true; root.add(ground);
  const patch = new THREE.Mesh(new THREE.CircleGeometry(0.72, 40), soilMat);
  patch.rotation.x = -Math.PI / 2; patch.position.y = 0.003; patch.receiveShadow = true; root.add(patch);
  const mound = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), soilMat);
  mound.scale.y = 0.26; mound.receiveShadow = true; root.add(mound);
  const R0 = rng(21);
  for (let i = 0; i < 9; i++) {
    const a = R0() * 7, d = 0.35 + R0() * 0.4;
    const p = new THREE.Mesh(new THREE.DodecahedronGeometry(0.025 + R0() * 0.035, 0), std({ color: R0() < 0.5 ? '#8d877c' : '#a59a86' }));
    p.position.set(Math.cos(a) * d, 0.012, Math.sin(a) * d); p.scale.y = 0.6; p.castShadow = true; root.add(p);
  }

  // Rumput: satu InstancedMesh
  const bladeGeo = new THREE.PlaneGeometry(0.035, 0.2, 1, 3); bladeGeo.translate(0, 0.1, 0);
  {
    const p = bladeGeo.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i) / 0.2; p.setX(i, p.getX(i) * (1 - y)); p.setZ(i, -0.05 * y * y); }
    bladeGeo.computeVertexNormals();
  }
  const blades = new THREE.InstancedMesh(bladeGeo, std({ side: THREE.DoubleSide, roughness: 0.8 }), 900);
  const gDark = new THREE.Color('#4f7d1e'), gLight = new THREE.Color('#9cc24f');
  for (let i = 0; i < 900; i++) {
    const a = R0() * Math.PI * 2, d = 0.78 + Math.sqrt(R0()) * 1.55;
    dmy.position.set(Math.cos(a) * d, 0, Math.sin(a) * d); dmy.rotation.set((R0() - 0.5) * 0.5, R0() * 7, (R0() - 0.5) * 0.5);
    dmy.scale.setScalar(0.6 + R0() * 0.9); dmy.updateMatrix(); blades.setMatrixAt(i, dmy.matrix);
    blades.setColorAt(i, col.copy(gDark).lerp(gLight, R0()));
  }
  root.add(blades);
  const disc = shadowDisc(3.2); disc.position.y = -0.46; root.add(disc);

  // Tahap 0: benih tertanam setengah
  const seedM = new THREE.Group();
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push(new THREE.Vector2(0.095 * Math.pow(Math.sin(Math.PI * t), 0.75) * (1 - 0.15 * t), (t - 0.5) * 0.3)); }
  const seedMat = std({ map: seedTex, roughness: 0.55 });
  const seed = new THREE.Mesh(new THREE.LatheGeometry(pts, 20), seedMat);
  seed.scale.z = 0.75; seed.rotation.set(0.2, 0.4, 1.25); seed.position.y = 0.15; seed.castShadow = true; seedM.add(seed);
  const rootCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.13, 0.12, 0), new THREE.Vector3(-0.2, 0.1, 0.02), new THREE.Vector3(-0.24, 0.05, 0.05)]);
  seedM.add(new THREE.Mesh(new THREE.TubeGeometry(rootCurve, 10, 0.01, 6), std({ color: '#efe6cf', roughness: 0.6 })));
  root.add(seedM);

  // Tahap 1: tunas (batang melengkung, dua kotiledon, dua daun sejati, sisa kulit benih)
  const sproutM = new THREE.Group();
  const stemCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.1, 0), new THREE.Vector3(0.03, 0.3, 0.01), new THREE.Vector3(-0.01, 0.48, 0), new THREE.Vector3(0.01, 0.6, 0)]);
  const stemM = new THREE.Mesh(new THREE.TubeGeometry(stemCurve, 20, 0.016, 8), std({ color: '#9cc45a', roughness: 0.6 }));
  stemM.castShadow = true; sproutM.add(stemM);
  const addLeaf = (mat: THREE.Material, depth: THREE.Material, pos: THREE.Vector3, rx: number, ry: number, s: number) => {
    const l = new THREE.Mesh(leafGeo, mat); l.position.copy(pos); l.rotation.set(rx, ry, 0, 'YXZ');
    l.scale.set(s * 0.75, s, s); l.castShadow = true; l.customDepthMaterial = depth; sproutM.add(l);
  };
  const top = new THREE.Vector3(0.01, 0.6, 0);
  addLeaf(cotyMat, cotyDepth, top, -1.15, 0.2, 0.24); addLeaf(cotyMat, cotyDepth, top, -1.15, 0.2 + Math.PI, 0.24);
  addLeaf(leafMat, leafDepth, top, -0.35, 1.7, 0.13); addLeaf(leafMat, leafDepth, top, -0.35, 1.7 + Math.PI, 0.11);
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 8, 0, Math.PI), seedMat);
  shell.scale.set(1, 1.5, 0.7); shell.rotation.set(-1.2, 0.6, 0.3); shell.position.set(0.16, 0.13, 0.1); shell.castShadow = true; sproutM.add(shell);
  root.add(sproutM);

  // Pohon bercabang: batang digabung jadi satu geometri, daun satu InstancedMesh.
  function makeTree(o: TreeOpts) {
    const R = rng(o.seed), geos: THREE.BufferGeometry[] = [], tips: THREE.Vector3[] = [];
    const up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), m4 = new THREE.Matrix4(), one = new THREE.Vector3(1, 1, 1);
    function grow(start: THREE.Vector3, dir: THREE.Vector3, len: number, rad: number, d: number) {
      const g = new THREE.CylinderGeometry(rad * 0.66, rad, len, 7, 1); g.translate(0, len / 2, 0);
      q.setFromUnitVectors(up, dir); m4.compose(start, q, one); g.applyMatrix4(m4); geos.push(g);
      const end = start.clone().addScaledVector(dir, len);
      if (d <= 1) tips.push(start.clone().addScaledVector(dir, len * 0.5));
      if (d === 0) { tips.push(end); return; }
      const n = d === o.depth ? o.trunkSplits : 2 + (R() < o.extra ? 1 : 0);
      const a0 = R() * 7;
      for (let k = 0; k < n; k++) {
        const a = a0 + (k * Math.PI * 2) / n + (R() - 0.5) * 0.6;
        const axis = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).cross(dir).normalize();
        const nd = dir.clone().applyAxisAngle(axis, o.spread * (0.6 + 0.6 * R())).lerp(up, o.upward).normalize();
        grow(end, nd, len * (0.66 + 0.14 * R()), rad * 0.64, d - 1);
      }
    }
    grow(new THREE.Vector3(0, -0.02, 0), new THREE.Vector3((R() - 0.5) * 0.1, 1, (R() - 0.5) * 0.1).normalize(), o.len, o.radius, o.depth);
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(merge(geos), barkMat); trunk.castShadow = true; trunk.receiveShadow = true; tree.add(trunk);
    const center = new THREE.Vector3(); tips.forEach((t) => center.add(t)); center.divideScalar(tips.length);
    let maxD = 0; tips.forEach((t) => { maxD = Math.max(maxD, t.distanceTo(center)); });
    const leaves = new THREE.InstancedMesh(leafGeo, leafMat, tips.length * o.perTip);
    leaves.castShadow = true; leaves.receiveShadow = true; leaves.customDepthMaterial = leafDepth;
    const dk = new THREE.Color(o.dark || '#2f5a14'), lt = new THREE.Color(o.light || '#a6cf55'), out = new THREE.Vector3();
    let i = 0;
    for (const t of tips) for (let k = 0; k < o.perTip; k++) {
      const p = t.clone().add(new THREE.Vector3(R() - 0.5, (R() - 0.3) * 0.8, R() - 0.5).multiplyScalar(o.cluster));
      out.copy(p).sub(center).normalize().add(new THREE.Vector3(R() - 0.5, R(), R() - 0.5).multiplyScalar(0.8)).normalize();
      dmy.position.copy(p); dmy.rotation.set(0, 0, 0); dmy.lookAt(p.clone().add(out)); dmy.rotateZ(R() * 7); dmy.rotateX(-0.3 - R() * 0.6);
      const s = o.leaf * (0.7 + R() * 0.6); dmy.scale.set(s * 0.6, s, s); dmy.updateMatrix(); leaves.setMatrixAt(i, dmy.matrix);
      // Daun di dalam tajuk lebih gelap, seperti bayangan alami.
      const shade = 0.25 + 0.75 * Math.min(1, p.distanceTo(center) / maxD) * (p.y > center.y ? 1 : 0.84);
      leaves.setColorAt(i, col.copy(dk).lerp(lt, shade * (0.7 + R() * 0.3))); i++;
    }
    tree.add(leaves);
    return tree;
  }

  const youngM = makeTree({ seed: 3, depth: 3, trunkSplits: 2, extra: 0.3, len: 0.55, radius: 0.035, spread: 0.55, upward: 0.25, perTip: 12, cluster: 0.18, leaf: 0.17 });
  root.add(youngM);
  const bigM = makeTree({ seed: 12, depth: 4, trunkSplits: 3, extra: 0.35, len: 0.95, radius: 0.12, spread: 0.6, upward: 0.18, perTip: 22, cluster: 0.36, leaf: 0.2 });
  root.add(bigM);
  const forestM = new THREE.Group();
  ([[1.75, 0.6, 0.45, 31], [1.85, 2.0, 0.55, 44], [1.6, 3.3, 0.4, 57], [1.9, 4.4, 0.5, 68], [1.65, 5.5, 0.42, 79]] as const).forEach(([d, a, s, sd], i) => {
    const t = makeTree({ seed: sd, depth: 3, trunkSplits: i % 2 ? 2 : 3, extra: 0.3, len: 0.9, radius: 0.09, spread: 0.5, upward: 0.25, perTip: 20, cluster: 0.32, leaf: 0.24, dark: i % 2 ? '#2a5216' : '#36601a', light: i % 2 ? '#93c14a' : '#b2d45e' });
    t.position.set(Math.cos(a) * d, 0, Math.sin(a) * d); t.rotation.y = a; t.userData.s = s; t.scale.setScalar(s); forestM.add(t);
  });
  root.add(forestM);

  const models = [seedM, sproutM, youngM, bigM, forestM];
  models.forEach((m) => { m.userData.k = 0; m.visible = false; });
  const on = (i: number) => [target === 0, target === 1, target === 2, target >= 3, target === 4][i];
  const VIEWS = [[1.0, 0.1, 1.9], [1.0, 0.32, 2.3], [1.5, 0.8, 3.9], [2.4, 1.7, 7.2], [3.6, 1.4, 9.2]];
  const view = VIEWS[target].slice();

  // Geser horizontal memutar diorama; scroll vertikal tetap jalan (touch-action: pan-y).
  let drag = 0, x0: number | null = null, lx = 0, lt = 0;
  const down = (e: PointerEvent) => { x0 = lx = e.clientX; lt = performance.now(); box.setPointerCapture(e.pointerId); };
  const move = (e: PointerEvent) => {
    if (x0 === null) return;
    const dx = e.clientX - lx, dt = Math.max(1, performance.now() - lt);
    if (Math.abs(e.clientX - x0) > 6) onUserStage?.();
    root.rotation.y += dx * 0.012; drag = (dx / dt) * 0.2; lx = e.clientX; lt = performance.now();
  };
  const up = () => { x0 = null; };
  box.addEventListener('pointerdown', down); box.addEventListener('pointermove', move);
  box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
  root.rotation.y = -0.5;

  const fit = () => { const w = box.clientWidth, h = box.clientHeight; if (!w || !h) return; r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
  const ro = new ResizeObserver(fit); ro.observe(box); fit();
  let visible = true;
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }); io.observe(box);

  const t0 = performance.now();
  let raf = 0;
  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    if (!visible || document.hidden) return;
    const time = (now - t0) / 1000;
    drag *= 0.93; root.rotation.y += (reduce ? 0 : 0.0025) + drag;
    models.forEach((m, i) => {
      const k = (m.userData.k += ((on(i) ? 1 : 0) - m.userData.k) * (reduce ? 1 : 0.05));
      m.visible = k > 0.01;
      if (m === forestM) m.children.forEach((t, j) => { const kk = clamp(k * 1.6 - j * 0.12, 0, 1); t.scale.setScalar(Math.max(0.001, t.userData.s * ss(0, 1, kk))); t.visible = kk > 0.01; });
      else { const w = Math.max(0.001, Math.pow(k, 0.7)); m.scale.set(w, Math.max(0.001, k), w); }
    });
    const sway = reduce ? 0 : Math.sin(time * 1.3) * 0.012;
    sproutM.rotation.z = sway * 2; youngM.rotation.z = sway * 1.5; bigM.rotation.z = sway * 0.6;
    const vt = VIEWS[target];
    for (let i = 0; i < 3; i++) view[i] += (vt[i] - view[i]) * (reduce ? 1 : 0.05);
    cam.position.set(0, view[0], view[2]); cam.lookAt(0, view[1], 0);
    r.render(scene, cam);
  };
  raf = requestAnimationFrame(tick);

  return {
    setStage(i: number) { target = clamp(i, 0, 4); },
    destroy() {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
      box.removeEventListener('pointerdown', down); box.removeEventListener('pointermove', move);
      box.removeEventListener('pointerup', up); box.removeEventListener('pointercancel', up);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        mats.forEach((mt) => { const map = (mt as THREE.MeshStandardMaterial).map; if (map) map.dispose(); mt.dispose(); });
      });
      r.dispose(); r.forceContextLoss(); r.domElement.remove();
    },
  };
}
