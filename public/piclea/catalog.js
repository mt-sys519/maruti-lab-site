// Font catalog, lazy font loading and photo loading, shared by the picker (index.html) and editor.js.
// Google Fonts rows come from Google's own metadata (popularity, weights) and google/fonts METADATA.pb
// (license); see licenses.html. Local rows are OFL / Apache fonts served from fonts/.
(() => {
const GF='Google Fonts',GE='源暎フォント／おたもん',JK='自家製フォント工房',MT='モトヤ';
// [name, CSS family, category, source, weight, weights the family has (only when more than one)]
const JA=[
 ['Noto Serif JP','"Noto Serif JP"','明朝',GF,500,[200,300,400,500,600,700,800,900]],
 ['Shippori Mincho','"Shippori Mincho"','明朝',GF,500,[400,500,600,700,800]],
 ['Sawarabi Mincho','"Sawarabi Mincho"','明朝',GF,400],
 ['源暎こぶり明朝','"GenEi Koburi Mincho"','明朝',GE,400],
 ['さつき源代明朝','"Satsuki Gendai Mincho"','明朝',GE,400],
 ['源暎ちくご明朝','"GenEi Chikugo Mincho"','明朝',GE,400],
 ['Zen Old Mincho','"Zen Old Mincho"','明朝',GF,500,[400,500,600,700,900]],
 ['Kaisei Decol','"Kaisei Decol"','明朝',GF,500,[400,500,700]],
 ['しっぽり明朝 B1','"Shippori Mincho B1"','明朝',GF,500,[400,500,600,700,800]],
 ['Hina Mincho','"Hina Mincho"','明朝',GF,400],
 ['BIZ UDP明朝','"BIZ UDPMincho"','明朝',GF,400,[400,700]],
 ['Kaisei Opti','"Kaisei Opti"','明朝',GF,500,[400,500,700]],
 ['Kaisei HarunoUmi','"Kaisei HarunoUmi"','明朝',GF,500,[400,500,700]],
 ['New Tegomin','"New Tegomin"','明朝',GF,400],
 ['M PLUS Rounded 1c','"M PLUS Rounded 1c"','丸ゴ',GF,500,[100,300,400,500,700,800,900]],
 ['Zen Maru Gothic','"Zen Maru Gothic"','丸ゴ',GF,500,[300,400,500,700,900]],
 ['源柔ゴシック','"GenJyuu Gothic"','丸ゴ',JK,400],
 ['モトヤLマルベリ','"Motoya L Maruberi"','丸ゴ',MT,400],
 ['棘丸ゴシック','"Toge Maru Gothic"','丸ゴ',GE,400],
 ['Kosugi Maru','"Kosugi Maru"','丸ゴ',GF,400],
 ['キウイ丸','"Kiwi Maru"','丸ゴ',GF,400,[300,400,500]],
 ['Tsukimi Rounded','"Tsukimi Rounded"','丸ゴ',GF,500,[300,400,500,600,700]],
 ['Noto Sans JP','"Noto Sans JP"','ゴシック',GF,500,[100,200,300,400,500,600,700,800,900]],
 ['LINE Seed JP','"LINE Seed JP"','ゴシック',GF,400,[100,400,700,800]],
 ['M PLUS 1p','"M PLUS 1p"','ゴシック',GF,500,[100,300,400,500,700,800,900]],
 ['Zen Kaku Gothic New','"Zen Kaku Gothic New"','ゴシック',GF,500,[300,400,500,700,900]],
 ['モトヤLシーダ','"Motoya L Cedar"','ゴシック',MT,400],
 ['Sawarabi Gothic','"Sawarabi Gothic"','ゴシック',GF,400],
 ['BIZ UDPゴシック','"BIZ UDPGothic"','ゴシック',GF,400,[400,700]],
 ['M PLUS 1','"M PLUS 1"','ゴシック',GF,500,[100,200,300,400,500,600,700,800,900]],
 ['M PLUS 2','"M PLUS 2"','ゴシック',GF,500,[100,200,300,400,500,600,700,800,900]],
 ['Zen Kaku Gothic Antique','"Zen Kaku Gothic Antique"','ゴシック',GF,500,[300,400,500,700,900]],
 ['Kosugi','"Kosugi"','ゴシック',GF,400],
 ['IBM Plex Sans JP','"IBM Plex Sans JP"','ゴシック',GF,500,[100,200,300,400,500,600,700]],
 ['Murecho','"Murecho"','ゴシック',GF,500,[100,200,300,400,500,600,700,800,900]],
 ['Yusei Magic','"Yusei Magic"','手書き',GF,400],
 ['Klee One','"Klee One"','手書き',GF,600,[400,600]],
 ['Zen Kurenaido','"Zen Kurenaido"','手書き',GF,400],
 ['よもぎ','"Yomogi"','手書き',GF,400],
 ['Slackside One','"Slackside One"','手書き',GF,400],
 ['Cherry Bomb One','"Cherry Bomb One"','ポップ',GF,400],
 ['源暎ぽっぷる','"GenEi POPle"','ポップ',GE,400],
 ['はちまるポップ','"Hachi Maru Pop"','ポップ',GF,400],
 ['Potta One','"Potta One"','ポップ',GF,400],
 ['もちいポップ','"Mochiy Pop One"','ポップ',GF,400],
 ['Darumadrop One','"Darumadrop One"','ポップ',GF,400],
 ['もちいポップ P','"Mochiy Pop P One"','ポップ',GF,400],
 ['Stick','"Stick"','見出し',GF,400],
 ['源暎きわみゴ','"GenEi Kiwami Go"','見出し',GE,400],
 ['源暎エムゴ','"GenEi M Gothic"','見出し',GE,400],
 ['Dela Gothic One','"Dela Gothic One"','見出し',GF,400],
 ['RocknRoll One','"RocknRoll One"','見出し',GF,400],
 ['Rampart One','"Rampart One"','見出し',GF,400],
 ['Monomaniac One','"Monomaniac One"','見出し',GF,400],
 ['Kaisei Tokumin','"Kaisei Tokumin"','見出し',GF,700,[400,500,700,800]],
 ['Reggae One','"Reggae One"','見出し',GF,400],
 ['Aoboshi One','"Aoboshi One"','見出し',GF,400],
 ['Train One','"Train One"','見出し',GF,400],
 ['Rock 3D','"Rock 3D"','見出し',GF,400],
 ['DotGothic16','"DotGothic16"','レトロ',GF,400],
 ['Zen Antique','"Zen Antique"','レトロ',GF,400],
 ['Shippori Antique','"Shippori Antique"','レトロ',GF,400],
 ['Zen Antique Soft','"Zen Antique Soft"','レトロ',GF,400],
 ['Shippori Antique B1','"Shippori Antique B1"','レトロ',GF,400],
 ['Chokokutai','"Chokokutai"','レトロ',GF,400],
 ['Yuji Mai','"Yuji Mai"','筆',GF,400],
 ['Yuji Syuku','"Yuji Syuku"','筆',GF,400],
 ['Yuji Boku','"Yuji Boku"','筆',GF,400],
 ['源暎アンチック','"GenEi Antique"','漫画',GE,400],
 ['びぜんアンチック','"BIZen Antique"','漫画',GE,400],
];
const EN=[
 ['Cormorant Garamond','"Cormorant Garamond"','Serif',GF,500,[300,400,500,600,700]],
 ['Instrument Serif','"Instrument Serif"','Serif',GF,400],
 ['Fraunces','"Fraunces"','Serif',GF,400,[100,200,300,400,500,600,700,800,900]],
 ['Newsreader','"Newsreader"','Serif',GF,400,[200,300,400,500,600,700,800]],
 ['Playfair Display','"Playfair Display"','Serif',GF,500,[400,500,600,700,800,900]],
 ['DM Serif Text','"DM Serif Text"','Serif',GF,400],
 ['Merriweather','"Merriweather"','Serif',GF,400,[300,400,500,600,700,800,900]],
 ['Lora','"Lora"','Serif',GF,400,[400,500,600,700]],
 ['Libre Caslon Text','"Libre Caslon Text"','Serif',GF,400,[400,700]],
 ['Abhaya Libre','"Abhaya Libre"','Serif',GF,400,[400,500,600,700,800]],
 ['Libre Baskerville','"Libre Baskerville"','Serif',GF,400,[400,500,600,700]],
 ['EB Garamond','"EB Garamond"','Serif',GF,400,[400,500,600,700,800]],
 ['Bentham','"Bentham"','Serif',GF,400],
 ['DM Serif Display','"DM Serif Display"','Serif',GF,400],
 ['Cinzel','"Cinzel"','Serif',GF,500,[400,500,600,700,800,900]],
 ['Bodoni Moda','"Bodoni Moda"','Serif',GF,500,[400,500,600,700,800,900]],
 ['Marcellus','"Marcellus"','Serif',GF,400],
 ['Cormorant','"Cormorant"','Serif',GF,400,[300,400,500,600,700]],
 ['Spectral','"Spectral"','Serif',GF,400,[200,300,400,500,600,700,800]],
 ['Crimson Pro','"Crimson Pro"','Serif',GF,400,[200,300,400,500,600,700,800,900]],
 ['Cardo','"Cardo"','Serif',GF,400,[400,700]],
 ['Baskervville','"Baskervville"','Serif',GF,400,[400,500,600,700]],
 ['Prata','"Prata"','Serif',GF,400],
 ['Old Standard TT','"Old Standard TT"','Serif',GF,400,[400,700]],
 ['Alice','"Alice"','Serif',GF,400],
 ['Gilda Display','"Gilda Display"','Serif',GF,400],
 ['Italiana','"Italiana"','Serif',GF,400],
 ['Gloock','"Gloock"','Serif',GF,400],
 ['Inter','"Inter"','Sans',GF,400,[100,200,300,400,500,600,700,800,900]],
 ['Montserrat','"Montserrat"','Sans',GF,500,[100,200,300,400,500,600,700,800,900]],
 ['Poppins','"Poppins"','Sans',GF,500,[100,200,300,400,500,600,700,800,900]],
 ['Jost','"Jost"','Sans',GF,300,[100,200,300,400,500,600,700,800,900]],
 ['DM Sans','"DM Sans"','Sans',GF,400,[100,200,300,400,500,600,700,800,900,1000]],
 ['Raleway','"Raleway"','Sans',GF,400,[100,200,300,400,500,600,700,800,900]],
 ['Nunito','"Nunito"','Sans',GF,400,[200,300,400,500,600,700,800,900,1000]],
 ['Manrope','"Manrope"','Sans',GF,400,[200,300,400,500,600,700,800]],
 ['Outfit','"Outfit"','Sans',GF,400,[100,200,300,400,500,600,700,800,900]],
 ['Montserrat Alternates','"Montserrat Alternates"','Sans',GF,400,[100,200,300,400,500,600,700,800,900]],
 ['Work Sans','"Work Sans"','Sans',GF,400,[100,200,300,400,500,600,700,800,900]],
 ['Plus Jakarta Sans','"Plus Jakarta Sans"','Sans',GF,400,[200,300,400,500,600,700,800]],
 ['Kumbh Sans','"Kumbh Sans"','Sans',GF,400,[100,200,300,400,500,600,700,800,900]],
 ['Figtree','"Figtree"','Sans',GF,400,[300,400,500,600,700,800,900]],
 ['Bricolage Grotesque','"Bricolage Grotesque"','Sans',GF,400,[200,300,400,500,600,700,800]],
 ['Quicksand','"Quicksand"','Sans',GF,400,[300,400,500,600,700]],
 ['Julius Sans One','"Julius Sans One"','Sans',GF,400],
 ['Space Grotesk','"Space Grotesk"','Sans',GF,400,[300,400,500,600,700]],
 ['Michroma','"Michroma"','Sans',GF,400],
 ['Belleza','"Belleza"','Sans',GF,400],
 ['Syncopate','"Syncopate"','Sans',GF,400,[400,700]],
 ['Josefin Sans','"Josefin Sans"','Sans',GF,300,[100,200,300,400,500,600,700]],
 ['Sora','"Sora"','Sans',GF,400,[100,200,300,400,500,600,700,800]],
 ['Lexend','"Lexend"','Sans',GF,400,[100,200,300,400,500,600,700,800,900]],
 ['Urbanist','"Urbanist"','Sans',GF,400,[100,200,300,400,500,600,700,800,900]],
 ['Fredoka','"Fredoka"','Sans',GF,400,[300,400,500,600,700]],
 ['Red Hat Display','"Red Hat Display"','Sans',GF,400,[300,400,500,600,700,800,900]],
 ['Comfortaa','"Comfortaa"','Sans',GF,400,[300,400,500,600,700]],
 ['Questrial','"Questrial"','Sans',GF,400],
 ['Albert Sans','"Albert Sans"','Sans',GF,400,[100,200,300,400,500,600,700,800,900]],
 ['Unbounded','"Unbounded"','Sans',GF,400,[200,300,400,500,600,700,800,900]],
 ['League Spartan','"League Spartan"','Sans',GF,400,[100,200,300,400,500,600,700,800,900]],
 ['Syne','"Syne"','Sans',GF,400,[400,500,600,700,800]],
 ['Varela Round','"Varela Round"','Sans',GF,400],
 ['Gruppo','"Gruppo"','Sans',GF,400],
 ['Tenor Sans','"Tenor Sans"','Sans',GF,400],
 ['Sacramento','"Sacramento"','Script',GF,400],
 ['Damion','"Damion"','Script',GF,400],
 ['Pinyon Script','"Pinyon Script"','Script',GF,400],
 ['Mr Dafoe','"Mr Dafoe"','Script',GF,400],
 ['Dancing Script','"Dancing Script"','Script',GF,400,[400,500,600,700]],
 ['Petit Formal Script','"Petit Formal Script"','Script',GF,400],
 ['Grand Hotel','"Grand Hotel"','Script',GF,400],
 ['Aguafina Script','"Aguafina Script"','Script',GF,400],
 ['Pacifico','"Pacifico"','Script',GF,400],
 ['Lovers Quarrel','"Lovers Quarrel"','Script',GF,400],
 ['Waterfall','"Waterfall"','Script',GF,400],
 ['Great Vibes','"Great Vibes"','Script',GF,400],
 ['Satisfy','"Satisfy"','Script',GF,400],
 ['Yellowtail','"Yellowtail"','Script',GF,400],
 ['Tangerine','"Tangerine"','Script',GF,400,[400,700]],
 ['Kaushan Script','"Kaushan Script"','Script',GF,400],
 ['Allura','"Allura"','Script',GF,400],
 ['Italianno','"Italianno"','Script',GF,400],
 ['Alex Brush','"Alex Brush"','Script',GF,400],
 ['Parisienne','"Parisienne"','Script',GF,400],
 ['Mrs Saint Delafield','"Mrs Saint Delafield"','Script',GF,400],
 ['Monsieur La Doulaise','"Monsieur La Doulaise"','Script',GF,400],
 ['Gochi Hand','"Gochi Hand"','Hand',GF,400],
 ['Coming Soon','"Coming Soon"','Hand',GF,400],
 ['Caveat','"Caveat"','Hand',GF,500,[400,500,600,700]],
 ['Mansalva','"Mansalva"','Hand',GF,400],
 ['Shadows Into Light','"Shadows Into Light"','Hand',GF,400],
 ['Zeyada','"Zeyada"','Hand',GF,400],
 ['Permanent Marker','"Permanent Marker"','Hand',GF,400],
 ['Indie Flower','"Indie Flower"','Hand',GF,400],
 ['Kalam','"Kalam"','Hand',GF,400,[300,400,700]],
 ['Amatic SC','"Amatic SC"','Hand',GF,400,[400,700]],
 ['Courgette','"Courgette"','Hand',GF,400],
 ['Patrick Hand','"Patrick Hand"','Hand',GF,400],
 ['Rock Salt','"Rock Salt"','Hand',GF,400],
 ['Gloria Hallelujah','"Gloria Hallelujah"','Hand',GF,400],
 ['Homemade Apple','"Homemade Apple"','Hand',GF,400],
 ['Reenie Beanie','"Reenie Beanie"','Hand',GF,400],
 ['Nothing You Could Do','"Nothing You Could Do"','Hand',GF,400],
 ['Covered By Your Grace','"Covered By Your Grace"','Hand',GF,400],
 ['Bebas Neue','"Bebas Neue"','Display',GF,400],
 ['Oswald','"Oswald"','Display',GF,400,[200,300,400,500,600,700]],
 ['Archivo Black','"Archivo Black"','Display',GF,400],
 ['League Gothic','"League Gothic"','Display',GF,400],
 ['Titan One','"Titan One"','Display',GF,400],
 ['Lobster Two','"Lobster Two"','Display',GF,400,[400,700]],
 ['Chewy','"Chewy"','Display',GF,400],
 ['Anton','"Anton"','Display',GF,400],
 ['Boogaloo','"Boogaloo"','Display',GF,400],
 ['Pixelify Sans','"Pixelify Sans"','Display',GF,400,[400,500,600,700]],
 ['Fredericka the Great','"Fredericka the Great"','Display',GF,400],
 ['Alfa Slab One','"Alfa Slab One"','Display',GF,400],
 ['Cabin Sketch','"Cabin Sketch"','Display',GF,400,[400,700]],
 ['Lilita One','"Lilita One"','Display',GF,400],
 ['Sansita Swashed','"Sansita Swashed"','Display',GF,400,[300,400,500,600,700,800,900]],
 ['Bungee','"Bungee"','Display',GF,400],
 ['Gravitas One','"Gravitas One"','Display',GF,400],
 ['Lobster','"Lobster"','Display',GF,400],
 ['Righteous','"Righteous"','Display',GF,400],
 ['Abril Fatface','"Abril Fatface"','Display',GF,400],
 ['Press Start 2P','"Press Start 2P"','Display',GF,400],
 ['Luckiest Guy','"Luckiest Guy"','Display',GF,400],
 ['Oleo Script','"Oleo Script"','Display',GF,400,[400,700]],
 ['Bangers','"Bangers"','Display',GF,400],
 ['Rubik Mono One','"Rubik Mono One"','Display',GF,400],
 ['Monoton','"Monoton"','Display',GF,400],
 ['IBM Plex Mono','"IBM Plex Mono"','Typewriter',GF,400,[100,200,300,400,500,600,700]],
 ['Major Mono Display','"Major Mono Display"','Typewriter',GF,400],
 ['Space Mono','"Space Mono"','Typewriter',GF,400,[400,700]],
 ['DM Mono','"DM Mono"','Typewriter',GF,400,[300,400,500]],
 ['Courier Prime','"Courier Prime"','Typewriter',GF,400,[400,700]],
 ['VT323','"VT323"','Typewriter',GF,400],
 ['Special Elite','"Special Elite"','Typewriter',GF,400],
 ['Cutive Mono','"Cutive Mono"','Typewriter',GF,400],
];
const BYFAM=new Map([...JA,...EN].map(f=>[f[1],f]));
const DEFAULT_JA=JA.find(f=>f[0]==='しっぽり明朝 B1')||JA[0];

// Google Fonts CSS is fetched per family when it is first needed; a Japanese family alone
// declares ~120 @font-face ranges, so loading the whole catalog up front would be heavy.
// Google can refuse or never answer (a bad signal, an outage); neither may hang the app, and a failed
// family is dropped from the cache so the next try asks again.
const cssDone=new Map(),FONT_WAIT=8000;
const inTime=(p,ms)=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),ms))]);
// Each weight is its own stylesheet (and its own font files), fetched the first time it is used.
const weightsOf=f=>f[5]||[f[4]];
function ensureCSS(fam,w){
  const f=BYFAM.get(fam);if(!f||f[3]!==GF)return Promise.resolve(true);
  w=weightsOf(f).includes(+w)?+w:f[4];const key=fam+'|'+w;
  if(cssDone.has(key))return cssDone.get(key);
  const l=document.createElement('link');l.rel='stylesheet';
  l.href=`https://fonts.googleapis.com/css2?family=${encodeURIComponent(fam.replace(/"/g,'')).replace(/%20/g,'+')}:wght@${w}&display=swap`;
  const p=inTime(new Promise((res,rej)=>{l.onload=res;l.onerror=rej}),FONT_WAIT).then(()=>true,()=>{l.remove();cssDone.delete(key);return false});
  document.head.appendChild(l);cssDone.set(key,p);return p;
}
async function loadFace(fam,w,text){await ensureCSS(fam,w);return inTime(document.fonts.load(`${w} 32px ${fam}`,text||'あ'),FONT_WAIT)}
// For saving: true only when the family really arrived, so a fallback face is never baked into the file.
async function faceReady(fam,w,text){
  if(!await ensureCSS(fam,w))return false;
  try{await loadFace(fam,w,text)}catch{return false}
  return document.fonts.check(`${w} 32px ${fam}`,text||'あ');
}

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

window.PICLEA={JA,EN,DEFAULT_JA,BYFAM,weightsOf,loadFace,faceReady,loadPhoto};
})();
