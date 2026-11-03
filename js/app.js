/* ARDOR — Scene Rail
   1) Rail: áo treo nghiêng trên thanh cong, tự trôi; rê chuột vào áo nào thì áo đó
      xoay mặt ra, phóng to, hai bên dạt ra; kéo/lăn ngang để lướt, áo đung đưa theo quán tính.
   2) Bấm áo: áo bay ra khung chi tiết (FLIP), chọn mặt trước/sau, chọn size, thêm vào giỏ.
   3) Giỏ hàng trượt từ phải, đẩy trang sang trái; lưu trong localStorage.
   4) Lưới toàn bộ sản phẩm + tìm kiếm. */
(function () {
  "use strict";

  var P = window.ARDOR_PRODUCTS;
  var SIZES = window.ARDOR_SIZES;
  var COPY = window.ARDOR_COPY;
  var G = window.ArdorGarments;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var root = document.documentElement;
  root.classList.add("js");

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function mod(a, n) { return ((a % n) + n) % n; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function damp(dt, k) { return 1 - Math.exp(-dt * k); }
  /* Gọi fn khi hoạt ảnh xong. Tab chạy nền có thể không bao giờ phát onfinish,
     nên có hẹn giờ dự phòng: thao tác (đóng khung, thêm giỏ) không bị kẹt. */
  function whenDone(anim, ms, fn) {
    var done = false;
    function go() { if (!done) { done = true; fn(); } }
    anim.onfinish = go;
    setTimeout(go, ms + 150);
  }

  var vnd = new Intl.NumberFormat("vi-VN");
  function money(v) { return vnd.format(v) + "₫"; }
  function short(v) { return vnd.format(Math.round(v / 1000)) + "K"; }

  var byId = {};
  P.forEach(function (p, i) { p.index = i; byId[p.id] = p; });

  var store = {
    get: function (k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* chế độ riêng tư */ } }
  };

  /* ================= ẢNH ================= */
  var IMG = {};
  var backJobs = {};

  function frontOf(p) { return IMG[p.id] ? IMG[p.id].front : ""; }
  function backOf(p) {
    if (!backJobs[p.id]) {
      backJobs[p.id] = G.back(p).then(function (u) {
        IMG[p.id].back = u;
        return u;
      });
    }
    return backJobs[p.id];
  }

  function loadFronts() {
    return Promise.all(P.map(function (p) {
      return G.front(p).then(function (u) {
        IMG[p.id] = { front: u, back: null };
      });
    }));
  }

  /* ================= TOAST ================= */
  var toastEl = $("[data-toast]"), toastT;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("is-on");
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove("is-on"); }, 2600);
  }

  /* ================= RAIL ================= */
  var rail = {
    el: $("[data-rail]"),
    track: $("[data-track]"),
    shade: $("[data-rail-shade]"), chainCv: $("[data-rail-chain]"), chainImg: null,
    // đèn ảo cho bóng đổ: vị trí đích (theo chuột trong hero) và vị trí đang trôi tới
    lightT: null, light: { x: 0, y: 0, on: false },
    items: [], copies: 0,
    offset: 0, vel: 0, auto: 26, seek: 0,
    hover: null, hold: false, drag: null, spread: 0,
    pointer: { x: 0, y: 0, inside: false, touch: false },
    W: 0, H: 0, gap: 0, vw: 0, vh: 0, railY: 0, sag: 0, total: 0, margin: 0, persp: 0,
    start: 0, ready: false
  };
  var nowBox = $(".now"), nowName = $("[data-now-name]"), nowPrice = $("[data-now-price]"), nowItem = $("[data-now-item]");
  var progress = $$("[data-progress]");

  function yAt(x) {
    var t = clamp((x - rail.vw / 2) / (rail.vw / 2), -1.25, 1.25);
    return rail.railY + rail.sag * (1 - t * t);
  }

  function makePiece(p, copy, i) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "piece";
    b.setAttribute("aria-label", p.name + ", " + money(p.price));
    if (copy > 0) { b.tabIndex = -1; b.setAttribute("aria-hidden", "true"); }
    b.innerHTML =
      '<span class="piece__swing"><span class="piece__tag">' + short(p.price) + "</span>" +
      '<span class="piece__turn"><img alt="" draggable="false" src="' + frontOf(p) + '"></span></span>';
    var it = {
      p: p, copy: copy, i: i, el: b,
      swing: b.firstChild, turn: b.firstChild.lastChild,
      ry0: -(66 + Math.random() * 8), ry: 0, s: 1, sw: 0, swv: 0, idle: 0,
      ph: Math.random() * Math.PI * 2,
      x: 0, bx: 0, y: 0, vis: true, z: false, delay: 0, enter: reduce ? 1 : 0, op: -1
    };
    it.ry = it.ry0;
    if (!reduce) { b.style.opacity = 0; it.op = 0; }
    b.addEventListener("focus", function () {
      if (rail.pointer.inside) return;
      setHover(it);
      // đưa áo đang focus vào giữa khung nhìn
      var d = it.x - rail.vw / 2;
      if (Math.abs(d) > rail.vw / 2 - rail.W * 0.6) rail.seek = d;
    });
    b.addEventListener("blur", function () { if (!rail.pointer.inside && rail.hover === it) setHover(null); });
    b.addEventListener("click", function (e) {
      if (e.detail !== 0) return; // chuột đã được xử lý ở pointerup; đây là Enter/Space
      openDetail(it.p, { item: it });
    });
    return it;
  }

  function build(copies) {
    rail.track.innerHTML = "";
    rail.items = [];
    rail.copies = copies;
    var i = 0;
    for (var c = 0; c < copies; c++) {
      for (var k = 0; k < P.length; k++) {
        var it = makePiece(P[k], c, i++);
        rail.items.push(it);
        rail.track.appendChild(it.el);
      }
    }
  }

  function layout() {
    var r = rail.el.getBoundingClientRect();
    rail.vw = r.width;
    rail.vh = r.height;
    var H = clamp(rail.vh * 0.76, 190, 640);
    if (rail.vw < 720) H = Math.min(H, rail.vw * 0.78);
    rail.H = H;
    rail.W = H / G.ratio;
    rail.gap = rail.W * 0.4;
    rail.sag = Math.min(64, rail.vw * 0.034);
    rail.railY = Math.max(12, rail.vh * 0.07);
    rail.margin = rail.gap * 3;
    rail.persp = rail.W * 5.5;
    rail.barW = progress[0].parentNode.clientWidth;

    var need = Math.max(2, Math.ceil((rail.vw + rail.margin * 2 + rail.W) / (P.length * rail.gap)));
    if (need > rail.copies) build(need);
    rail.total = rail.items.length * rail.gap;

    var s = rail.track.style;
    s.setProperty("--gap", rail.gap + "px");
    s.setProperty("--gw", rail.W + "px");
    s.setProperty("--gh", rail.H + "px");

    // Đường võng của rail (parabol): bóng mềm bên dưới + dây xích vẽ dọc theo nó
    var d = "", n = 48;
    for (var j = 0; j <= n; j++) {
      var x = -30 + (rail.vw + 60) * j / n;
      d += (j ? " L" : "M") + x.toFixed(1) + " " + yAt(x).toFixed(1);
    }
    rail.chainH = clamp(rail.H * 0.055, 15, 34);
    rail.shade.setAttribute("d", d);
    rail.shade.setAttribute("pathLength", "1");
    rail.shade.setAttribute("stroke-width", (rail.chainH * 0.5).toFixed(1));
    rail.shade.style.transform = "translateY(" + (rail.chainH * 0.55).toFixed(1) + "px)";
    if (!rail.light.on) { rail.light.x = rail.vw / 2; rail.light.y = -rail.vh * 0.25; rail.light.on = true; }
    drawChain();
  }

  /* Dây xích = một ô ảnh chụp thật (mắt tròn + mắt nghiêng) lặp liên tiếp dọc đường võng.
     Ô rộng hơn nhịp lặp một chút (đầu cong của mắt tròn); ô sau vẽ đè ô trước nên chỗ nối liền.
     Các móc gắn trên xích nên xích trôi cùng áo: lệch theo rail.offset (tự trôi, kéo, lăn). */
  var CHAIN_STEP = 141.5 / 153; // nhịp lặp / bề rộng ảnh ô
  var chain = { ctx: null, w: 0, h: 0, step: 0, phase: -1 };
  // đổi cỡ: dựng lại canvas rồi vẽ
  function drawChain() {
    var cv = rail.chainCv, img = rail.chainImg;
    if (!cv || !img || !img.naturalWidth || !rail.vw) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(rail.vw * dpr);
    cv.height = Math.round(rail.vh * dpr);
    chain.ctx = cv.getContext("2d");
    chain.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    chain.ctx.imageSmoothingQuality = "high";
    chain.h = rail.chainH;
    chain.w = img.naturalWidth * chain.h / img.naturalHeight;
    chain.step = chain.w * CHAIN_STEP;
    chain.phase = -1;
    paintChain();
  }
  /* Ô đặt cách đều theo trục ngang (đường võng thoải nên mắt xích không giãn thấy được),
     nhờ vậy lệch đúng một nhịp là hình lặp lại y hệt: trôi mãi không giật */
  function paintChain() {
    var ctx = chain.ctx, img = rail.chainImg;
    if (!ctx) return;
    var phase = Math.round(mod(rail.offset, chain.step) * 100) / 100;
    if (phase === chain.phase) return;
    chain.phase = phase;
    var h = chain.h, w = chain.w, step = chain.step;
    ctx.clearRect(0, 0, rail.vw, rail.vh);
    for (var x = -w * 1.5 - phase; x < rail.vw + w; x += step) {
      var y = yAt(x);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.atan2(yAt(x + step) - y, step));
      ctx.drawImage(img, 0, -h * 0.5, w, h);
      ctx.restore();
    }
  }
  if (rail.chainCv && rail.el.dataset.chain) {
    rail.chainImg = new Image();
    rail.chainImg.onload = drawChain;
    rail.chainImg.src = rail.el.dataset.chain;
  }

  /* Đèn ảo theo chuột: chuột ở đâu trong hero thì đèn ở đó, bóng áo đổ ngược ra xa đèn.
     Rời hero thì đèn trôi về chỗ mặc định (phía trên giữa rail) */
  (function () {
    var hero = rail.el.closest(".hero") || rail.el;
    hero.addEventListener("pointermove", function (e) {
      if (e.pointerType === "touch") return;
      var r = rail.el.getBoundingClientRect();
      rail.lightT = { x: e.clientX - r.left, y: e.clientY - r.top };
    });
    hero.addEventListener("pointerleave", function () { rail.lightT = null; });
  })();

  function setHover(it) {
    if (rail.hover === it) return;
    if (rail.hover) rail.hover.el.style.zIndex = "";
    rail.hover = it;
    rail.el.classList.toggle("is-pointing", !!it);
    if (it) {
      it.el.style.zIndex = 5;
      nowName.textContent = it.p.name;
      nowPrice.textContent = money(it.p.price);
      nowItem.hidden = false;
      nowBox.classList.add("has-item");
      nowItem.animate([{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }], { duration: 260, easing: "ease-out" });
    } else {
      nowBox.classList.remove("has-item");
      nowItem.hidden = true;
    }
  }

  function pickHover() {
    var pt = rail.pointer;
    if (!pt.inside || pt.touch || rail.drag || rail.hold || !rail.ready) { if (!rail.hold) setHover(null); return; }
    var top = rail.railY - 16, bottom = rail.railY + rail.sag + rail.H * 0.9;
    if (pt.y < top || pt.y > bottom) { setHover(null); return; }
    var h = rail.hover;
    if (h && Math.abs(pt.x - h.x) < rail.W * 0.34 * h.s) return;
    var best = null, bd = rail.gap * 0.62;
    for (var k = 0; k < rail.items.length; k++) {
      var it = rail.items[k];
      if (!it.vis) continue;
      var dx = Math.abs(pt.x - it.x);
      if (dx < bd) { bd = dx; best = it; }
    }
    setHover(best);
  }

  function nearestAt(x) {
    var best = null, bd = rail.gap * 0.7;
    rail.items.forEach(function (it) {
      var dx = Math.abs(x - it.x);
      if (it.vis && dx < bd) { bd = dx; best = it; }
    });
    return best;
  }

  /* Mô-đun 3D (js/three3d.js). null = đang dùng ảnh 2D. */
  var three = null;

  var last = 0;
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    var time = now / 1000;

    if (rail.ready) {
      if (!rail.drag) {
        var target = (rail.hover || rail.hold || reduce) ? 0 : rail.auto;
        rail.vel += (target - rail.vel) * damp(dt, rail.hover ? 6 : 1.8);
        rail.offset += rail.vel * dt;
      }
      if (rail.seek) {
        var step = rail.seek * damp(dt, 6);
        rail.offset += step; rail.seek -= step;
        if (Math.abs(rail.seek) < 0.5) rail.seek = 0;
      }

      pickHover();
      rail.spread += ((rail.hover ? 1 : 0) - rail.spread) * damp(dt, 8);
      var lt = rail.lightT || { x: rail.vw / 2, y: -rail.vh * 0.25 }, kl = damp(dt, 4.5);
      rail.light.x += (lt.x - rail.light.x) * kl;
      rail.light.y += (lt.y - rail.light.y) * kl;

      var gap = rail.gap, total = rail.total, items = rail.items;
      var push = Math.max(0, rail.W * 0.62 - gap) * rail.spread;
      var h = rail.hover;
      var hookOff = G.hookTop * rail.H + 3;
      var swingTarget = clamp(-rail.vel * 0.011, -11, 11);
      var k1 = damp(dt, 7.5);
      var t0 = (now - rail.start) / 1000;

      for (var k = 0; k < items.length; k++) {
        items[k].bx = mod(items[k].i * gap - rail.offset, total) - rail.margin;
      }
      for (k = 0; k < items.length; k++) {
        var it = items[k];
        var x = it.bx;
        if (h && it !== h && push > 0.01) {
          var d = x - h.bx;
          if (d > total / 2) d -= total; else if (d < -total / 2) d += total;
          x += (d < 0 ? -1 : 1) * push * Math.min(1, Math.abs(d) / gap);
        }
        it.x = x;

        var vis = x > -rail.W && x < rail.vw + rail.W;
        if (vis !== it.vis) { it.el.style.visibility = vis ? "" : "hidden"; it.vis = vis; }
        if (!vis) continue;

        var isH = it === h;
        it.ry += ((isH ? 0 : it.ry0) - it.ry) * k1;
        it.s += ((isH ? 1.12 : 1) - it.s) * k1;

        // lò xo đung đưa: lệch theo vận tốc rail rồi dao động tắt dần
        var st = isH ? 0 : swingTarget;
        it.swv += ((st - it.sw) * 34 - it.swv * 3.2) * dt;
        it.sw += it.swv * dt;
        it.idle += ((isH || reduce ? 0 : 0.55 * Math.sin(time * 1.2 + it.ph)) - it.idle) * k1;

        // rơi xuống thanh rail lúc mở trang
        var drop = 0;
        if (it.enter < 1) {
          if (!it.delay) it.delay = 0.35 + clamp(x / rail.vw, 0, 1) * 0.9 + Math.random() * 0.08;
          var e = clamp((t0 - it.delay) / 0.9, 0, 1);
          it.enter = e;
          var back = 1 + 2.2 * Math.pow(e - 1, 3) + 1.2 * Math.pow(e - 1, 2);
          drop = (1 - back) * -70;
          var op = Math.min(1, e * 2.2);
          if (op !== it.op) { it.el.style.opacity = op; it.op = op; }
          if (e < 1) it.sw = (1 - e) * 6 * Math.sin(e * 9);
        }

        it.y = yAt(x) - hookOff + drop;
        it.el.style.transform = "translate3d(" + (x - gap / 2).toFixed(2) + "px," + it.y.toFixed(2) + "px,0)";
        it.swing.style.transform = "rotate(" + (it.sw + it.idle).toFixed(3) + "deg)";
        it.turn.style.transform = "perspective(" + rail.persp.toFixed(0) + "px) rotateY(" + it.ry.toFixed(2) + "deg) scale(" + it.s.toFixed(4) + ")";
        // bản 2D (máy không có WebGL): bóng đổ lệch ngược hướng đèn; bản 3D tự đổ bóng trong three3d.js
        if (!three) {
          var sx = clamp((x - rail.light.x) * 0.05, -32, 32), sy = clamp((it.y + rail.H * 0.45 - rail.light.y) * 0.05, -8, 36);
          it.turn.style.filter = "drop-shadow(" + sx.toFixed(1) + "px " + sy.toFixed(1) + "px 12px rgba(40,26,12,.26))";
        }
      }

      // thanh tiến trình chạy vòng
      var pr = mod(rail.offset, P.length * gap) / (P.length * gap);
      var bw = rail.barW;
      var x1 = (pr * 1.45 - 0.45) * bw;
      progress[0].style.transform = "translateX(" + x1.toFixed(1) + "px)";
      progress[1].style.transform = "translateX(" + (x1 - 1.45 * bw).toFixed(1) + "px)";

      // bản 3D vẽ lại đúng các vị trí vừa tính
      if (three) three.rail.render(rail);
      paintChain();
    }
    requestAnimationFrame(frame);
  }

  /* chuột / cảm ứng trên rail */
  function local(e) {
    var r = rail.el.getBoundingClientRect();
    rail.pointer.x = e.clientX - r.left;
    rail.pointer.y = e.clientY - r.top;
  }
  rail.el.addEventListener("pointerenter", function (e) { rail.pointer.inside = true; rail.pointer.touch = e.pointerType === "touch"; local(e); });
  rail.el.addEventListener("pointerleave", function () { rail.pointer.inside = false; if (!rail.drag) setHover(null); });
  rail.el.addEventListener("pointerdown", function (e) {
    if (e.button !== 0 || rail.hold) return;
    local(e);
    rail.pointer.touch = e.pointerType === "touch";
    rail.drag = { id: e.pointerId, x: e.clientX, lastX: e.clientX, lastT: performance.now(), moved: 0, captured: false };
  });
  rail.el.addEventListener("pointermove", function (e) {
    local(e);
    rail.pointer.inside = true;
    var d = rail.drag;
    if (!d || d.id !== e.pointerId) return;
    var dx = e.clientX - d.lastX, nowT = performance.now();
    d.moved += Math.abs(dx);
    if (d.moved > 6) {
      if (!d.captured) { rail.el.setPointerCapture(e.pointerId); d.captured = true; rail.el.classList.add("is-dragging"); setHover(null); }
      rail.offset -= dx;
      var v = -dx / Math.max(0.008, (nowT - d.lastT) / 1000);
      rail.vel = rail.vel * 0.6 + v * 0.4;
    }
    d.lastX = e.clientX; d.lastT = nowT;
  });
  function endDrag(e) {
    var d = rail.drag;
    if (!d || d.id !== e.pointerId) return;
    rail.drag = null;
    rail.el.classList.remove("is-dragging");
    if (d.captured) { rail.vel = clamp(rail.vel, -2400, 2400); return; }
    if (e.type !== "pointerup") return;
    // chạm (hoặc bấm nhanh chưa kịp hover) thì lấy chiếc áo gần điểm bấm nhất
    var py = rail.pointer.y, inBand = py > rail.railY - 16 && py < rail.railY + rail.sag + rail.H * 0.9;
    var target = (!rail.pointer.touch && rail.hover) || (inBand ? nearestAt(rail.pointer.x) : null);
    if (target) openDetail(target.p, { item: target });
  }
  rail.el.addEventListener("pointerup", endDrag);
  rail.el.addEventListener("pointercancel", endDrag);
  rail.el.addEventListener("wheel", function (e) {
    var dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : (e.shiftKey ? e.deltaY : 0);
    if (!dx || rail.hold) return;
    e.preventDefault();
    rail.offset += dx;
    rail.vel = clamp(dx * 22, -1600, 1600);
  }, { passive: false });

  /* ================= KHUNG CHI TIẾT ================= */
  var D = {
    el: $("[data-detail]"), fig: $("[data-detail-figure]"), turn: $("[data-detail-turn]"), img: $("[data-detail-img]"),
    string: $("[data-detail-string]"), panel: $("[data-detail-panel]"),
    idx: $("[data-d-index]"), name: $("[data-d-name]"), price: $("[data-d-price]"),
    sizes: $("[data-d-sizes]"), add: $("[data-d-add]"), addLabel: $("[data-d-add-label]"),
    viewcart: $("[data-d-viewcart]"), footName: $("[data-d-foot-name]"),
    moreBtn: $("[data-d-more]"), more: $("[data-d-details]"), blurb: $("[data-d-blurb]"), list: $("[data-d-list]"), color: $("[data-d-color]"),
    tabs: $$("[data-view]"), look: $("[data-detail-look]"),
    tab: function (view) { return $('[data-view="' + view + '"]'); },
    p: null, view: "front", size: null, source: null, open: false, busy: false, addT: 0, lastFocus: null
  };
  $$(".detail__panel > *").forEach(function (el, i) { el.style.setProperty("--i", i); });

  function fill(p) {
    D.p = p;
    D.view = "front";
    D.idx.textContent = (p.index + 1) + " / " + P.length;
    D.name.textContent = p.name;
    D.price.textContent = money(p.price);
    D.footName.textContent = p.name;
    D.img.src = frontOf(p);
    D.img.alt = p.name + " — " + p.colorName;
    D.tabs.forEach(function (t) { t.setAttribute("aria-selected", t.dataset.view === "front" ? "true" : "false"); });
    // Tab: On model (khi có ảnh người mẫu) · Front · Back (khi có ảnh mặt sau).
    // Không có cả hai thì ẩn hẳn hàng tab.
    var hasBack = G.hasBack(p), look = p.onModel || "";
    D.tab("model").hidden = !look;
    D.tab("back").hidden = !hasBack;
    D.tab("front").textContent = hasBack ? "Front" : "Product";
    D.tabs[0].parentNode.hidden = !look && !hasBack;
    D.el.classList.remove("is-look");
    D.look.hidden = !look;
    if (look) { D.look.src = look; D.look.alt = "Model wearing " + p.name; }

    var sold = p.soldOut || [];
    D.size = null;
    D.sizes.innerHTML = "";
    SIZES.forEach(function (s) {
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("role", "radio");
      b.textContent = s;
      b.dataset.size = s;
      if (sold.indexOf(s) >= 0) { b.disabled = true; b.setAttribute("aria-label", s + " — sold out"); }
      if (!D.size && !b.disabled) D.size = s;
      b.setAttribute("aria-checked", D.size === s && !b.disabled ? "true" : "false");
      D.sizes.appendChild(b);
    });

    clearTimeout(D.addT);
    D.add.classList.remove("is-loading");
    D.addLabel.textContent = "Add to cart";
    D.viewcart.hidden = true;

    var copy = COPY[p.type];
    D.blurb.textContent = copy.blurb;
    D.list.innerHTML = copy.details.map(function (t) { return "<li>" + t + "</li>"; }).join("");
    D.color.textContent = "Colour: " + p.colorName + " · " + p.cat;
    D.more.hidden = true;
    D.moreBtn.setAttribute("aria-expanded", "false");
    backOf(p); // chuẩn bị sẵn mặt sau
  }

  function placeString() {
    var fr = D.turn.getBoundingClientRect();
    D.string.style.left = (fr.left + fr.width / 2 - 0.75) + "px";
    D.string.style.height = Math.max(0, fr.top + fr.height * G.hookTop + 3) + "px";
  }

  /* Tính tư thế xuất phát (trên rail hoặc trong lưới) theo hệ toạ độ của khung chi tiết */
  function sourcePose(src) {
    var fr = D.fig.getBoundingClientRect();
    var FW = fr.width, cx, top, w, ry = 0;
    if (src.item) {
      var it = src.item, rr = rail.el.getBoundingClientRect();
      if (!it.vis) return null;
      cx = rr.left + it.x; top = rr.top + it.y;
      w = rail.W * (src.closing ? 1 : it.s);
      ry = src.closing ? it.ry0 : it.ry;
    } else if (src.card) {
      var b = $(".card__flip", src.card).getBoundingClientRect();
      if (b.bottom < 0 || b.top > window.innerHeight) return null;
      w = b.width;
      cx = b.left + b.width / 2;
      top = b.top + (b.height - b.width * G.ratio) / 2;
    } else return null;
    var k = w / FW;
    return {
      t: "translate(" + (cx - (fr.left + FW / 2)) + "px," + (top - fr.top) + "px) scale(" + k + ") perspective(" + (FW * 3.2) + "px) rotateY(" + ry + "deg)",
      end: "translate(0px,0px) scale(1) perspective(" + (FW * 3.2) + "px) rotateY(0deg)"
    };
  }

  function openDetail(p, src) {
    if (D.open || D.busy) return;
    D.open = true; D.busy = true;
    D.lastFocus = document.activeElement;
    rail.hold = true;
    closeSearch();
    fill(p);
    D.source = src || {};
    D.el.hidden = false;
    document.body.classList.add("is-locked");

    var pose = sourcePose(D.source);
    if (D.source.item) D.source.item.el.classList.add("is-away");
    void D.el.offsetWidth;
    D.el.classList.add("is-open");
    placeString();

    var anim = pose
      ? D.turn.animate([{ transform: pose.t }, { transform: pose.end }], { duration: reduce ? 1 : 900, easing: "cubic-bezier(.22,.8,.2,1)" })
      : D.turn.animate([{ opacity: 0, transform: "translateY(24px) scale(.96)" }, { opacity: 1, transform: "none" }], { duration: reduce ? 1 : 600, easing: "cubic-bezier(.22,.8,.2,1)" });
    whenDone(anim, 900, function () {
      D.busy = false;
      if (!D.open) return;
      // ảnh 2D vừa bay tới thì đổi sang mô hình 3D kéo xoay được
      if (three) { three.detail.show(D.p.id, D.view); D.el.classList.add("is-3d"); }
      // có ảnh người mẫu thì áo trên móc tan đi, người mẫu mặc áo đó hiện ra
      showLook(D.p);
    });
    setTimeout(function () { D.panel.focus({ preventScroll: true }); }, 400);
  }

  function in3d() { return !!three && D.el.classList.contains("is-3d"); }

  function showLook(p) {
    if (!p.onModel) return;
    D.el.classList.add("is-look");
    setTabs("model");
  }

  function closeDetail(then) {
    if (!D.open || D.busy) return;
    if (D.el.classList.contains("is-look")) {
      // người mẫu tan đi, áo trên móc hiện lại rồi mới bay về rail
      D.busy = true;
      D.el.classList.remove("is-look");
      setTabs("front");
      setTimeout(function () { D.busy = false; closeDetail(then); }, reduce ? 0 : 380);
      return;
    }
    if (in3d()) {
      // xoay về mặt gần nhất, đổi lại ảnh 2D của mặt đó rồi mới bay về chỗ cũ
      D.busy = true;
      three.detail.settle().then(function (view) {
        var back = IMG[D.p.id] && IMG[D.p.id].back;
        D.img.src = view === "back" && back ? back : frontOf(D.p);
        three.detail.hide();
        D.el.classList.remove("is-3d");
        D.busy = false;
        closeDetail(then);
      });
      return;
    }
    D.busy = true;
    D.el.classList.remove("is-open");

    // nếu đã chuyển sang sản phẩm khác bằng phím mũi tên, bay về chỗ của sản phẩm đó trên rail
    var src = D.source;
    if (src.item && src.item.p !== D.p) src = {};
    if (!src.item && !src.card) {
      var best = null;
      rail.items.forEach(function (it) {
        if (it.p === D.p && it.vis && (!best || Math.abs(it.x - rail.vw / 2) < Math.abs(best.x - rail.vw / 2))) best = it;
      });
      if (best && window.scrollY < window.innerHeight * 0.5) src = { item: best };
    }
    var pose = sourcePose({ item: src.item, card: src.card, closing: true });
    if (D.source.item && D.source.item !== src.item) D.source.item.el.classList.remove("is-away");
    if (src.item) src.item.el.classList.add("is-away");

    var anim = pose
      ? D.turn.animate([{ transform: pose.end }, { transform: pose.t }], { duration: reduce ? 1 : 750, easing: "cubic-bezier(.5,0,.2,1)" })
      : D.turn.animate([{ opacity: 1 }, { opacity: 0, transform: "translateY(16px) scale(.97)" }], { duration: reduce ? 1 : 380, easing: "ease-in" });

    whenDone(anim, 750, function () {
      if (src.item) {
        var it = src.item;
        it.ry = it.ry0; it.s = 1;
        it.el.classList.remove("is-away");
      }
      D.el.hidden = true;
      D.open = false; D.busy = false;
      rail.hold = false;
      document.body.classList.remove("is-locked");
      if (D.lastFocus && D.lastFocus.focus && !then) D.lastFocus.focus({ preventScroll: true });
      if (then) then();
    });
  }

  function setTabs(view) {
    D.view = view;
    D.tabs.forEach(function (t) { t.setAttribute("aria-selected", t.dataset.view === view ? "true" : "false"); });
  }

  function showView(view) {
    if (view === D.view || !D.p) return;
    var fromLook = D.view === "model";
    setTabs(view);
    D.el.classList.toggle("is-look", view === "model");
    if (view === "model") return;
    if (in3d()) { three.detail.face(view); return; }
    if (fromLook) { // bản 2D: từ ảnh người mẫu về thì chỉ cần đúng ảnh, không cần lật
      if (view === "back") backOf(D.p).then(function (u) { if (u && D.view === "back") D.img.src = u; });
      else D.img.src = frontOf(D.p);
      return;
    }
    var p = D.p;
    var dir = view === "back" ? 1 : -1;
    var out = D.img.animate([{ transform: "rotateY(0deg)" }, { transform: "rotateY(" + 90 * dir + "deg)" }], { duration: reduce ? 1 : 220, easing: "cubic-bezier(.5,0,.9,.6)", fill: "forwards" });
    var src = view === "back" ? backOf(p) : Promise.resolve(frontOf(p));
    whenDone(out, reduce ? 1 : 220, function () {
      src.then(function (u) {
        if (D.p !== p || D.view !== view) return;
        D.img.src = u;
        out.cancel();
        D.img.animate([{ transform: "rotateY(" + -90 * dir + "deg)" }, { transform: "rotateY(0deg)" }], { duration: reduce ? 1 : 420, easing: "cubic-bezier(.2,.8,.2,1)" });
      });
    });
  }

  function step(dir) {
    if (!D.open || D.busy) return;
    var p = P[mod(D.p.index + dir, P.length)];
    if (in3d()) { fill(p); three.detail.show(p.id, "front"); showLook(p); return; }
    var a = D.img.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateX(" + (-24 * dir) + "px)" }], { duration: 180, easing: "ease-in", fill: "forwards" });
    whenDone(a, 180, function () {
      fill(p);
      showLook(p);
      a.cancel();
      D.img.animate([{ opacity: 0, transform: "translateX(" + (24 * dir) + "px)" }, { opacity: 1, transform: "none" }], { duration: 360, easing: "cubic-bezier(.2,.8,.2,1)" });
    });
  }

  D.tabs.forEach(function (t) { t.addEventListener("click", function () { showView(t.dataset.view); }); });

  D.sizes.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b || b.disabled) return;
    D.size = b.dataset.size;
    $$("button", D.sizes).forEach(function (x) { x.setAttribute("aria-checked", x === b ? "true" : "false"); });
  });

  D.add.addEventListener("click", function () {
    if (!D.size) {
      D.sizes.classList.remove("is-shake"); void D.sizes.offsetWidth; D.sizes.classList.add("is-shake");
      toast("Please choose a size");
      return;
    }
    var p = D.p, size = D.size;
    clearTimeout(D.addT);
    D.add.classList.add("is-loading");
    D.addLabel.textContent = "Add to cart";
    D.addT = setTimeout(function () {
      D.add.classList.remove("is-loading");
      D.addLabel.textContent = "Added to cart";
      D.viewcart.hidden = false;
      var back = in3d() && three.detail.facing() === "back" && IMG[p.id].back;
      flyToBag(D.img, function () { cartAdd(p.id, size, 1); }, back || null);
      D.addT = setTimeout(function () { D.addLabel.textContent = "Add to cart"; }, 2600);
    }, reduce ? 10 : 750);
  });

  D.viewcart.addEventListener("click", function (e) {
    e.preventDefault();
    closeDetail(function () { openCart(); });
  });
  D.moreBtn.addEventListener("click", function () {
    var open = D.more.hidden;
    D.more.hidden = !open;
    D.moreBtn.setAttribute("aria-expanded", open ? "true" : "false");
  });
  $$("[data-detail-close]").forEach(function (b) { b.addEventListener("click", function () { closeDetail(); }); });

  /* Ảnh nhỏ bay từ khung chi tiết vào túi giỏ hàng */
  function flyToBag(imgEl, done, src) {
    var from = imgEl.getBoundingClientRect();
    var bag = $("[data-cart-open]").getBoundingClientRect();
    if (reduce || !from.width) { done(); return; }
    var w = from.width * 0.62, h = from.height * 0.62;
    var f = document.createElement("div");
    f.className = "fly";
    f.style.width = w + "px"; f.style.height = h + "px";
    f.innerHTML = '<img alt="" src="' + (src || imgEl.src) + '">';
    document.body.appendChild(f);
    // toạ độ tính theo tâm hộp (transform-origin mặc định ở giữa)
    var sx = from.left + from.width / 2, sy = from.top + 10 + h / 2;
    var ex = bag.left + bag.width / 2, ey = bag.top + bag.height / 2;
    var mx = sx + (ex - sx) * 0.55, my = ey + (sy - ey) * 0.3;
    function at(x, y, s) { return "translate(" + (x - w / 2) + "px," + (y - h / 2) + "px) scale(" + s + ")"; }
    var a = f.animate([
      { transform: at(sx, sy, 1), opacity: 1 },
      { transform: at(mx, my, 0.42), opacity: 1, offset: 0.55 },
      { transform: at(ex, ey, 0.04), opacity: 0.3 }
    ], { duration: 950, easing: "cubic-bezier(.45,0,.25,1)", fill: "forwards" });
    whenDone(a, 950, function () { f.remove(); done(); });
  }

  /* ================= GIỎ HÀNG ================= */
  /* Web thường: giỏ lưu trong localStorage, thanh toán bằng link giỏ hàng Shopify.
     Trong theme Shopify (ARDOR_SHOP.native): giỏ là giỏ thật của cửa hàng. C.items vẫn là
     danh sách {id, size, qty} để vẽ; mỗi lần đổi thì gửi lên /cart/*.js rồi đọc lại giỏ.
     Món thêm từ trang khác của cửa hàng (không phải ARDOR) gom vào một dòng "Other items". */
  var SHOP = window.ARDOR_SHOP || {};
  var NATIVE = !!SHOP.native;
  var ROOT = (window.Shopify && Shopify.routes && Shopify.routes.root) || "/";
  var BY_VARIANT = {};
  Object.keys(SHOP.variants || {}).forEach(function (id) {
    Object.keys(SHOP.variants[id]).forEach(function (size) { BY_VARIANT[SHOP.variants[id][size]] = { id: id, size: size }; });
  });
  function variantOf(l) { return SHOP.variants && SHOP.variants[l.id] && SHOP.variants[l.id][l.size]; }

  var C = {
    el: $("[data-cart]"), lines: $("[data-cart-lines]"), n: $("[data-cart-n]"), total: $("[data-cart-total]"),
    badge: $("[data-bag-count]"),
    discToggle: $("[data-disc-toggle]"), discForm: $("[data-disc-form]"), discInput: $("[data-disc-input]"),
    discRow: $("[data-disc-row]"), discLabel: $("[data-disc-label]"), discAmount: $("[data-disc-amount]"),
    items: NATIVE ? [] : store.get("ardor-cart-v1") || [],
    extra: { qty: 0, amount: 0 },
    code: store.get("ardor-code-v1") || null
  };
  var CODES = { ARDOR10: 0.1 };
  C.items = C.items.filter(function (l) { return byId[l.id] && l.qty > 0; });

  function keyOf(l) { return l.id + "|" + l.size; }

  function pullCart() {
    return fetch(ROOT + "cart.js", { headers: { Accept: "application/json" } })
      .then(function (r) { return r.json(); })
      .then(function (cart) {
        var items = [], extra = { qty: 0, amount: 0 };
        cart.items.forEach(function (li) {
          var m = BY_VARIANT[li.variant_id];
          if (m && byId[m.id]) items.push({ id: m.id, size: m.size, qty: li.quantity });
          else { extra.qty += li.quantity; extra.amount += li.final_line_price / 100; }
        });
        C.items = items;
        C.extra = extra;
        renderCart();
      })
      .catch(function () { /* mất mạng: giữ nguyên giỏ đang vẽ */ });
  }
  /* Gửi thay đổi lên giỏ Shopify rồi đọc lại (hết hàng thì Shopify từ chối, giỏ tự trả về đúng) */
  function pushCart(path, body) {
    return fetch(ROOT + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body)
    })
      .then(function (r) { if (!r.ok) toast("Sorry, that size is no longer available"); })
      .catch(function () { toast("Couldn't update the cart, please try again"); })
      .then(pullCart);
  }

  function cartAdd(id, size, qty) {
    var l = C.items.filter(function (x) { return x.id === id && x.size === size; })[0];
    if (l) l.qty = Math.min(20, l.qty + qty);
    else C.items.unshift({ id: id, size: size, qty: qty });
    if (NATIVE) pushCart("cart/add.js", { items: [{ id: variantOf({ id: id, size: size }), quantity: qty }] });
    else store.set("ardor-cart-v1", C.items);
    renderCart();
    C.badge.classList.remove("is-bump"); void C.badge.offsetWidth; C.badge.classList.add("is-bump");
  }

  var TRASH = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5M7 7v4M9 7v4"/></svg>';

  function renderCart() {
    var count = 0, sub = 0;
    var seen = {};
    C.items.forEach(function (l, idx) {
      var p = byId[l.id], k = keyOf(l);
      count += l.qty; sub += p.price * l.qty;
      seen[k] = true;
      var li = C.lines.querySelector('[data-key="' + k + '"]');
      if (!li) {
        li = document.createElement("li");
        li.className = "line";
        li.dataset.key = k;
        li.innerHTML =
          '<div class="line__img"><img alt="" src="' + frontOf(p) + '"></div>' +
          '<div><p class="line__name">' + p.name + '</p><p class="line__meta">' + l.size + "<br>" + money(p.price) + "</p>" +
          '<div class="line__ctrl"><div class="stepper"><button type="button" data-dec aria-label="Giảm">−</button><span data-q></span><button type="button" data-inc aria-label="Tăng">+</button></div>' +
          '<button type="button" class="line__del" data-del aria-label="Xoá ' + p.name + '">' + TRASH + "</button></div></div>" +
          '<p class="line__sum" data-sum></p>';
      }
      var img = li.querySelector("img");
      if (!img.getAttribute("src") && frontOf(p)) img.src = frontOf(p);
      li.querySelector("[data-q]").textContent = l.qty;
      li.querySelector("[data-sum]").textContent = money(p.price * l.qty);
      if (C.lines.children[idx] !== li) C.lines.insertBefore(li, C.lines.children[idx] || null);
    });
    $$(".line", C.lines).forEach(function (li) {
      if (li.dataset.key && !seen[li.dataset.key] && !li.classList.contains("is-out")) {
        li.classList.add("is-out");
        setTimeout(function () { li.remove(); }, 300);
      }
    });
    var other = $(".line--other", C.lines);
    if (C.extra.qty) {
      if (!other) { other = document.createElement("li"); other.className = "line line--other"; }
      C.lines.appendChild(other);
      other.innerHTML = '<div class="line__img"></div><div><p class="line__name">Other items</p><p class="line__meta">' +
        C.extra.qty + " added elsewhere in the store<br><a href=\"" + ROOT + 'cart">Edit in cart</a></p></div><p class="line__sum">' + money(C.extra.amount) + "</p>";
      count += C.extra.qty; sub += C.extra.amount;
    } else if (other) other.remove();

    var rate = C.code && CODES[C.code] ? CODES[C.code] : 0;
    var off = Math.round(sub * rate / 1000) * 1000;
    C.discRow.hidden = !rate;
    if (rate) { C.discLabel.textContent = C.code + " (−" + rate * 100 + "%)"; C.discAmount.textContent = "−" + money(off); }
    C.total.textContent = money(sub - off);
    C.n.textContent = count;
    C.badge.textContent = count;
    C.badge.hidden = count === 0;
    C.el.classList.toggle("is-empty", count === 0);
  }

  C.lines.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    var key = b.closest(".line").dataset.key;
    var l = C.items.filter(function (x) { return keyOf(x) === key; })[0];
    if (!l) return;
    if (b.hasAttribute("data-inc")) l.qty = Math.min(20, l.qty + 1);
    else if (b.hasAttribute("data-dec")) l.qty -= 1;
    else if (b.hasAttribute("data-del")) l.qty = 0;
    // change.js chỉ nhận id dạng chuỗi (mã biến thể hoặc khoá dòng), số nguyên bị từ chối
    if (NATIVE) pushCart("cart/change.js", { id: String(variantOf(l)), quantity: l.qty });
    C.items = C.items.filter(function (x) { return x.qty > 0; });
    if (!NATIVE) store.set("ardor-cart-v1", C.items);
    renderCart();
  });

  C.discToggle.addEventListener("click", function () {
    var open = C.discForm.hidden;
    C.discForm.hidden = !open;
    C.discToggle.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) C.discInput.focus();
  });
  C.discForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var code = C.discInput.value.trim().toUpperCase();
    if (!CODES[code]) { toast("That code isn't valid"); return; }
    C.code = code;
    store.set("ardor-code-v1", code);
    toast("Code " + code + " applied");
    C.discForm.hidden = true;
    C.discToggle.setAttribute("aria-expanded", "false");
    renderCart();
  });
  $("[data-disc-remove]").addEventListener("click", function () {
    C.code = null;
    store.set("ardor-code-v1", null);
    toast("Code removed");
    renderCart();
  });
  /* Thanh toán. Trong theme Shopify: giỏ đã là giỏ thật, sang thẳng /checkout.
     Web thường: dựng link giỏ hàng Shopify (/cart/<variant>:<qty>,...) rồi chuyển sang đó */
  $("[data-checkout]").addEventListener("click", function () {
    var disc = C.code && CODES[C.code] ? "?discount=" + encodeURIComponent(C.code) : "";
    if (NATIVE) { window.location.href = ROOT + "checkout" + disc; return; }
    var parts = [];
    var ok = C.items.every(function (l) {
      var v = SHOP.variants && SHOP.variants[l.id] && SHOP.variants[l.id][l.size];
      if (v) parts.push(v + ":" + l.qty);
      return !!v;
    });
    if (!SHOP.domain || !parts.length || !ok) { toast("Checkout isn't available for this item yet."); return; }
    window.location.href = "https://" + SHOP.domain + "/cart/" + parts.join(",") + disc;
  });

  function openCart() {
    closeSearch();
    document.body.classList.add("cart-open");
    C.el.setAttribute("aria-hidden", "false");
    setTimeout(function () { $("[data-cart-close]").focus({ preventScroll: true }); }, 60);
  }
  function closeCart() {
    document.body.classList.remove("cart-open");
    C.el.setAttribute("aria-hidden", "true");
  }
  $("[data-cart-open]").addEventListener("click", function () {
    document.body.classList.contains("cart-open") ? closeCart() : openCart();
  });
  $$("[data-cart-close]").forEach(function (b) { b.addEventListener("click", closeCart); });

  /* ================= TÌM KIẾM ================= */
  var S = { box: $("[data-search]"), panel: $("[data-search-panel]"), input: $("[data-search-input]"), list: $("[data-search-list]"), open: false };

  function renderSearch() {
    var q = S.input.value.trim().toLowerCase();
    var hits = P.filter(function (p) {
      return !q || (p.name + " " + p.colorName + " " + p.cat).toLowerCase().indexOf(q) >= 0;
    });
    S.list.innerHTML = hits.length
      ? hits.map(function (p, i) {
          return '<li><button type="button" data-id="' + p.id + '"' + (i === 0 && q ? ' class="is-active"' : "") + '><img alt="" src="' + frontOf(p) + '"><span>' + p.name + '</span><span class="p">' + money(p.price) + "</span></button></li>";
        }).join("")
      : '<li class="search__empty">Nothing on the rail matches “' + S.input.value.replace(/[<>&"]/g, "") + "”.</li>";
  }
  function openSearch() {
    S.open = true;
    S.panel.hidden = false;
    renderSearch();
    S.input.focus();
  }
  function closeSearch() {
    if (!S.open) return;
    S.open = false;
    S.panel.hidden = true;
  }
  function pickProduct(p) {
    closeSearch();
    var best = null;
    if (window.scrollY < window.innerHeight * 0.5) {
      rail.items.forEach(function (it) {
        if (it.p === p && it.vis && it.x > 0 && it.x < rail.vw && (!best || Math.abs(it.x - rail.vw / 2) < Math.abs(best.x - rail.vw / 2))) best = it;
      });
    }
    openDetail(p, best ? { item: best } : null);
  }
  $("[data-search-open]").addEventListener("click", function () { S.open ? closeSearch() : openSearch(); });
  S.input.addEventListener("input", renderSearch);
  S.input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      var b = $("button", S.list);
      if (b) pickProduct(byId[b.dataset.id]);
    }
  });
  S.list.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-id]");
    if (b) pickProduct(byId[b.dataset.id]);
  });
  document.addEventListener("pointerdown", function (e) {
    if (S.open && !S.box.contains(e.target)) closeSearch();
  });

  /* ================= LƯỚI SẢN PHẨM ================= */
  var grid = $("[data-grid]");
  function buildGrid() {
    grid.innerHTML = P.map(function (p) {
      var sizes = SIZES.map(function (s) { return (p.soldOut || []).indexOf(s) >= 0 ? "<s>" + s + "</s>" : s; }).join(" ");
      return '<article class="card' + (G.hasBack(p) ? "" : " card--single") + '" data-cat="' + p.cat + '" data-id="' + p.id + '">' +
        '<button type="button" class="card__media" aria-label="' + p.name + ", " + money(p.price) + '">' +
          '<span class="card__badge">' + p.cat + "</span>" +
          '<span class="card__swing"><span class="card__flip"><img alt="" src="' + frontOf(p) + '"><img alt="" data-back></span></span>' +
          '<span class="card__quick">Choose size</span>' +
        "</button>" +
        '<div class="card__info"><h3 class="card__name">' + p.name + '</h3><p class="card__price">' + money(p.price) + "</p>" +
        '<p class="card__color">' + p.colorName + '</p><p class="card__sizes">' + sizes + "</p></div>" +
        "</article>";
    }).join("");
    $("[data-count]").textContent = P.length + " pieces";

    // mặt sau nạp dần khi lưới sắp vào khung nhìn
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        var p = byId[en.target.dataset.id];
        backOf(p).then(function (u) { if (u) $("[data-back]", en.target).src = u; });
      });
    }, { rootMargin: "300px" });
    $$(".card", grid).forEach(function (c) { io.observe(c); });
  }
  grid.addEventListener("click", function (e) {
    var b = e.target.closest(".card__media");
    if (!b) return;
    var card = b.closest(".card");
    openDetail(byId[card.dataset.id], { card: card });
  });
  /* Lọc lưới theo dòng (dùng chung cho nút lọc, menu danh mục và link ở chân trang) */
  function setFilter(f) {
    var n = 0;
    $$("[data-filters] button").forEach(function (x) { x.setAttribute("aria-pressed", x.dataset.filter === f ? "true" : "false"); });
    $$("[data-menu-cat]").forEach(function (x) { x.setAttribute("aria-current", x.dataset.menuCat === f ? "true" : "false"); });
    $$(".card", grid).forEach(function (c) {
      var on = f === "all" || c.dataset.cat === f;
      c.hidden = !on;
      if (on) { n++; c.animate([{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], { duration: 420, delay: n * 25, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards" }); }
    });
    $("[data-count]").textContent = n + (n === 1 ? " piece" : " pieces");
  }
  function showCategory(f) {
    setFilter(f);
    $("#collection").scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
  }
  $("[data-filters]").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-filter]");
    if (b) setFilter(b.dataset.filter);
  });
  document.addEventListener("click", function (e) {
    var a = e.target.closest("[data-filter-link]");
    if (!a) return;
    e.preventDefault();
    showCategory(a.dataset.filterLink);
  });

  /* ================= MENU DANH MỤC (điện thoại) ================= */
  var M = { el: $("[data-menu]"), btn: $("[data-menu-open]"), cats: $("[data-menu-cats]") };
  function buildMenu() {
    if (!M.cats) return;
    // cùng thứ tự với các nút lọc của lưới; dòng mới chưa có nút thì xếp cuối
    var cats = $$("[data-filters] button").map(function (b) { return b.dataset.filter; }).filter(function (f) { return f !== "all"; });
    P.forEach(function (p) { if (cats.indexOf(p.cat) < 0) cats.push(p.cat); });
    cats = cats.filter(function (c) { return P.some(function (p) { return p.cat === c; }); });
    var rows = [{ f: "all", name: "All products", n: P.length, p: P[0] }].concat(cats.map(function (c) {
      var list = P.filter(function (p) { return p.cat === c; });
      return { f: c, name: c, n: list.length, p: list[0] };
    }));
    M.cats.innerHTML = rows.map(function (r) {
      return '<li><button type="button" class="menu__cat" data-menu-cat="' + r.f + '" aria-current="' + (r.f === "all" ? "true" : "false") + '">' +
        '<span class="menu__thumb"><img alt="" src="' + frontOf(r.p) + '"></span>' +
        '<span class="menu__name">' + r.name + '</span><span class="menu__n">' + r.n + "</span></button></li>";
    }).join("");
  }
  function openMenu() {
    if (!M.el) return;
    closeSearch();
    M.el.hidden = false;
    requestAnimationFrame(function () { M.el.classList.add("is-open"); });
    document.body.classList.add("is-locked");
    M.btn.setAttribute("aria-expanded", "true");
    var first = $(".menu__cat", M.el);
    if (first) setTimeout(function () { first.focus({ preventScroll: true }); }, 60);
  }
  function closeMenu() {
    if (!M.el || M.el.hidden) return;
    M.el.classList.remove("is-open");
    document.body.classList.remove("is-locked");
    M.btn.setAttribute("aria-expanded", "false");
    setTimeout(function () { if (!M.el.classList.contains("is-open")) M.el.hidden = true; }, 380);
  }
  if (M.el) {
    M.btn.addEventListener("click", openMenu);
    M.el.addEventListener("click", function (e) {
      var c = e.target.closest("[data-menu-cat]");
      if (c) { closeMenu(); showCategory(c.dataset.menuCat); return; }
      if (e.target.closest("[data-menu-close]")) closeMenu();
    });
  }

  /* ================= PHÍM TẮT ================= */
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (M.el && !M.el.hidden) { closeMenu(); return; }
      if (S.open) { closeSearch(); return; }
      if (D.open) { closeDetail(); return; }
      if (document.body.classList.contains("cart-open")) { closeCart(); return; }
    }
    if (D.open && (e.key === "ArrowRight" || e.key === "ArrowLeft") && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) {
      e.preventDefault();
      step(e.key === "ArrowRight" ? 1 : -1);
    }
    if (D.open && e.key === "Tab") { // giữ focus trong khung chi tiết
      var f = $$("button:not([disabled]):not([hidden]), a:not([hidden])", D.el).filter(function (x) { return x.offsetParent; });
      if (!f.length) return;
      var first = f[0], lastF = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastF.focus(); }
      else if (!e.shiftKey && document.activeElement === lastF) { e.preventDefault(); first.focus(); }
    }
  });

  /* ================= KHỞI ĐỘNG ================= */
  $$(".hero .headline .w").forEach(function (w, i) { w.style.setProperty("--i", i); });
  if (window.matchMedia("(hover: none)").matches) $("[data-now-hint]").textContent = "Tap a piece to look closer · swipe the rail";

  new ResizeObserver(function () { if (rail.copies) layout(); }).observe(rail.el);
  window.addEventListener("resize", function () { if (D.open) placeString(); });

  /* Bật 3D khi js/three3d.js đã nạp xong và mọi ảnh (trước + sau) đã treo móc.
     Hỏng ở bước nào thì web vẫn chạy bằng ảnh 2D. */
  function start3D() {
    var api = window.Ardor3D;
    if (!api) { window.addEventListener("ardor3d", start3D, { once: true }); return; }
    Promise.all(P.map(function (p) {
      return backOf(p).then(function (b) { return { id: p.id, type: p.type, front: frontOf(p), back: b }; });
    })).then(api.load).then(function () {
      three = api;
      api.rail.mount(rail.el);
      rail.el.classList.add("rail--3d");
      // xoay qua nửa vòng thì tab Front/Back tự đổi theo (trừ khi đang xem ảnh người mẫu)
      api.detail.mount(D.fig, function (side) { if (D.view !== "model") setTabs(side); });
    }).catch(function (e) {
      if (window.console) console.warn("ARDOR 3D off:", e);
    });
  }

  renderCart();
  if (NATIVE) {
    pullCart();
    // quay lại từ trang thanh toán bằng nút Back: đọc lại giỏ (có thể đã đặt hàng xong)
    window.addEventListener("pageshow", function (e) { if (e.persisted) pullCart(); });
  }
  loadFronts().then(function () {
    build(2);
    layout();
    buildGrid();
    buildMenu();
    renderCart();
    rail.start = performance.now();
    rail.ready = true;
    root.classList.add("is-ready");
    start3D();
    // nạp sẵn ảnh người mẫu để lúc bấm vào áo là hiện ngay
    P.forEach(function (p) { if (p.onModel) new Image().src = p.onModel; });
  });
  requestAnimationFrame(frame);
})();
