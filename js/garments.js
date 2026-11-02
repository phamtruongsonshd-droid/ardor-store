/* ARDOR — vẽ sản phẩm (áo treo trên móc gỗ) bằng SVG.
   Mỗi sản phẩm có mặt trước và mặt sau. Bản vẽ được rasterize ra PNG 2x một lần
   lúc tải trang, sau đó cả rail, khung chi tiết, giỏ hàng, lưới đều dùng chung ảnh,
   nên hiệu ứng 3D không phải vẽ lại SVG mỗi khung hình.
   Toạ độ: viewBox 300 x 400, đỉnh móc chạm thanh rail tại y ≈ 6, tâm áo x = 150. */
(function () {
  "use strict";

  var VW = 300, VH = 400;

  /* ---------- màu ---------- */
  function rgb(h) { h = h.replace("#", ""); return [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16); }); }
  function hex(a) { return "#" + a.map(function (v) { v = Math.round(Math.max(0, Math.min(255, v))); return (v < 16 ? "0" : "") + v.toString(16); }).join(""); }
  function mix(a, b, t) { var x = rgb(a), y = rgb(b); return hex(x.map(function (v, i) { return v + (y[i] - v) * t; })); }
  function light(c, t) { return mix(c, "#ffffff", t); }
  function dark(c, t) { return mix(c, "#000000", t); }
  function lum(c) { var x = rgb(c); return (0.2126 * x[0] + 0.7152 * x[1] + 0.0722 * x[2]) / 255; }

  /* Lật ngang một path quanh trục x = 150. Path chỉ dùng lệnh tuyệt đối M L C Q Z
     với các cặp "x y", nên chỉ cần đổi mọi số ở vị trí chẵn. */
  function mirror(d) {
    return d.replace(/([MLCQ])([^MLCQZ]*)/g, function (_, cmd, args) {
      var n = args.trim().split(/[\s,]+/).filter(Boolean).map(Number);
      for (var i = 0; i < n.length; i += 2) n[i] = +(VW - n[i]).toFixed(2);
      return cmd + n.join(" ") + " ";
    });
  }

  function path(d, fill, extra) { return '<path d="' + d + '" fill="' + fill + '"' + (extra || "") + "/>"; }
  function line(d, stroke, w, extra) {
    extra = extra || "";
    var cap = extra.indexOf("stroke-linecap") < 0 ? ' stroke-linecap="round"' : "";
    return '<path d="' + d + '" fill="none" stroke="' + stroke + '" stroke-width="' + w + '"' + cap + ' stroke-linejoin="round"' + extra + "/>";
  }
  function stitch(d, c) { return line(d, light(c, 0.2), 0.8, ' stroke-dasharray="2.2 1.8" opacity=".55"'); }
  function seam(d, c) { return line(d, dark(c, 0.32), 1.1, ' opacity=".7"'); }
  /* Bo gân: tô màu nền rồi phủ hoạ tiết sọc dọc */
  function rib(d, c) { return path(d, dark(c, 0.04)) + path(d, "url(#rib)"); }

  /* ---------- defs dùng chung ---------- */
  function defs(p) {
    var seed = p.seed || (p.id.length * 7 + p.price % 97);
    var heather = !!p.heather;
    return "<defs>" +
      '<linearGradient id="wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a4a24"/><stop offset=".45" stop-color="#4a200d"/><stop offset="1" stop-color="#1c0a04"/></linearGradient>' +
      '<linearGradient id="metal" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6f737a"/><stop offset=".45" stop-color="#e6e8ec"/><stop offset="1" stop-color="#80848b"/></linearGradient>' +
      '<linearGradient id="side" gradientUnits="userSpaceOnUse" x1="34" y1="0" x2="266" y2="0">' +
        '<stop offset="0" stop-color="#000" stop-opacity=".36"/><stop offset=".12" stop-color="#000" stop-opacity=".1"/>' +
        '<stop offset=".32" stop-color="#fff" stop-opacity=".07"/><stop offset=".55" stop-color="#fff" stop-opacity=".02"/>' +
        '<stop offset=".86" stop-color="#000" stop-opacity=".12"/><stop offset="1" stop-color="#000" stop-opacity=".4"/></linearGradient>' +
      '<linearGradient id="fall" gradientUnits="userSpaceOnUse" x1="0" y1="40" x2="0" y2="370">' +
        '<stop offset="0" stop-color="#fff" stop-opacity=".14"/><stop offset=".35" stop-color="#fff" stop-opacity="0"/>' +
        '<stop offset=".8" stop-color="#000" stop-opacity=".08"/><stop offset="1" stop-color="#000" stop-opacity=".2"/></linearGradient>' +
      '<pattern id="rib" width="3.4" height="10" patternUnits="userSpaceOnUse"><rect width="1.4" height="10" fill="#000" opacity=".2"/><rect x="1.9" width=".7" height="10" fill="#fff" opacity=".08"/></pattern>' +
      '<filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.4"/></filter>' +
      '<filter id="soft2" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.4"/></filter>' +
      /* Hạt vải: nhiễu fractal -> chấm tối. Áo heather thêm chấm sáng. */
      '<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="' + (heather ? ".95 .6" : ".9") + '" numOctaves="2" seed="' + seed + '" stitchTiles="stitch"/>' +
        '<feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ' + (heather ? "2.4 0 0 0 -1.05" : "1.7 0 0 0 -0.72") + '"/></filter>' +
      '<filter id="grainL" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".8 .5" numOctaves="2" seed="' + (seed + 11) + '" stitchTiles="stitch"/>' +
        '<feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 2.4 0 0 -1.1"/></filter>' +
      "</defs>";
  }

  /* ---------- móc + giá gỗ ---------- */
  var HOOK =
    line("M150 64 L150 28 C150 13 162 5 172 11 C180 16 180 27 171 30", "#9a7332", 3.4) +
    line("M149.1 62 L149.1 28 C149.1 14 161 6.6 170.6 12", "#f6dea0", 1, ' opacity=".9"');
  var HANGER_D = "M66 86 C96 73 126 63 144 61 L156 61 C174 63 204 73 234 86 C237 87.5 236 92 232.5 91.5 C202 82 172 72 150 71 C128 72 98 82 67.5 91.5 C64 92 63 87.5 66 86 Z";
  var HANGER =
    path(HANGER_D, "url(#wood)") +
    line("M68 87 C98 75 128 65 150 63.5 C172 65 202 75 232 87", "#ffffff", 0.9, ' opacity=".25"') +
    '<rect x="146" y="58" width="8" height="9" rx="2" fill="#c79a48"/>';

  /* ---------- hình dáng từng dòng áo ----------
     Mỗi hàm trả về:
       sil:   các path tạo thành bóng áo (để cắt lớp đổ bóng / hạt vải)
       under: lớp nằm sau giá gỗ (mũ áo nhìn từ trước)
       base:  thân, tay, bo gân
       top:   chi tiết nằm trên thân (cổ, túi, khoá, cúc...)
       folds: nếp gấp mềm {d, w, o, l(sáng)}
       print: tâm in {x, y, w} trước/sau
       after: chi tiết vẽ sau cùng (dây mũ, khoá kim loại) */

  var HOOD_BACK = "M106 98 C98 72 114 44 150 42 C186 44 202 72 194 98 Z";
  var SLEEVE = "M76 92 C60 100 50 124 46 160 L39 292 L67 295 L71 170 C72 140 74 112 76 92 Z";
  var CUFF = "M39 290 L67 293 L66 320 L38 317 Z";
  var BODY_HOOD = "M121 70 C110 72 92 80 74 90 C70 140 68 220 66 300 L234 300 C232 220 230 140 226 90 C208 80 190 72 179 70 C171 82 161 87 150 87 C139 87 129 82 121 70 Z";
  var BODY_BACK = "M121 70 C110 72 92 80 74 90 C70 140 68 220 66 300 L234 300 C232 220 230 140 226 90 C208 80 190 72 179 70 C171 74 161 76 150 76 C139 76 129 74 121 70 Z";
  var HEM = "M66 298 L234 298 L233 328 L67 328 Z";

  var FOLDS_LONG = [
    { d: "M74 96 C72 160 70 230 68 296", w: 7, o: 0.28 },
    { d: "M226 96 C228 160 230 230 232 296", w: 7, o: 0.28 },
    { d: "M98 112 C102 160 97 230 100 296", w: 9, o: 0.12 },
    { d: "M202 112 C198 160 203 230 200 296", w: 9, o: 0.12 },
    { d: "M116 132 C121 170 114 200 118 212", w: 12, o: 0.08, l: 1 },
    { d: "M186 140 C182 170 188 196 184 212", w: 10, o: 0.07, l: 1 },
    { d: "M54 130 C50 190 48 240 47 288", w: 8, o: 0.09, l: 1 },
    { d: "M246 130 C250 190 252 240 253 288", w: 6, o: 0.06, l: 1 },
    { d: "M62 140 C62 200 60 250 60 290", w: 5, o: 0.12 },
    { d: "M238 140 C238 200 240 250 240 290", w: 5, o: 0.12 }
  ];

  function hoodieShape(c, view, zip) {
    var s = {
      sil: [SLEEVE, mirror(SLEEVE), CUFF, mirror(CUFF), view === "front" ? BODY_HOOD : BODY_BACK, HEM],
      under: "", base: "", top: "", after: "",
      folds: FOLDS_LONG.slice(),
      print: view === "front" ? { x: 150, y: 170, w: 112 } : { x: 150, y: 226, w: 128 }
    };
    s.base =
      path(SLEEVE, c) + path(mirror(SLEEVE), c) +
      rib(CUFF, c) + rib(mirror(CUFF), c) +
      path(view === "front" ? BODY_HOOD : BODY_BACK, c) + rib(HEM, c) +
      seam("M74 92 C78 118 80 140 80 168", c) + seam(mirror("M74 92 C78 118 80 140 80 168"), c);

    if (view === "front") {
      s.sil.push(HOOD_BACK);
      s.under = path(HOOD_BACK, dark(c, 0.2)) + line("M112 92 C108 70 122 50 150 48 C178 50 192 70 188 92", light(c, 0.08), 1.2, ' opacity=".5"');
      var NECK = "M121 70 C126 96 139 116 150 126 C161 116 174 96 179 70 C166 64 134 64 121 70 Z";
      var FLAP = "M114 68 C108 90 122 114 151 136 L151 125 C136 112 126 94 125 70 Z";
      s.top =
        path(NECK, dark(c, 0.55)) +
        '<clipPath id="neckclip"><path d="' + NECK + '"/></clipPath><g clip-path="url(#neckclip)">' + HANGER + "</g>" +
        path(FLAP, light(c, 0.03)) + stitch("M118.5 71 C115 92 127 112 150 131", c) +
        path(mirror(FLAP), light(c, 0.05)) + stitch(mirror("M118.5 71 C115 92 127 112 150 131"), c) +
        line("M125 70 C126 94 136 112 151 125", dark(c, 0.4), 1.4, ' opacity=".55"') +
        line(mirror("M125 70 C126 94 136 112 151 125"), dark(c, 0.4), 1.4, ' opacity=".55"');

      if (zip) {
        var PL = "M100 216 L147 216 L147 298 L88 298 C93 264 97 238 100 216 Z";
        s.top += path(PL, c) + path(mirror(PL), c) +
          line("M100 216 C96 240 91 262 88 280", dark(c, 0.45), 1.6) + line(mirror("M100 216 C96 240 91 262 88 280"), dark(c, 0.45), 1.6) +
          stitch("M102 221 L145 221", c) + stitch(mirror("M102 221 L145 221"), c);
        s.after =
          line("M150 128 L150 333", dark(c, 0.3), 7) +
          line("M150 128 L150 333", "url(#metal)", 3.2, ' stroke-dasharray="1.4 1.3" stroke-linecap="butt"') +
          '<rect x="146.5" y="128" width="7" height="13" rx="2" fill="url(#metal)"/><rect x="148" y="139" width="4" height="10" rx="1.5" fill="#8b8f96"/>';
        s.print = { x: 186, y: 140, w: 40, side: true };
      } else {
        var POCKET = "M100 216 L200 216 C203 238 207 264 212 298 L88 298 C93 264 97 238 100 216 Z";
        s.top += path(POCKET, light(c, 0.02)) +
          line("M101 217 L199 217", dark(c, 0.35), 1.3) +
          line("M100 216 C96 240 91 262 88 280", dark(c, 0.5), 1.8) + line(mirror("M100 216 C96 240 91 262 88 280"), dark(c, 0.5), 1.8) +
          stitch("M103 222 L197 222", c) + stitch("M104 222 C100 244 96 264 93 280", c) + stitch(mirror("M104 222 C100 244 96 264 93 280"), c);
        s.folds.push({ d: "M100 222 L200 222", w: 6, o: 0.14 });
      }
      if (!zip) {
        var str = lum(c) < 0.35 ? light(c, 0.22) : dark(c, 0.06);
        s.after =
          '<circle cx="140" cy="122" r="2.6" fill="url(#metal)"/><circle cx="160" cy="122" r="2.6" fill="url(#metal)"/>' +
          line("M140 123 C139 148 137 170 136 197", str, 3.6) + line("M160 123 C162 150 164 174 165 203", str, 3.6) +
          line("M139.2 124 C138.4 148 136.6 170 135.6 196", light(str, 0.25), 1, ' opacity=".6"') +
          line("M136 194 L135.6 207", "url(#metal)", 4.2, ' stroke-linecap="butt"') +
          line("M165 200 L165.4 213", "url(#metal)", 4.2, ' stroke-linecap="butt"');
      } else {
        s.after +=
          '<circle cx="138" cy="120" r="2.4" fill="url(#metal)"/><circle cx="162" cy="120" r="2.4" fill="url(#metal)"/>' +
          line("M138 121 C136 140 134 156 133 176", light(c, 0.2), 3.2) + line("M162 121 C164 142 166 158 167 180", light(c, 0.2), 3.2);
      }
    } else {
      /* Mặt sau: mũ nằm phẳng trên lưng */
      var HOOD = "M98 74 C92 116 112 162 150 172 C188 162 208 116 202 74 C184 64 116 64 98 74 Z";
      s.top =
        '<g filter="url(#soft)">' + path("M100 86 C96 124 116 168 150 178 C184 168 204 124 200 86", "#000", ' opacity=".22"') + "</g>" +
        path(HOOD, light(c, 0.02)) +
        line("M150 68 C151 110 150 140 150 172", dark(c, 0.4), 1.4) +
        stitch("M147 70 C148 110 147 140 147.5 168", c) + stitch("M153 70 C153.5 110 153 140 152.5 168", c) +
        line("M100 76 C96 116 114 160 150 170", light(c, 0.14), 1.4, ' opacity=".5"');
      s.folds.push({ d: "M110 180 C130 186 170 186 190 180", w: 10, o: 0.12 });
    }
    return s;
  }

  function crewShape(c, view) {
    var BODY = view === "front"
      ? "M123 72 C112 74 92 80 74 90 C70 140 68 220 66 300 L234 300 C232 220 230 140 226 90 C208 80 188 74 177 72 C170 84 161 89 150 89 C139 89 130 84 123 72 Z"
      : "M123 72 C112 74 92 80 74 90 C70 140 68 220 66 300 L234 300 C232 220 230 140 226 90 C208 80 188 74 177 72 C170 76 161 78 150 78 C139 78 130 76 123 72 Z";
    var s = {
      sil: [SLEEVE, mirror(SLEEVE), CUFF, mirror(CUFF), BODY, HEM],
      under: "", top: "", after: "",
      folds: FOLDS_LONG.slice(),
      print: view === "front" ? { x: 150, y: 150, w: 112 } : { x: 150, y: 160, w: 128 }
    };
    s.base = path(SLEEVE, c) + path(mirror(SLEEVE), c) + rib(CUFF, c) + rib(mirror(CUFF), c) + path(BODY, c) + rib(HEM, c) +
      seam("M74 92 C78 118 80 140 80 168", c) + seam(mirror("M74 92 C78 118 80 140 80 168"), c);
    if (view === "front") {
      var NECK = "M131 70 C135 80 142 84 150 84 C158 84 165 80 169 70 C160 66 140 66 131 70 Z";
      var COLLAR = "M123 72 C130 86 140 92 150 92 C160 92 170 86 177 72 L169 70 C165 80 158 84 150 84 C142 84 135 80 131 70 Z";
      s.top =
        path(NECK, dark(c, 0.5)) +
        '<clipPath id="neckclip"><path d="' + NECK + '"/></clipPath><g clip-path="url(#neckclip)">' + HANGER + "</g>" +
        rib(COLLAR, c) + line("M124 73 C131 87 141 93 150 93 C159 93 169 87 176 73", dark(c, 0.35), 1) +
        line("M145 93 L150 102 L155 93", dark(c, 0.3), 1.1, ' opacity=".7"');
    } else {
      var BCOLLAR = "M123 72 C130 77 140 79 150 79 C160 79 170 77 177 72 L175 68 C166 72 158 73 150 73 C142 73 134 72 125 68 Z";
      s.top = rib(BCOLLAR, c);
    }
    return s;
  }

  function teeShape(c, view) {
    var SL = "M84 86 C66 94 50 112 38 140 L62 160 C68 148 76 136 82 128 Z";
    var BODY = view === "front"
      ? "M124 72 C112 74 98 79 84 86 C80 100 78 120 78 140 L76 298 L224 298 L222 140 C222 120 220 100 216 86 C202 79 188 74 176 72 C170 82 161 86 150 86 C139 86 130 82 124 72 Z"
      : "M124 72 C112 74 98 79 84 86 C80 100 78 120 78 140 L76 298 L224 298 L222 140 C222 120 220 100 216 86 C202 79 188 74 176 72 C170 75 161 77 150 77 C139 77 130 75 124 72 Z";
    var s = {
      sil: [SL, mirror(SL), BODY],
      under: "", top: "", after: "",
      folds: [
        { d: "M84 92 C82 160 80 230 79 294", w: 6, o: 0.26 },
        { d: "M216 92 C218 160 220 230 221 294", w: 6, o: 0.26 },
        { d: "M106 140 C110 190 104 240 108 294", w: 9, o: 0.1 },
        { d: "M194 150 C190 200 196 240 192 294", w: 9, o: 0.1 },
        { d: "M122 116 C126 150 120 190 124 230", w: 12, o: 0.08, l: 1 },
        { d: "M80 100 C70 112 60 124 52 138", w: 6, o: 0.16 },
        { d: "M220 100 C230 112 240 124 248 138", w: 6, o: 0.16 }
      ],
      print: view === "front" ? { x: 150, y: 150, w: 104 } : { x: 150, y: 150, w: 104 }
    };
    s.base = path(SL, c) + path(mirror(SL), c) + path(BODY, c) +
      stitch("M41 143 L63 157", c) + stitch(mirror("M41 143 L63 157"), c) +
      stitch("M77 290 L223 290", c) +
      seam("M84 88 C88 104 86 118 82 128", c) + seam(mirror("M84 88 C88 104 86 118 82 128"), c);
    if (view === "front") {
      var NECK = "M130 71 C134 79 141 83 150 83 C159 83 166 79 170 71 C160 67 140 67 130 71 Z";
      var COLLAR = "M124 72 C130 84 140 89 150 89 C160 89 170 84 176 72 L170 71 C166 79 159 83 150 83 C141 83 134 79 130 71 Z";
      s.top = path(NECK, dark(c, 0.5)) +
        '<clipPath id="neckclip"><path d="' + NECK + '"/></clipPath><g clip-path="url(#neckclip)">' + HANGER + "</g>" +
        rib(COLLAR, c) + line("M125 73 C131 85 141 90 150 90 C159 90 169 85 175 73", dark(c, 0.3), 0.9);
    } else {
      s.top = rib("M124 72 C130 76 140 78 150 78 C160 78 170 76 176 72 L174 68 C166 72 158 73 150 73 C142 73 134 72 126 68 Z", c);
    }
    return s;
  }

  function coatShape(c, view) {
    var SL = "M70 88 C58 94 50 112 48 136 L42 304 L70 307 L74 146 C74 124 72 104 70 88 Z";
    var BODY = view === "front"
      ? "M118 66 C104 68 86 74 70 84 C66 90 64 102 64 116 L60 362 L240 362 L236 116 C236 102 234 90 230 84 C214 74 196 68 182 66 L150 80 Z"
      : "M118 66 C104 68 86 74 70 84 C66 90 64 102 64 116 L60 362 L240 362 L236 116 C236 102 234 90 230 84 C214 74 196 68 182 66 C170 70 160 72 150 72 C140 72 130 70 118 66 Z";
    var s = {
      sil: [SL, mirror(SL), BODY],
      under: "", top: "", after: "",
      folds: [
        { d: "M70 90 C68 180 64 270 62 358", w: 7, o: 0.3 },
        { d: "M230 90 C232 180 236 270 238 358", w: 7, o: 0.3 },
        { d: "M100 210 C102 260 96 310 100 358", w: 10, o: 0.12 },
        { d: "M200 214 C198 260 204 310 200 358", w: 10, o: 0.12 },
        { d: "M90 120 C94 170 92 220 94 260", w: 12, o: 0.06, l: 1 },
        { d: "M56 120 C52 190 50 250 48 300", w: 7, o: 0.08, l: 1 }
      ],
      print: { x: 150, y: 170, w: 100 }
    };
    s.base = path(SL, c) + path(mirror(SL), c) + path(BODY, c) +
      line("M43 284 L70 287", dark(c, 0.35), 1) + line(mirror("M43 284 L70 287"), dark(c, 0.35), 1) +
      '<circle cx="62" cy="296" r="2.2" fill="' + dark(c, 0.45) + '"/><circle cx="55" cy="295" r="2.2" fill="' + dark(c, 0.45) + '"/>' +
      '<circle cx="238" cy="296" r="2.2" fill="' + dark(c, 0.45) + '"/><circle cx="245" cy="295" r="2.2" fill="' + dark(c, 0.45) + '"/>' +
      seam("M70 86 C74 104 74 124 74 146", c) + seam(mirror("M70 86 C74 104 74 124 74 146"), c) +
      stitch("M61 354 L239 354", c);
    if (view === "front") {
      var LINING = "M120 66 C134 63 166 63 180 66 L158 208 L152 208 Z";
      var COLLAR = "M118 66 C130 60 170 60 182 66 L178 72 C166 66 134 66 122 72 Z";
      var LAPEL = "M119 66 C112 78 104 90 98 104 L110 109 L103 117 C118 152 136 184 153 210 L156 202 C146 160 138 118 131 70 Z";
      s.top =
        path(LINING, dark(c, 0.6)) +
        '<clipPath id="neckclip"><path d="' + LINING + '"/></clipPath><g clip-path="url(#neckclip)">' + HANGER + "</g>" +
        path(COLLAR, dark(c, 0.15)) +
        '<g filter="url(#soft2)">' + line("M104 118 C120 154 138 186 154 212", "#000", 3, ' opacity=".35"') + line(mirror("M104 118 C120 154 138 186 154 212"), "#000", 3, ' opacity=".35"') + "</g>" +
        path(LAPEL, light(c, 0.05)) + path(mirror(LAPEL), light(c, 0.07)) +
        line("M131 70 C138 118 146 160 156 202", light(c, 0.18), 0.9, ' opacity=".6"') +
        line(mirror("M131 70 C138 118 146 160 156 202"), light(c, 0.18), 0.9, ' opacity=".6"') +
        line("M155 208 L160 362", dark(c, 0.45), 1.3) +
        stitch("M101 106 C116 146 134 180 152 204", c) + stitch(mirror("M101 106 C116 146 134 180 152 204"), c) +
        '<g filter="url(#soft2)">' + path("M78 288 L120 286 L121 292 L79 294 Z", "#000", ' opacity=".35"') + path(mirror("M78 288 L120 286 L121 292 L79 294 Z"), "#000", ' opacity=".35"') + "</g>" +
        path("M77 274 L120 272 L121 287 L78 289 Z", light(c, 0.04)) + path(mirror("M77 274 L120 272 L121 287 L78 289 Z"), light(c, 0.04)) +
        stitch("M79 285 L119 283", c) + stitch(mirror("M79 285 L119 283"), c) +
        path("M176 150 L206 146 L206 152 L176 156 Z", dark(c, 0.3));
      [226, 262, 298].forEach(function (y) {
        [128, 176].forEach(function (x) {
          s.after += '<circle cx="' + x + '" cy="' + y + '" r="4.6" fill="' + dark(c, 0.5) + '"/><circle cx="' + (x - 1) + '" cy="' + (y - 1) + '" r="3" fill="' + light(c, 0.12) + '" opacity=".55"/>' +
            '<circle cx="' + x + '" cy="' + y + '" r="4.6" fill="none" stroke="' + dark(c, 0.6) + '" stroke-width=".8"/>';
        });
      });
      s.folds.push({ d: "M150 214 C152 260 150 310 152 358", w: 8, o: 0.1 });
    } else {
      s.top =
        path("M118 66 C130 58 170 58 182 66 L182 80 C170 74 130 74 118 80 Z", dark(c, 0.12)) +
        line("M118 80 C130 74 170 74 182 80", dark(c, 0.4), 1) +
        line("M150 80 L150 300", dark(c, 0.4), 1.2) +
        '<g filter="url(#soft2)">' + line("M152 300 L152 362", "#000", 3, ' opacity=".4"') + "</g>" +
        line("M150 300 L150 362", dark(c, 0.55), 1.3) +
        path("M110 196 L190 196 L190 210 L110 210 Z", light(c, 0.04)) +
        stitch("M112 199 L188 199", c) + stitch("M112 207 L188 207", c) +
        '<circle cx="118" cy="203" r="3.4" fill="' + dark(c, 0.5) + '"/><circle cx="182" cy="203" r="3.4" fill="' + dark(c, 0.5) + '"/>';
    }
    return s;
  }

  function jacketShape(c, view) {
    var SL = "M74 90 C60 98 50 122 46 156 L40 290 L67 293 L70 168 C71 138 72 112 74 90 Z";
    var CF = "M40 280 L67 283 L67 304 L40 301 Z";
    var BODY = view === "front"
      ? "M122 70 C110 72 92 80 74 90 C70 140 68 220 66 306 L234 306 C232 220 230 140 226 90 C208 80 190 72 178 70 L150 82 Z"
      : "M122 70 C110 72 92 80 74 90 C70 140 68 220 66 306 L234 306 C232 220 230 140 226 90 C208 80 190 72 178 70 C170 73 160 75 150 75 C140 75 130 73 122 70 Z";
    var s = {
      sil: [SL, mirror(SL), CF, mirror(CF), BODY],
      under: "", top: "", after: "",
      folds: FOLDS_LONG.slice(0, 8).concat([{ d: "M70 300 C110 296 190 296 230 300", w: 6, o: 0.15 }]),
      print: view === "front" ? { x: 184, y: 128, w: 38, side: true } : { x: 150, y: 176, w: 128 }
    };
    s.base = path(SL, c) + path(mirror(SL), c) + path(CF, dark(c, 0.05)) + path(mirror(CF), dark(c, 0.05)) + path(BODY, c) +
      stitch("M41 284 L66 287", c) + stitch(mirror("M41 284 L66 287"), c) +
      stitch("M67 298 L233 298", c) +
      seam("M74 92 C78 118 80 140 80 168", c) + seam(mirror("M74 92 C78 118 80 140 80 168"), c);
    if (view === "front") {
      var NECK = "M124 70 C134 66 166 66 176 70 L150 84 Z";
      var LEAF = "M122 68 C116 76 108 84 102 92 L137 106 L150 84 C141 81 131 76 124 69 Z";
      s.top =
        path(NECK, dark(c, 0.5)) +
        '<g filter="url(#soft2)">' + path("M104 96 L138 110 L150 90", "#000", ' opacity=".4"') + path(mirror("M104 96 L138 110 L150 90"), "#000", ' opacity=".4"') + "</g>" +
        path(LEAF, light(c, 0.06)) + path(mirror(LEAF), light(c, 0.08)) +
        stitch("M106 92 L136 103", c) + stitch(mirror("M106 92 L136 103"), c) +
        line("M150 84 L150 306", dark(c, 0.5), 1.2) + stitch("M155 90 L155 302", c) +
        path("M88 126 L136 126 L136 140 L88 140 Z", light(c, 0.05)) + stitch("M90 137 L134 137", c) +
        line("M88 140 L136 140", dark(c, 0.5), 1) +
        path("M164 126 L212 126 L212 140 L164 140 Z", light(c, 0.05)) + stitch("M166 137 L210 137", c) +
        line("M164 140 L212 140", dark(c, 0.5), 1) +
        line("M90 141 L90 180 L134 180 L134 141", dark(c, 0.4), 1, ' opacity=".7"') +
        line("M166 141 L166 180 L210 180 L210 141", dark(c, 0.4), 1, ' opacity=".7"');
      [110, 150, 190, 230, 270].forEach(function (y) {
        s.after += '<circle cx="150" cy="' + y + '" r="3.6" fill="url(#metal)"/><circle cx="150" cy="' + y + '" r="1.4" fill="#5c6067"/>';
      });
      s.after += '<circle cx="112" cy="133" r="2.6" fill="url(#metal)"/><circle cx="188" cy="133" r="2.6" fill="url(#metal)"/>';
      s.print = null;
    } else {
      s.top = path("M120 70 C132 64 168 64 180 70 L178 78 C166 74 134 74 122 78 Z", dark(c, 0.1)) +
        line("M76 116 C110 122 190 122 224 116", dark(c, 0.4), 1.1) + stitch("M76 120 C110 126 190 126 224 120", c);
    }
    return s;
  }

  var SHAPES = {
    hoodie: function (c, v) { return hoodieShape(c, v, false); },
    zip: function (c, v) { return hoodieShape(c, v, true); },
    crew: crewShape,
    tee: teeShape,
    coat: coatShape,
    jacket: jacketShape
  };

  /* ---------- hình in ---------- */
  function flame(x, y, s, fill) {
    return '<path transform="translate(' + x + " " + y + ") scale(" + s + ')" fill="' + fill + '" d="M0 -11 C3.5 -7 7 -3.6 6 2 C5.4 6.4 2.6 9 0 9 C-3 9 -6 6.6 -6 2.4 C-6 -1.2 -3.6 -3.4 -2.4 -6 C-1.8 -2.6 -0.6 -1.2 0.6 -1.2 C1.2 -4.6 0.2 -8 0 -11 Z"/>';
  }

  function print(kind, box, c, back) {
    if (!box || !kind || kind === "none") return "";
    var ink = lum(c) < 0.42 ? "#ece5d6" : "#1f1f22";
    var x = box.x, y = box.y;

    if (box.side || kind === "mini") {
      /* chữ nhỏ ở ngực trái (phía phải người nhìn) */
      var mx = box.side ? box.x : 184, my = box.side ? box.y : (back ? y : 132);
      if (back) { mx = x; my = y - 30; }
      return '<g opacity=".92">' + flame(mx - 17, my - 2, 0.55, ink) +
        '<text x="' + (mx - 10) + '" y="' + (my + 1.5) + '" font-family="Arial Black, Segoe UI Black, Arial, sans-serif" font-weight="900" font-size="9" letter-spacing="1" fill="' + ink + '">ARDOR</text></g>';
    }
    if (kind === "varsity") {
      var o = lum(c) < 0.42 ? dark(c, 0.25) : "#f4efe4";
      return '<path id="arc" d="M' + (x - 62) + " " + (y + 4) + " Q" + x + " " + (y - 34) + " " + (x + 62) + " " + (y + 4) + '" fill="none"/>' +
        '<text font-family="Rockwell, Rockwell Extra Bold, Clarendon, Georgia, serif" font-weight="800" font-size="31" letter-spacing="1.5" text-anchor="middle" fill="' + ink + '" stroke="' + ink + '" stroke-width="5" stroke-linejoin="round"><textPath href="#arc" xlink:href="#arc" startOffset="50%">ARDOR</textPath></text>' +
        '<text font-family="Rockwell, Rockwell Extra Bold, Clarendon, Georgia, serif" font-weight="800" font-size="31" letter-spacing="1.5" text-anchor="middle" fill="' + ink + '" stroke="' + o + '" stroke-width="1.6" stroke-linejoin="round" paint-order="stroke"><textPath href="#arc" xlink:href="#arc" startOffset="50%">ARDOR</textPath></text>' +
        '<text x="' + x + '" y="' + (y + 20) + '" text-anchor="middle" font-family="Georgia, Times New Roman, serif" font-size="9.5" letter-spacing="3.2" fill="' + ink + '">ORIGINAL</text>';
    }
    if (kind === "gothic") {
      return '<path transform="translate(' + x + " " + (y - 30) + ')" fill="' + ink + '" d="M0 -7 L1.4 -1.4 L7 0 L1.4 1.4 L0 7 L-1.4 1.4 L-7 0 L-1.4 -1.4 Z"/>' +
        '<text x="' + x + '" y="' + (y + 4) + '" text-anchor="middle" font-family="Old English Text MT, Goudy Text MT, Engravers Old English, UnifrakturMaguntia, Times New Roman, serif" font-size="34" fill="' + ink + '">Ardor</text>' +
        '<text x="' + x + '" y="' + (y + 18) + '" text-anchor="middle" font-family="Georgia, Times New Roman, serif" font-size="6.5" letter-spacing="2.4" fill="' + ink + '" opacity=".85">EST. MMXXVI</text>';
    }
    if (kind === "flame") {
      return flame(x, y - 6, back ? 2.6 : 2.1, ink) +
        '<text x="' + x + '" y="' + (y + (back ? 36 : 30)) + '" text-anchor="middle" font-family="Arial Black, Segoe UI Black, Arial, sans-serif" font-weight="900" font-size="' + (back ? 10 : 8.5) + '" letter-spacing="3" fill="' + ink + '">ARDOR</text>';
    }
    if (kind === "slogan") {
      var f = 'font-family="Impact, Haettenschweiler, Arial Narrow, sans-serif" font-size="27" letter-spacing=".5" text-anchor="middle" fill="' + ink + '"';
      return '<text x="' + x + '" y="' + (y - 18) + '" ' + f + ">DRESSED</text>" +
        '<text x="' + x + '" y="' + (y + 8) + '" ' + f + ">IN FIRE</text>" +
        '<text x="' + x + '" y="' + (y + 22) + '" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="6.5" letter-spacing="2.6" fill="' + ink + '" opacity=".8">ARDOR · SINCE 2026</text>';
    }
    if (kind === "big") {
      return '<text x="' + x + '" y="' + (y + 6) + '" text-anchor="middle" font-family="Arial Black, Segoe UI Black, Arial, sans-serif" font-weight="900" font-size="' + Math.min(31, box.w * 0.24) + '" letter-spacing="-.5" fill="' + ink + '">ARDOR</text>' +
        '<text x="' + x + '" y="' + (y + 22) + '" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="7" letter-spacing="3.4" fill="' + ink + '" opacity=".85">DRESSED IN FIRE</text>' +
        flame(x, y - 30, 0.9, ink);
    }
    return "";
  }

  /* ---------- lắp ráp ---------- */
  function svg(p, view) {
    view = view || "front";
    var c = p.color || "#232326";
    var s = (SHAPES[p.type] || SHAPES.tee)(c, view);
    var kind = view === "front" ? p.print : p.back;
    var heather = !!p.heather;

    var folds = s.folds.map(function (f) {
      return '<path d="' + f.d + '" fill="none" stroke="' + (f.l ? "#fff" : "#000") + '" stroke-opacity="' + f.o + '" stroke-width="' + f.w + '" stroke-linecap="round"/>';
    }).join("");

    /* Áo sáng màu thì đổ bóng nhẹ tay hơn để không bẩn màu */
    var shadeK = lum(c) > 0.6 ? 0.75 : 1;
    /* Bản vẽ gốc hơi vuông; bóp ngang quanh tâm cho dáng áo thon, hình in giữ nguyên tỉ lệ */
    var sx = { hoodie: 0.86, zip: 0.86, crew: 0.86, jacket: 0.88, tee: 0.92, coat: 0.9 }[p.type] || 0.88;
    var squeeze = ' transform="translate(150 0) scale(' + sx + ' 1) translate(-150 0)"';

    return '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ' + VW + " " + VH + '" width="' + VW * 2 + '" height="' + VH * 2 + '">' +
      defs(p) +
      '<clipPath id="sil">' + s.sil.map(function (d) { return '<path d="' + d + '"/>'; }).join("") + "</clipPath>" +
      HOOK +
      "<g" + squeeze + ">" + s.under + HANGER + s.base + s.top + "</g>" +
      print(kind, s.print && { x: 150 + (s.print.x - 150) * sx, y: s.print.y, w: s.print.w, side: s.print.side }, c, view === "back") +
      "<g" + squeeze + ">" + s.after +
      '<g clip-path="url(#sil)" opacity="' + shadeK + '">' +
        '<rect width="300" height="400" fill="url(#side)"/>' +
        '<rect width="300" height="400" fill="url(#fall)"/>' +
        '<g filter="url(#soft)">' + folds + "</g>" +
        '<rect width="300" height="400" filter="url(#grain)" opacity="' + (heather ? 0.34 : 0.18) + '"/>' +
        (heather ? '<rect width="300" height="400" filter="url(#grainL)" opacity=".22"/>' : "") +
      "</g></g>" +
      "</svg>";
  }

  /* ---------- treo ảnh chụp lên móc ----------
     Ảnh sản phẩm (nền trong suốt) được đặt vào khung 600x800, cùng hệ toạ độ với bản
     vẽ SVG (đỉnh móc ở y = 12) để rail, khung chi tiết, giỏ hàng dùng chung được.
     top: mép trên của áo; shoulder: vị trí giá gỗ tính theo chiều cao áo;
     hw: nửa bề ngang giá theo bề ngang áo. "clip": thanh kẹp cho quần. */
  var HANG = {
    hoodie: { kind: "top", top: 96, shoulder: 0.3, hw: 0.22 },
    zip:    { kind: "top", top: 96, shoulder: 0.3, hw: 0.22 },
    crew:   { kind: "top", top: 132, shoulder: 0.05, hw: 0.36, neck: true },
    tee:    { kind: "top", top: 132, shoulder: 0.08, hw: 0.3, neck: true },
    tank:   { kind: "top", top: 132, shoulder: 0.06, hw: 0.3, neck: true },
    shirt:  { kind: "top", top: 128, shoulder: 0.1, hw: 0.28, neck: true },
    jeans:  { kind: "clip", top: 150, hw: 0.42 },
    pants:  { kind: "clip", top: 150, hw: 0.42 }
  };
  var K = 1.5; // khung 600x800 xuất ra 900x1200 cho nét

  function loadImg(src) {
    return new Promise(function (res, rej) {
      var i = new Image();
      i.onload = function () { res(i); };
      i.onerror = rej;
      i.src = src;
    });
  }
  function svgUri(body, defsMarkup) {
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" width="' + 600 * K + '" height="' + 800 * K + '"><defs>' + defsMarkup + "</defs>" + body + "</svg>");
  }
  /* Móc ARDOR: gỗ nâu sẫm đánh bóng, móc vàng đồng, chữ ARDOR khắc vàng */
  var HANG_DEFS =
    '<linearGradient id="wood" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1f0c05"/><stop offset=".28" stop-color="#5c2c13"/><stop offset=".5" stop-color="#8a4a24"/><stop offset=".72" stop-color="#55260f"/><stop offset="1" stop-color="#1c0a04"/></linearGradient>' +
    '<linearGradient id="woodV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a4a24"/><stop offset=".45" stop-color="#4a200d"/><stop offset="1" stop-color="#1c0a04"/></linearGradient>' +
    '<linearGradient id="gold" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8a6324"/><stop offset=".45" stop-color="#f1d18a"/><stop offset="1" stop-color="#9c7230"/></linearGradient>' +
    '<linearGradient id="goldV" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6dea0"/><stop offset=".55" stop-color="#c79a48"/><stop offset="1" stop-color="#94692a"/></linearGradient>';

  /* Chữ ARDOR khắc vàng, ngọn lửa nhỏ phía trên (bỏ lửa khi chỗ thấp như thanh quần) */
  function logo(y, size, withFlame) {
    var s = size / 28;
    return (withFlame ? flame(300, y - size * 0.72 - 3 - 9 * s, s, "url(#goldV)") : "") +
      '<text x="300" y="' + y + '" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-weight="700" font-size="' + size +
      '" letter-spacing="' + (size * 0.16).toFixed(2) + '" fill="url(#goldV)">ARDOR</text>';
  }
  function hook(y0) {
    return line("M300 " + y0 + " L300 56 C300 26 324 10 344 22 C360 32 360 54 342 60", "#9a7332", 6.4) +
      line("M298.3 " + (y0 - 4) + " L298.3 56 C298.3 28 322 13 341 24", "#f6dea0", 2, ' opacity=".9"');
  }

  /* Lớp sau áo. Áo: hai vai gỗ (nằm trong áo) + cổ giá nhô lên khỏi cổ áo, có chữ ARDOR;
     hoodie thì cổ giá nằm trong mũ, chỉ thấy móc. Quần: thanh gỗ ngang có chữ, viền vàng. */
  function hangerBack(h, top, hy, hw) {
    if (h.kind === "clip") {
      var by = top - 14, bw = hw + 10;
      return hook(by - 10) +
        '<rect x="' + (300 - bw) + '" y="' + (by - 10) + '" width="' + 2 * bw + '" height="20" rx="10" fill="url(#woodV)"/>' +
        line("M" + (300 - bw + 8) + " " + (by - 6) + " L" + (300 + bw - 8) + " " + (by - 6), "#ffffff", 1.4, ' opacity=".28"') +
        '<rect x="' + (300 - bw + 12) + '" y="' + (by + 5) + '" width="' + (2 * bw - 24) + '" height="2.4" rx="1.2" fill="url(#gold)"/>' +
        logo(by + 3.6, 10, false);
    }
    var d = "M" + (300 - hw) + " " + (hy + 0.3 * hw) + " C" + (300 - 0.55 * hw) + " " + (hy + 0.12 * hw) + " " + (300 - 0.2 * hw) + " " + hy + " 300 " + hy +
            " C" + (300 + 0.2 * hw) + " " + hy + " " + (300 + 0.55 * hw) + " " + (hy + 0.12 * hw) + " " + (300 + hw) + " " + (hy + 0.3 * hw);
    var out = '<path d="' + d + '" fill="none" stroke="url(#woodV)" stroke-width="16" stroke-linecap="round"/>' +
      '<path d="' + d + '" fill="none" stroke="#ffffff" stroke-width="1.6" opacity=".25" transform="translate(0 -5)"/>';
    if (!h.neck) return hook(hy) + out;
    var nt = top - 34; // đỉnh cổ giá: cao hơn cổ áo 34px để thấy chữ
    // cổ giá: mặt trên phẳng, hai bên loe dần xuống vai như móc vest
    return hook(nt + 2) + out +
      '<path d="M274 ' + (nt + 5) + " Q274 " + nt + " 279 " + nt + " L321 " + nt + " Q326 " + nt + " 326 " + (nt + 5) +
        " Q328 " + (hy - 10) + " 344 " + hy + " L256 " + hy + " Q272 " + (hy - 10) + " 274 " + (nt + 5) + ' Z" fill="url(#wood)"/>' +
      '<path d="M279 ' + nt + " L321 " + nt + '" stroke="#a5602f" stroke-width="2.2" stroke-linecap="round"/>' +
      line("M284 " + (nt + 4) + " C289 " + (nt + 14) + " 281 " + (nt + 24) + " 286 " + hy, "#1c0a04", 0.8, ' opacity=".35"') +
      line("M316 " + (nt + 4) + " C311 " + (nt + 16) + " 319 " + (nt + 26) + " 314 " + hy, "#1c0a04", 0.8, ' opacity=".3"') +
      line("M276.5 " + (nt + 5) + " Q275 " + (hy - 12) + " 262 " + (hy - 2), "#ffffff", 1.4, ' opacity=".3"') +
      logo(nt + 27, 8.6, true);
  }
  /* Lớp trước quần: hai kẹp vàng cắn vào cạp quần */
  function hangerFront(top, hw) {
    var out = "", y = top - 10;
    [-1, 1].forEach(function (s) {
      var x = 300 + s * hw * 0.78;
      out += '<rect x="' + (x - 11) + '" y="' + y + '" width="22" height="40" rx="4" fill="url(#gold)"/>' +
        '<rect x="' + (x - 11) + '" y="' + (y + 26) + '" width="22" height="14" rx="3" fill="#5c4019" opacity=".45"/>' +
        '<circle cx="' + x + '" cy="' + (y + 9) + '" r="3.6" fill="#6b4a1c"/>';
    });
    return out;
  }

  function hang(src, type) {
    var h = HANG[type] || HANG.tee;
    return loadImg(src).then(function (img) {
      var top = h.top, maxW = 500, maxH = 800 - top - 12;
      var s = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
      var gw = img.naturalWidth * s, gh = img.naturalHeight * s;
      var hy = top + (h.shoulder || 0) * gh;
      var hw = h.hw * gw;
      return Promise.all([
        loadImg(svgUri(hangerBack(h, top, hy, hw), HANG_DEFS)),
        h.kind === "clip" ? loadImg(svgUri(hangerFront(top, hw), HANG_DEFS)) : null
      ]).then(function (L) {
        var cv = document.createElement("canvas");
        cv.width = 600 * K; cv.height = 800 * K;
        var ctx = cv.getContext("2d");
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(L[0], 0, 0, cv.width, cv.height);
        ctx.drawImage(img, (300 - gw / 2) * K, top * K, gw * K, gh * K);
        if (L[1]) ctx.drawImage(L[1], 0, 0, cv.width, cv.height);
        return new Promise(function (res) {
          cv.toBlob(function (b) { res(b ? URL.createObjectURL(b) : src); }, "image/png");
        });
      });
    }).catch(function () { return src; });
  }

  /* SVG -> PNG (blob URL). Hỏng thì trả về data URI của SVG để vẫn hiện được. */
  function rasterize(markup) {
    var uri = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(markup);
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        try {
          var cv = document.createElement("canvas");
          cv.width = VW * 2; cv.height = VH * 2;
          cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
          cv.toBlob(function (b) { resolve(b ? URL.createObjectURL(b) : uri); }, "image/png");
        } catch (e) { resolve(uri); }
      };
      img.onerror = function () { resolve(uri); };
      img.src = uri;
    });
  }

  window.ArdorGarments = {
    svg: svg,
    rasterize: rasterize,
    hang: hang,
    /* Ảnh mặt trước / mặt sau của một sản phẩm: có ảnh chụp (p.photo) thì treo ảnh
       lên móc, không thì vẽ bằng SVG. Sản phẩm chỉ có một ảnh thì back trả về null. */
    front: function (p) {
      return p.photo ? hang(p.photo.front, p.type) : rasterize(svg(p, "front"));
    },
    back: function (p) {
      if (p.photo) return p.photo.back ? hang(p.photo.back, p.type) : Promise.resolve(null);
      return rasterize(svg(p, "back"));
    },
    hasBack: function (p) { return !p.photo || !!p.photo.back; },
    ratio: VH / VW,
    hookTop: 6 / VH
  };
})();
