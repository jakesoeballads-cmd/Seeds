import * as THREE from 'three';

/**
 * Globe Bumi 3D untuk latar hero beranda: citra satelit NASA Blue Marble (domain publik),
 * awan yang bergerak, pantulan matahari di laut, dan pendaran atmosfer. Saat dibuka globe
 * menghadap Indonesia. Animasi berhenti saat tidak terlihat.
 */
export type GlobeScene = { destroy(): void };

const TEX = '/img/globe/';

export function hasWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

export function mountGlobe(box: HTMLElement, dragArea: HTMLElement): GlobeScene {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  r.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  r.domElement.style.display = 'block'; r.domElement.style.width = '100%'; r.domElement.style.height = '100%';
  box.appendChild(r.domElement);

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  scene.add(new THREE.AmbientLight(0xbcd0e8, 0.35));
  const sun = new THREE.DirectionalLight(0xfff6e8, 3.2); sun.position.set(-4, 1.8, 4.5); scene.add(sun);

  const loader = new THREE.TextureLoader();
  const load = (name: string, srgb = false) => {
    const t = loader.load(TEX + name); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  };
  const tilt = new THREE.Group(); tilt.rotation.set(-0.12, 0, -0.06); scene.add(tilt);
  const spin = new THREE.Group(); tilt.add(spin);
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.MeshPhongMaterial({
    map: load('bumi.jpg', true), specularMap: load('air.jpg'), specular: new THREE.Color(0x4a6a8a), shininess: 22,
    bumpMap: load('relief.jpg'), bumpScale: 4,
  }));
  spin.add(earth);
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(1.012, 96, 64), new THREE.MeshPhongMaterial({
    color: 0xffffff, alphaMap: load('awan.jpg'), transparent: true, depthWrite: false, opacity: 0.85,
  }));
  spin.add(clouds);
  // Pendaran atmosfer di tepi globe, memudar ke nol di tepi luar.
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.14, 64, 48), new THREE.ShaderMaterial({
    side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
    vertexShader: 'varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vN; void main(){ float d = -dot(vN, vec3(0.0, 0.0, 1.0)); float i = pow(clamp(d / 0.5, 0.0, 1.0), 3.0) * 0.9; gl_FragColor = vec4(0.42, 0.68, 1.0, 1.0) * i; }',
  }));
  tilt.add(atmo);

  // Hadapkan Indonesia (±118° BT) ke kamera.
  const phi = ((118 + 180) / 360) * Math.PI * 2;
  spin.rotation.y = -Math.atan2(-Math.cos(phi), Math.sin(phi));

  // Geser di mana saja pada hero untuk memutar; tombol dan tautan tetap bisa diketuk.
  let drag = 0, x0: number | null = null, lx = 0, lt = 0;
  const down = (e: PointerEvent) => {
    if ((e.target as Element).closest('a, button, input, select')) return;
    x0 = lx = e.clientX; lt = performance.now(); dragArea.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent) => {
    if (x0 === null) return;
    const dx = e.clientX - lx, dt = Math.max(1, performance.now() - lt);
    spin.rotation.y += dx * 0.008; drag = (dx / dt) * 0.12; lx = e.clientX; lt = performance.now();
  };
  const up = () => { x0 = null; };
  dragArea.addEventListener('pointerdown', down); dragArea.addEventListener('pointermove', move);
  dragArea.addEventListener('pointerup', up); dragArea.addEventListener('pointercancel', up);

  // Globe besar: jari-jarinya mengikuti ukuran hero, pusatnya sedikit di bawah tengah.
  const fit = () => {
    const w = box.clientWidth, h = box.clientHeight; if (!w || !h) return;
    r.setSize(w, h, false); cam.aspect = w / h;
    const rp = Math.min(Math.max(0.62 * w, 0.46 * h), 0.62 * h);
    const t = Math.tan((cam.fov * Math.PI) / 360);
    cam.position.z = h / (2 * rp * t); cam.updateProjectionMatrix();
    tilt.position.y = -(0.14 * h) / (h / (2 * cam.position.z * t));
  };
  const ro = new ResizeObserver(fit); ro.observe(box); fit();
  let visible = true;
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }); io.observe(box);

  let raf = 0;
  const tick = () => {
    raf = requestAnimationFrame(tick);
    if (!visible || document.hidden) return;
    drag *= 0.94; spin.rotation.y += (reduce ? 0 : 0.0012) + drag;
    if (!reduce) clouds.rotation.y += 0.0003;
    r.render(scene, cam);
  };
  raf = requestAnimationFrame(tick);

  return {
    destroy() {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
      dragArea.removeEventListener('pointerdown', down); dragArea.removeEventListener('pointermove', move);
      dragArea.removeEventListener('pointerup', up); dragArea.removeEventListener('pointercancel', up);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        mats.forEach((mt) => {
          const p = mt as THREE.MeshPhongMaterial;
          [p.map, p.specularMap, p.bumpMap, p.alphaMap].forEach((t) => t?.dispose());
          mt.dispose();
        });
      });
      r.dispose(); r.forceContextLoss(); r.domElement.remove();
    },
  };
}
