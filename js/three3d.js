/* ARDOR 3D — dựng mô hình 3D cho từng sản phẩm từ ảnh treo móc (khung 600x800).
   Cách làm: lấy đường viền áo từ kênh alpha của ảnh, tính khoảng cách từ mỗi điểm
   tới mép (distance transform) rồi "bơm phồng" thành khối tròn ở mép, phẳng dần
   ở giữa. Mặt trước dán ảnh mặt trước, mặt sau dán ảnh mặt sau (lật ngang).
   Sản phẩm chỉ có một ảnh thì mặt sau là vải trơn lấy màu từ chính ảnh đó.
   Hai nơi dùng mô hình: rail (một canvas WebGL vẽ mọi chiếc áo theo đúng vị trí
   của rail 2D) và khung chi tiết (kéo xoay 360°). Lưới sản phẩm giữ ảnh 2D.
   Nạp three.js lỗi hoặc máy không có WebGL thì file này không làm gì, web giữ 2D. */
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js";

const FW = 600, FH = 800;      // khung ảnh, đơn vị = px của khung
const GW = 120, GH = 160;      // lưới dựng hình (ô 5px)
const PIVOT = 0.015;           // tâm đung đưa (đỉnh móc) theo chiều cao khung
const DEG = Math.PI / 180;
/* Nửa bề dày ở giữa áo (px khung) theo dòng sản phẩm */
const DEPTH = { hoodie: 40, zip: 40, crew: 34, tee: 28, tank: 24, shirt: 24, jeans: 22, pants: 28, coat: 38, jacket: 32 };
const ROUND = 56;              // bề rộng phần mép bo tròn

const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- dựng hình ---------- */
function loadImage(url) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = url;
  });
}

/* alpha tại từng đỉnh lưới (GW+1)x(GH+1) */
function sampleAlpha(img) {
  const w = GW + 1, h = GH + 1;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.imageSmoothingQuality = "high";
  g.drawImage(img, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data;
  const a = new Float32Array(w * h);
  for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3] / 255;
  return a;
}

function heightField(a, depth) {
  const W = GW + 1, H = GH + 1, N = W * H, INF = 1e9, S2 = Math.SQRT2;
  const dist = new Float32Array(N);
  // Chỉ bắt đầu phồng ở chỗ chắc chắn là áo (alpha cao). Dải mép ngoài giữ phẳng z = 0
  // để mặt trước và mặt sau khép kín đúng chỗ ảnh bị cắt trong suốt, không hở khe khi nhìn nghiêng.
  for (let i = 0; i < N; i++) dist[i] = a[i] > 0.94 ? INF : 0;
  // chamfer 2 lượt (1, √2): khoảng cách tới điểm ngoài áo gần nhất
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!dist[i]) continue;
    let v = dist[i];
    if (x > 0) v = Math.min(v, dist[i - 1] + 1);
    if (y > 0) {
      v = Math.min(v, dist[i - W] + 1);
      if (x > 0) v = Math.min(v, dist[i - W - 1] + S2);
      if (x < W - 1) v = Math.min(v, dist[i - W + 1] + S2);
    }
    if (x === 0 || y === 0 || x === W - 1 || y === H - 1) v = Math.min(v, 1);
    dist[i] = v;
  }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    const i = y * W + x;
    if (!dist[i]) continue;
    let v = dist[i];
    if (x < W - 1) v = Math.min(v, dist[i + 1] + 1);
    if (y < H - 1) {
      v = Math.min(v, dist[i + W] + 1);
      if (x < W - 1) v = Math.min(v, dist[i + W + 1] + S2);
      if (x > 0) v = Math.min(v, dist[i + W - 1] + S2);
    }
    dist[i] = v;
  }
  // mặt cắt: tròn ở mép, phẳng dần vào giữa; chi tiết mảnh (móc) chỉ dày bằng bề ngang của nó
  const cell = FW / GW;
  let h = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const dp = dist[i] * cell - cell * 1.2;
    if (dp <= 0) continue;
    const t = Math.min(dp / ROUND, 1);
    h[i] = Math.min(dp * 0.85, depth * Math.sqrt(1 - (1 - t) * (1 - t)));
  }
  // làm mịn để không lộ bậc thang của lưới
  for (let pass = 0; pass < 2; pass++) {
    const o = new Float32Array(N);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!h[i]) continue;
      let s = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        s += h[yy * W + xx]; n++;
      }
      o[i] = s / n;
    }
    h = o;
  }
  return h;
}

/* Một mặt (trước: side = 1, sau: side = -1). Gốc toạ độ ở giữa mép trên của khung. */
function surface(a, h, side) {
  const W = GW + 1;
  const idx = new Int32Array(W * (GH + 1)).fill(-1);
  const pos = [], uv = [], index = [];
  const vert = (x, y) => {
    const i = y * W + x;
    if (idx[i] < 0) {
      idx[i] = pos.length / 3;
      pos.push((x / GW - 0.5) * FW, -(y / GH) * FH, side * h[i]);
      uv.push(side > 0 ? x / GW : 1 - x / GW, 1 - y / GH);
    }
    return idx[i];
  };
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const i = y * W + x;
    if (Math.max(a[i], a[i + 1], a[i + W], a[i + W + 1]) < 0.05) continue;
    const v00 = vert(x, y), v10 = vert(x + 1, y), v01 = vert(x, y + 1), v11 = vert(x + 1, y + 1);
    if (side > 0) index.push(v00, v01, v10, v10, v01, v11);
    else index.push(v00, v10, v01, v10, v11, v01);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/* Ảnh dán mặt sau. Mặt sau đọc ảnh theo toạ độ lật ngang (u = 1 - x), nên mọi lớp lấy
   từ ảnh trước phải lật ngang ở đây thì đường viền mới trùng khối 3D (không thì mép
   lộ răng cưa của lưới). Lớp nền là vải trơn: ảnh trước làm mờ mạnh. Có ảnh mặt sau
   (chụp từ phía sau, đã đúng chiều) thì phủ lên trên, rồi cắt theo đường viền lật. */
function backTexture(front, back) {
  const c = document.createElement("canvas");
  const w = c.width = front.naturalWidth, h = c.height = front.naturalHeight;
  const g = c.getContext("2d");
  const mirrored = (draw) => { g.save(); g.translate(w, 0); g.scale(-1, 1); draw(); g.restore(); };
  g.filter = "blur(" + Math.round(w / 40) + "px)";
  mirrored(() => g.drawImage(front, 0, 0));
  g.filter = "none";
  g.globalCompositeOperation = "destination-over";
  g.fillStyle = averageColor(front);
  g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = "source-over";
  if (back) {
    // ăn mòn mép ảnh sau vài px: viền sáng còn sót lúc tách nền sẽ lộ rõ trên nền vải tối
    const t = document.createElement("canvas");
    t.width = w; t.height = h;
    const tg = t.getContext("2d");
    tg.drawImage(back, 0, 0, w, h);
    tg.globalCompositeOperation = "destination-in";
    tg.filter = "blur(" + Math.max(2, Math.round(w / 300)) + "px)";
    tg.drawImage(back, 0, 0, w, h);
    tg.drawImage(back, 0, 0, w, h);
    g.drawImage(t, 0, 0);
  }
  g.globalCompositeOperation = "destination-in";
  mirrored(() => g.drawImage(front, 0, 0));
  g.globalCompositeOperation = "source-over";
  return c;
}

function averageColor(img) {
  const c = document.createElement("canvas");
  c.width = 24; c.height = 32;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(img, 0, 0, 24, 32);
  const d = g.getImageData(0, 0, 24, 32).data;
  let r = 0, gg = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) {
    const w = d[i + 3] / 255;
    r += d[i] * w; gg += d[i + 1] * w; b += d[i + 2] * w; n += w;
  }
  return n ? `rgb(${r / n | 0},${gg / n | 0},${b / n | 0})` : "#888";
}

function texture(src) {
  const t = new THREE.Texture(src);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}
/* Vải mờ: chỉ khuếch tán, không bóng (vật liệu có phản xạ sẽ loá trắng ở mép khi nhìn xiên) */
function material(tex) {
  return new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5 });
}

const models = new Map();

async function build({ id, type, front, back }) {
  const fImg = await loadImage(front);
  const bImg = back ? await loadImage(back) : null;
  const a = sampleAlpha(fImg);
  const h = heightField(a, DEPTH[type] || 30);
  models.set(id, {
    geoF: surface(a, h, 1),
    geoB: surface(a, h, -1),
    matF: material(texture(fImg)),
    matB: material(texture(backTexture(fImg, bImg)))
  });
}

function makeModel(id, ownMaterials) {
  const m = models.get(id);
  const g = new THREE.Group();
  if (!m) return g;
  const mf = ownMaterials ? m.matF.clone() : m.matF;
  const mb = ownMaterials ? m.matB.clone() : m.matB;
  if (ownMaterials) [mf, mb].forEach((x) => { x.transparent = true; });
  g.add(new THREE.Mesh(m.geoF, mf), new THREE.Mesh(m.geoB, mb));
  g.userData = { id, mats: [mf, mb] };
  return g;
}

/* Ánh sáng chung. Tổng ánh sáng chiếu thẳng mặt trước ≈ 1 để màu ảnh giữ nguyên,
   phần mép nghiêng khỏi đèn tối dần nên áo có khối. */
function addLights(scene) {
  scene.add(new THREE.AmbientLight(0xffffff, 1.3));
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb9b6c2, 0.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(-0.4, 0.6, 1);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 0.5);
  rim.position.set(0.7, 0.3, -1);
  scene.add(rim);
}

function makeRenderer(canvas, maxDpr) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
  r.setClearColor(0x000000, 0);
  return r;
}

/* ================= RAIL ================= */
const rail = {
  renderer: null, scene: null, camera: null, groups: [], w: 0, h: 0,

  mount(el) {
    const c = document.createElement("canvas");
    c.className = "rail__gl";
    c.setAttribute("aria-hidden", "true");
    el.insertBefore(c, el.querySelector("[data-track]"));
    this.renderer = makeRenderer(c, 1.75);
    this.scene = new THREE.Scene();
    addLights(this.scene);
    this.camera = new THREE.PerspectiveCamera(16, 1, 10, 20000);
  },

  /* st: trạng thái rail 2D trong app.js (vị trí, góc xoay, độ phóng của từng chiếc) */
  render(st) {
    if (!this.renderer) return;
    if (st.vw !== this.w || st.vh !== this.h) {
      this.w = st.vw; this.h = st.vh;
      this.renderer.setSize(st.vw, st.vh, false);
      const dist = (st.vh / 2) / Math.tan(8 * DEG);
      this.camera.aspect = st.vw / st.vh;
      this.camera.position.set(st.vw / 2, -st.vh / 2, dist);
      this.camera.lookAt(st.vw / 2, -st.vh / 2, 0);
      this.camera.far = dist * 3;
      this.camera.updateProjectionMatrix();
    }
    const k = st.H / FH;
    st.items.forEach((it, i) => {
      let g = this.groups[i];
      if (!g || g.id !== it.p.id) {
        if (g) this.scene.remove(g.outer);
        const turn = makeModel(it.p.id, true);
        const outer = new THREE.Group();
        outer.add(turn);
        this.scene.add(outer);
        g = this.groups[i] = { id: it.p.id, outer, turn, op: -1 };
      }
      const show = it.vis && !it.el.classList.contains("is-away");
      g.outer.visible = show;
      if (!show) return;
      g.outer.position.set(it.x, -(it.y + PIVOT * st.H), 0);
      g.outer.rotation.z = -(it.sw + it.idle) * DEG;
      g.turn.position.y = PIVOT * st.H;
      g.turn.rotation.y = it.ry * DEG;
      g.turn.scale.setScalar(k * it.s);
      const op = it.op < 0 ? 1 : it.op;
      if (op !== g.op) { g.turn.userData.mats.forEach((m) => { m.opacity = op; }); g.op = op; }
    });
    this.renderer.render(this.scene, this.camera);
  }
};

/* ================= KHUNG CHI TIẾT: kéo xoay 360° ================= */
const detail = {
  renderer: null, scene: null, camera: null, holder: null, model: null, canvas: null,
  yaw: 0, vel: 0, target: 0, spring: true, drag: null, sway: 0, swayV: 0,
  running: false, last: 0, side: "front", onFacing: null, w: 0, h: 0,

  mount(figure, onFacing) {
    const c = this.canvas = document.createElement("canvas");
    c.className = "detail__gl";
    c.setAttribute("aria-label", "Kéo để xoay sản phẩm 360°");
    figure.appendChild(c);
    this.onFacing = onFacing;
    this.renderer = makeRenderer(c, 2);
    this.scene = new THREE.Scene();
    addLights(this.scene);
    this.camera = new THREE.PerspectiveCamera(18, 0.75, 10, 20000);
    const dist = (FH / 2) / Math.tan(9 * DEG);
    this.camera.position.set(0, -FH / 2, dist);
    this.camera.lookAt(0, -FH / 2, 0);
    this.holder = new THREE.Group();   // tâm đung đưa ở đỉnh móc
    this.holder.position.y = -PIVOT * FH;
    this.scene.add(this.holder);

    c.addEventListener("pointerdown", (e) => {
      this.drag = { x: e.clientX, t: performance.now() };
      this.spring = false;
      this.vel = 0;
      c.setPointerCapture(e.pointerId);
    });
    c.addEventListener("pointermove", (e) => {
      if (!this.drag) return;
      const now = performance.now(), dx = e.clientX - this.drag.x;
      const step = dx * 0.011;
      this.yaw += step;
      this.vel = this.vel * 0.5 + (step / Math.max(0.008, (now - this.drag.t) / 1000)) * 0.5;
      this.drag.x = e.clientX; this.drag.t = now;
    });
    const end = () => { this.drag = null; };
    c.addEventListener("pointerup", end);
    c.addEventListener("pointercancel", end);
  },

  size() {
    const r = this.canvas.getBoundingClientRect();
    if (r.width && (r.width !== this.w || r.height !== this.h)) {
      this.w = r.width; this.h = r.height;
      this.renderer.setSize(r.width, r.height, false);
      this.camera.aspect = r.width / r.height;
      this.camera.updateProjectionMatrix();
    }
  },

  /* view: "front" | "back". Mở ra thì xoay hé một chút để khách thấy đây là 3D. */
  show(id, view) {
    if (this.model) this.holder.remove(this.model);
    this.model = makeModel(id, false);
    this.model.position.y = PIVOT * FH;
    this.holder.add(this.model);
    this.yaw = this.target = view === "back" ? Math.PI : 0;
    this.vel = reduce ? 0 : 3.4;
    this.spring = true;
    this.side = view;
    this.sway = this.swayV = 0;
    this.size();
    if (!this.running) { this.running = true; this.last = performance.now(); requestAnimationFrame((t) => this.tick(t)); }
  },

  face(view) {
    const base = view === "back" ? Math.PI : 0;
    this.target = base + 2 * Math.PI * Math.round((this.yaw - base) / (2 * Math.PI));
    this.spring = true;
  },

  facing() { return Math.cos(this.yaw) >= 0 ? "front" : "back"; },

  /* Xoay về mặt gần nhất rồi báo lại mặt đó (để đổi sang ảnh 2D khi đóng khung) */
  settle() {
    const view = this.facing();
    this.face(view);
    return new Promise((res) => {
      const t0 = performance.now();
      const check = () => {
        if ((Math.abs(this.target - this.yaw) < 0.02 && Math.abs(this.vel) < 0.1) || performance.now() - t0 > 450) res(view);
        else setTimeout(check, 30);
      };
      check();
    });
  },

  hide() { this.running = false; },

  tick(now) {
    if (!this.running) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (!this.drag) {
      if (this.spring) {
        this.vel += ((this.target - this.yaw) * 24 - this.vel * 7.5) * dt;
      } else {
        this.vel *= Math.exp(-dt * 2.4);
        if (Math.abs(this.vel) < 0.05) { this.spring = true; this.target = this.yaw; }
      }
      this.yaw += this.vel * dt;
    }
    // áo đung đưa nhẹ theo tốc độ xoay
    const st = Math.max(-0.12, Math.min(0.12, -this.vel * 0.025));
    this.swayV += ((st - this.sway) * 30 - this.swayV * 3) * dt;
    this.sway += this.swayV * dt;
    this.model.rotation.y = this.yaw;
    this.holder.rotation.z = this.sway + (reduce ? 0 : 0.008 * Math.sin(now / 900));
    const side = this.facing();
    if (side !== this.side) { this.side = side; if (this.onFacing) this.onFacing(side); }
    this.size();
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame((t) => this.tick(t));
  }
};

/* ================= GIAO TIẾP VỚI app.js ================= */
function webgl() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch (e) { return false; }
}

if (webgl()) {
  window.Ardor3D = {
    /* list: [{id, type, front, back}] — URL ảnh đã treo móc (back có thể null) */
    load: (list) => Promise.all(list.map(build)),
    rail, detail
  };
  window.dispatchEvent(new Event("ardor3d"));
}
