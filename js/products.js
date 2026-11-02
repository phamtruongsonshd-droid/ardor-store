/* Danh mục sản phẩm ARDOR.
   Thứ tự trong mảng = thứ tự treo trên thanh rail. Giá tính bằng VND.
   photo.front / photo.back: ảnh sản phẩm đã tách nền (PNG trong suốt) trong
   assets/products/, tạo bằng ardor-assets-src/build.mjs. Web tự treo ảnh lên móc
   theo "type" (áo: giá gỗ, quần: thanh kẹp). Chỉ có photo.front thì ẩn tab Front/Back.
   Sản phẩm không có photo sẽ được vẽ bằng SVG (js/garments.js).
   onModel: ảnh người mẫu đang mặc sản phẩm (nền trắng, dọc ~4:5), ví dụ
   "assets/model/cupid-hoodie.webp". Có thì bấm vào áo trên rail sẽ hiện người mẫu
   mặc áo đó, kèm tab "On model"; chưa có thì khung chi tiết giữ như cũ. */
window.ARDOR_PRODUCTS = [
  { id: "cupid-hoodie",     name: "Cupid Heart Zip Hoodie", type: "hoodie", cat: "Hoodies", colorName: "Cloud-wash Black", price: 1590000, soldOut: [],
    photo: { front: "assets/products/cupid-hoodie-front.png", back: "assets/products/cupid-hoodie-back.png" },
    onModel: "assets/model/cupid-hoodie.webp" },
  { id: "baroque-denim",    name: "Baroque Wide Denim",     type: "jeans",  cat: "Bottoms", colorName: "Washed Black",     price: 1290000, soldOut: [],
    photo: { front: "assets/products/baroque-denim-front.png", back: "assets/products/baroque-denim-back.png" },
    onModel: "assets/model/baroque-denim.webp" },
  { id: "ash-tank",         name: "Ash Wash Tank",          type: "tank",   cat: "Tops",    colorName: "Acid Black",       price: 450000,  soldOut: [],
    photo: { front: "assets/products/ash-tank-front.png" },
    onModel: "assets/model/ash-tank.webp" },
  { id: "chrome-shirt",     name: "Chrome Script Shirt",    type: "shirt",  cat: "Tops",    colorName: "White Pinstripe",  price: 890000,  soldOut: ["XL"],
    photo: { front: "assets/products/chrome-shirt-back.png" },
    onModel: "assets/model/chrome-shirt.webp" },
  { id: "archer-hoodie",    name: "Archer Zip Hoodie",      type: "hoodie", cat: "Hoodies", colorName: "Cloud-wash Black", price: 1590000, soldOut: [],
    photo: { front: "assets/products/archer-hoodie-front.png", back: "assets/products/archer-hoodie-back.png" },
    onModel: "assets/model/archer-hoodie.webp" },
  { id: "boxy-tee",         name: "Essential Boxy Tee",     type: "tee",    cat: "Tops",    colorName: "Black",            price: 390000,  soldOut: [],
    photo: { front: "assets/products/boxy-tee-front.png", back: "assets/products/boxy-tee-back.png" },
    onModel: "assets/model/boxy-tee.webp" },
  { id: "cloud-sweatpants", name: "Cloud Wide Sweatpants",  type: "pants",  cat: "Bottoms", colorName: "Heather Grey",     price: 790000,  soldOut: ["S"],
    photo: { front: "assets/products/cloud-sweatpants-front.png" },
    onModel: "assets/model/cloud-sweatpants.webp" }
];

window.ARDOR_SIZES = ["S", "M", "L", "XL"];

/* Mô tả theo dòng sản phẩm: dùng ở khung chi tiết. */
window.ARDOR_COPY = {
  hoodie: { blurb: "Washed heavyweight fleece. Cropped, boxy, zipped.",
            details: ["420gsm cotton fleece, cloud-wash dye", "Cropped boxy fit, dropped shoulders", "Two-way metal zip, lined hood", "Large-format back print"] },
  jeans:  { blurb: "Wide-leg washed denim with tonal baroque embroidery.",
            details: ["13.5oz rigid cotton denim", "High rise, wide straight leg", "Tonal baroque embroidery on the back", "Made in Vietnam"] },
  tank:   { blurb: "Acid-washed raglan tank. Cut wide, worn hard.",
            details: ["240gsm cotton jersey, acid wash", "Raglan cut, wide armholes", "Ribbed crew collar", "Made in Vietnam"] },
  shirt:  { blurb: "Pinstripe camp shirt with a chrome script and chain print.",
            details: ["Cotton-blend pinstripe poplin", "Relaxed boxy fit, camp collar", "Chrome script and chain back print", "Made in Vietnam"] },
  tee:    { blurb: "Compact jersey tee. Boxy cut, thick collar.",
            details: ["260gsm compact cotton jersey", "Boxy fit, dropped shoulders", "Thick 2.5cm ribbed collar", "Made in Vietnam"] },
  pants:  { blurb: "Wide-leg fleece sweatpants. Elastic waist, puddle hem.",
            details: ["380gsm brushed cotton fleece", "Wide leg, relaxed puddle hem", "Elastic waist with drawcord, side pockets", "Made in Vietnam"] }
};
