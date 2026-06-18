/* ==========================================================================
   main.js — 章の開き（スクロール連動）と、回転する単語
   アニメーションの間隔・長さは data 属性で外部から指定する。
   ========================================================================== */

// --- 設定値 ---
const CHAPTER_THRESHOLD = 0.18;   // 章が「開く」とみなす可視率
const ROTATOR_INTERVAL  = 2400;   // 単語回転の既定間隔(ms)
const ROTATOR_DURATION  = 520;    // 回転1回の既定の長さ(ms)

// --- 写真（サンプル画像）。本番写真に差し替える時はここのURLを変えるだけ ---
// トーンの方針：昼は明るく、十五時以降は黒背景の艶（夜の居酒屋写真）
const PLATE_IMAGES = {
  lunch:  'assets/images/lunch.jpg',    // 昼：定食・ラーメン
  turn:   'assets/images/noren.jpg',    // 十五時：全幅・夕景／暖簾
  sakana: 'assets/images/sakana.jpg',   // 一杯目：肴
  sake:   'assets/images/sake.jpg',     // 二杯目：酒
  men:    'assets/images/ramen.jpg',    // 〆に：麺
  // 品書きページ「おすすめ六品」の写真（assets/images/ に同名で置けば差し替わる）
  'sig-karaage': 'assets/images/karaage.jpg',                    // 鶏の唐揚げ
  'sig-gyoza':   'assets/images/yaki-gyoza.jpg',                 // 焼き餃子
  'sig-ramen':   'assets/images/tanrei-tori-shoyu-soba-regular.jpg', // 淡麗鶏醤油そば
  'sig-chashu':  'assets/images/rare-bara-chashu-moriawase.jpg', // レアバラチャーシュー盛り合わせ
  'sig-buta':    'assets/images/buta-yakiniku.jpg',             // 大衆豚焼肉皿
  'sig-kimchi':  'assets/images/buta-kimchi.jpg',              // 豚キムチ
  // 店舗情報ページの写真（assets/images/ に同名で置けば差し替わる。3:2・1200×800px 目安）
  'access-exterior': 'assets/images/access-exterior.jpg', // 夜の外観・提灯の灯り
  'access-entrance': 'assets/images/access-entrance.jpg', // 入口
  'access-interior': 'assets/images/access-interior.jpg', // 店内・カウンター
  'access-vibe':     'assets/images/access-vibe.jpg',     // 夜の賑わい
};
const PLATE_FALLBACK = 'assets/images/fallback.svg';

/* --- 画像パスをページ階層に合わせて解決する ---
   PLATE_IMAGES は "assets/..." 相対で定義しているが、/en/menu のような下層ページでは
   そのままだと /en/assets/... を探して404になる。各HTMLで正しく指定済みの stylesheet link
   （JP=assets/css/…, EN下層=../assets/css/…）から実際の assets ベースを導出して付け替える。
   これで file:// でも Vercel でも、どの階層でも正しく解決する。http(s) 絶対URLは素通し。 */
const STYLE_LINK = document.querySelector('link[rel="stylesheet"][href*="assets/css/style.css"]');
const ASSET_BASE = STYLE_LINK
  ? STYLE_LINK.getAttribute('href').replace(/assets\/css\/style\.css.*$/, '')
  : '';
const resolveAsset = (p) => (/^https?:\/\//.test(p) ? p : ASSET_BASE + p);

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* --- 扉の段階表示：data-delay を CSS 変数に渡してから表示開始 --- */
document.querySelectorAll('.reveal').forEach((el) => {
  const delay = parseInt(el.dataset.delay || '0', 10);
  el.style.setProperty('--d', `${delay}ms`);
});
requestAnimationFrame(() => {
  document.body.classList.add('is-ready');
});

/* --- 営業中ステータス：タイ時間で判定（11:00〜24:00・火曜定休） ---
   文言は全言語共通JSの方針のため <html lang> で出し分ける（i18nマップ）。
   判定ロジックそのものは言語に依らず不変。 */
const STATUS_STRINGS = {
  ja: {
    closedTue: '本日休み — 明日十一時から',
    open:      'ただいま営業中 — 二十四時まで',
    pre:       '準備中 — 十一時から',
    done:      '本日は終了 — 明日十一時から',
  },
  en: {
    closedTue: 'Closed today — back tomorrow at 11',
    open:      'Open now — until midnight',
    pre:       'Opening at 11',
    done:      'Closed for today — back tomorrow at 11',
  },
  th: {
    closedTue: 'วันนี้ปิด — พบกันใหม่พรุ่งนี้ 11 โมง',
    open:      'เปิดอยู่ — ถึงเที่ยงคืน',
    pre:       'เปิด 11 โมง',
    done:      'ปิดแล้ววันนี้ — พบกันใหม่พรุ่งนี้ 11 โมง',
  },
};
const STATUS_L = STATUS_STRINGS[document.documentElement.lang] || STATUS_STRINGS.ja;

function storeStatus() {
  let wd, hour;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Bangkok', weekday: 'short', hour: '2-digit', hour12: false,
    }).formatToParts(new Date());
    wd = parts.find((p) => p.type === 'weekday').value;
    hour = parseInt(parts.find((p) => p.type === 'hour').value, 10) % 24;
  } catch (e) {
    // タイムゾーン非対応環境では端末時刻で代用
    const d = new Date();
    wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
    hour = d.getHours();
  }
  if (wd === 'Tue')        return { open: false, text: STATUS_L.closedTue };
  if (hour >= 11 && hour < 24) return { open: true,  text: STATUS_L.open };
  if (hour < 11)           return { open: false, text: STATUS_L.pre };
  return { open: false, text: STATUS_L.done };
}

const statusEl = document.getElementById('now-status');
if (statusEl) {
  const s = storeStatus();
  statusEl.textContent = s.text;
  statusEl.classList.toggle('is-open', s.open);
}

/* --- 下部CTAバー：モバイルで常時表示 --- */
const mCta = document.getElementById('m-cta');
if (mCta) {
  mCta.classList.add('is-shown');
}

/* --- グローバルナビ：表紙を抜けたら紙色の地を出す --- */
const siteHead = document.querySelector('.site-head');
if (siteHead && !siteHead.classList.contains('is-solid')) {
  const cover = document.querySelector('.cover');
  if (cover) {
    const onScroll = () => {
      siteHead.classList.toggle('is-solid', window.scrollY > cover.offsetHeight - 90);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  } else {
    siteHead.classList.add('is-solid');
  }
}

/* --- 図版の読み込み：失敗したらローカルのフォールバックに差し替える --- */
document.querySelectorAll('[data-plate-src]').forEach((img) => {
  const key = img.dataset.plateSrc;
  img.loading = 'lazy';
  img.onerror = () => {
    img.onerror = null;
    img.src = resolveAsset(PLATE_FALLBACK);
  };
  img.src = resolveAsset(PLATE_IMAGES[key] || PLATE_FALLBACK);
});

/* --- 章の開き：IntersectionObserver --- */
const chapters = document.querySelectorAll('.chapter');
if ('IntersectionObserver' in window && !reduceMotion) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const delay = parseInt(entry.target.dataset.delay || '0', 10);
        entry.target.style.setProperty('--d', `${delay}ms`);
        entry.target.classList.add('is-open');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: CHAPTER_THRESHOLD });
  chapters.forEach((ch) => observer.observe(ch));
} else {
  // フォールバック：監視できない環境では最初から開いておく
  chapters.forEach((ch) => ch.classList.add('is-open'));
}

/* --- 回転する単語 --- */
const rotatorRemeasurers = [];

function setupRotator(el) {
  const words = (el.dataset.words || '').split(',').map((w) => w.trim()).filter(Boolean);
  if (words.length < 2 || reduceMotion) return;

  const interval = parseInt(el.dataset.interval || `${ROTATOR_INTERVAL}`, 10);
  const duration = parseInt(el.dataset.duration || `${ROTATOR_DURATION}`, 10);

  const initial = el.textContent.trim() || words[0];
  const word = document.createElement('span');
  word.className = 'rotator__word';
  el.textContent = '';
  el.appendChild(word);
  el.style.setProperty('--rot-dur', `${duration}ms`);

  let index = Math.max(0, words.indexOf(initial));
  let widths = [];

  // 各語の幅を実測して、回転時に幅ごと滑らかに切り替える。
  // フォントサイズはレスポンシブ（clamp）で変わるため、初回だけでなく
  // リサイズ・ロード完了時にも測り直さないと、古い狭い幅のまま「。」と重なる。
  const remeasure = () => {
    const current = word.textContent;
    const fixed = word.style.width;
    word.style.width = 'auto';
    widths = words.map((w) => {
      word.textContent = w;
      // getBoundingClientRect は小数まで返す。切り上げ＋1で折り返し・重なりを防ぐ
      return Math.ceil(word.getBoundingClientRect().width) + 1;
    });
    word.textContent = current || words[index];
    // 回転アニメ中（is-out）は幅を戻すと崩れるので、その時は据え置く
    word.style.width = word.classList.contains('is-out') ? fixed : `${widths[index]}px`;
  };

  word.textContent = words[index];
  remeasure();
  rotatorRemeasurers.push(remeasure);

  setInterval(() => {
    // 非表示タブではタイマーが間引かれ、消えたまま固まるので回転しない
    if (document.hidden) return;
    word.classList.add('is-out');
    setTimeout(() => {
      index = (index + 1) % words.length;
      word.textContent = words[index];
      word.style.width = `${widths[index]}px`;
      word.classList.remove('is-out');
      word.classList.add('is-pre');
      // 強制リフローで is-pre の姿勢を確定させてから回転で戻す
      void word.offsetWidth;
      word.classList.remove('is-pre');
    }, duration);
  }, interval);
}

/* フォント読み込み後に幅を実測する（読み込み前だと代替フォントの幅になる） */
const initRotators = () => document.querySelectorAll('.rotator').forEach(setupRotator);
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(initRotators);
} else {
  initRotators();
}

/* フォントサイズが変わっても幅がズレないよう測り直す */
window.addEventListener('load', () => rotatorRemeasurers.forEach((m) => m()));
let rotatorResizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(rotatorResizeTimer);
  rotatorResizeTimer = setTimeout(() => rotatorRemeasurers.forEach((m) => m()), 180);
});

/* --- 言語スイッチの手動選択を記憶（トップ / の自動振り分けが尊重する） ---
   ユーザーが JP/EN/TH を選んだら localStorage に保存。次回 / に来たときその言語へ誘導。 */
document.querySelectorAll('.lang-switch a').forEach((a) => {
  a.addEventListener('click', () => {
    const href = a.getAttribute('href') || '';
    const lang = href.indexOf('/th') === 0 ? 'th' : href.indexOf('/en') === 0 ? 'en' : 'ja';
    try { localStorage.setItem('langPref', lang); } catch (e) {}
  });
});

/* --- Google Analytics：主要ボタンのクリックを計測 ---
   リンク先と設置場所を自動判定してイベント送信。HTMLは触らず一括で対応する。 */
document.addEventListener('click', (e) => {
  const a = e.target.closest('a');
  if (!a || typeof window.gtag !== 'function') return;

  const href = a.getAttribute('href') || '';
  // 設置場所のラベル（イベントの内訳が見られる）
  const area =
    a.closest('.site-head') ? 'header' :
    a.closest('.m-cta')     ? 'cta' :
    a.closest('.colophon')  ? 'footer' :
    a.closest('#access')    ? 'access' :
    a.classList.contains('more-link') ? 'inline' : 'other';

  if (href.includes('maps.app.goo.gl')) {
    // 地図・道順クリック（来店意図＝最重要）
    window.gtag('event', 'map_click', { area, link_url: href });
  } else if (href.includes('google.com/maps')) {
    // 口コミ（Googleマップのレビュー）クリック
    window.gtag('event', 'review_click', { area });
  } else if (href === '/menu' || href.startsWith('/menu')) {
    // 品書きクリック（興味）
    window.gtag('event', 'menu_click', { area });
  }
}, { passive: true });
