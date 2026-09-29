// Font catalog and photo loading shared by the picker (index.html) and the editor (editor.js).
(() => {
const GF='Google Fonts',GE='源暎フォント／おたもん',JK='自家製フォント工房',MT='モトヤ';
// [name, CSS family, category, source, weight]
const JA=[
 ['しっぽり明朝 B1','"Shippori Mincho B1"','明朝',GF,500],
 ['源暎こぶり明朝','"GenEi Koburi Mincho"','明朝',GE],
 ['さつき源代明朝','"Satsuki Gendai Mincho"','明朝',GE],
 ['Zen Old Mincho','"Zen Old Mincho"','明朝',GF,500],
 ['Noto Serif JP','"Noto Serif JP"','明朝',GF,500],
 ['源暎ちくご明朝','"GenEi Chikugo Mincho"','明朝',GE],
 ['BIZ UDP明朝','"BIZ UDPMincho"','明朝',GF],
 ['Zen Maru Gothic','"Zen Maru Gothic"','丸ゴ',GF,500],
 ['M PLUS Rounded 1c','"M PLUS Rounded 1c"','丸ゴ',GF,500],
 ['源柔ゴシック','"GenJyuu Gothic"','丸ゴ',JK],
 ['モトヤLマルベリ','"Motoya L Maruberi"','丸ゴ',MT],
 ['棘丸ゴシック','"Toge Maru Gothic"','丸ゴ',GE],
 ['キウイ丸','"Kiwi Maru"','丸ゴ',GF],
 ['Noto Sans JP','"Noto Sans JP"','ゴシック',GF,500],
 ['Zen Kaku Gothic New','"Zen Kaku Gothic New"','ゴシック',GF,500],
 ['LINE Seed JP','"LINE Seed JP"','ゴシック',GF],
 ['モトヤLシーダ','"Motoya L Cedar"','ゴシック',MT],
 ['Klee One','"Klee One"','手書き',GF,600],
 ['Zen Kurenaido','"Zen Kurenaido"','手書き',GF],
 ['よもぎ','"Yomogi"','手書き',GF],
 ['Yusei Magic','"Yusei Magic"','手書き',GF],
 ['はちまるポップ','"Hachi Maru Pop"','ポップ',GF],
 ['もちいポップ','"Mochiy Pop One"','ポップ',GF],
 ['源暎ぽっぷる','"GenEi POPle"','ポップ',GE],
 ['Dela Gothic One','"Dela Gothic One"','見出し',GF],
 ['源暎きわみゴ','"GenEi Kiwami Go"','見出し',GE],
 ['源暎エムゴ','"GenEi M Gothic"','見出し',GE],
 ['RocknRoll One','"RocknRoll One"','見出し',GF],
 ['源暎アンチック','"GenEi Antique"','漫画',GE],
 ['びぜんアンチック','"BIZen Antique"','漫画',GE],
];
const EN=[
 ['Cormorant Garamond','"Cormorant Garamond"','Serif',GF,500],
 ['Playfair Display','"Playfair Display"','Serif',GF,500],
 ['Bodoni Moda','"Bodoni Moda"','Serif',GF,500],
 ['DM Serif Display','"DM Serif Display"','Serif',GF],
 ['Italiana','"Italiana"','Serif',GF],
 ['Cinzel','"Cinzel"','Serif',GF,500],
 ['Jost','"Jost"','Sans',GF,300],
 ['Josefin Sans','"Josefin Sans"','Sans',GF,300],
 ['Montserrat','"Montserrat"','Sans',GF,500],
 ['Poppins','"Poppins"','Sans',GF,500],
 ['Great Vibes','"Great Vibes"','Script',GF],
 ['Pinyon Script','"Pinyon Script"','Script',GF],
 ['Allura','"Allura"','Script',GF],
 ['Sacramento','"Sacramento"','Script',GF],
 ['Parisienne','"Parisienne"','Script',GF],
 ['Caveat','"Caveat"','Hand',GF,500],
 ['Homemade Apple','"Homemade Apple"','Hand',GF],
 ['Abril Fatface','"Abril Fatface"','Display',GF],
 ['Bebas Neue','"Bebas Neue"','Display',GF],
 ['Monoton','"Monoton"','Display',GF],
 ['Special Elite','"Special Elite"','Typewriter',GF],
 ['Courier Prime','"Courier Prime"','Typewriter',GF],
];
for(const f of [...JA,...EN])f[4]??=400;

// Shrink once so dozens of tiles and the editor never repaint a 12MP original. Nothing leaves the browser.
async function loadPhoto(file){
  const img=new Image(),src=URL.createObjectURL(file);img.src=src;
  try{await img.decode()}catch{URL.revokeObjectURL(src);throw new Error('decode')}
  const k=Math.min(1,2048/Math.max(img.naturalWidth,img.naturalHeight)),c=document.createElement('canvas');
  c.width=Math.round(img.naturalWidth*k);c.height=Math.round(img.naturalHeight*k);
  c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(src);
  const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',.92));
  return URL.createObjectURL(blob);
}

window.PICLEA={JA,EN,loadPhoto};
})();
