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
  lunch:  'https://images.unsplash.com/photo-1591814468924-caf88d1232e1?w=1200&q=75&auto=format&fit=crop',
  turn:   'https://images.unsplash.com/photo-1554797589-7241bb691973?w=1600&q=75&auto=format&fit=crop',
  sakana: 'https://images.unsplash.com/photo-1562967914-608f82629710?w=1200&q=75&auto=format&fit=crop',
  sake:   'https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=1200&q=75&auto=format&fit=crop',
  men:    'https://images.unsplash.com/photo-1535007813616-79dc02ba4021?w=1200&q=75&auto=format&fit=crop',
  // 品書きページ「おすすめ六品」の写真
  'sig-karaage': 'https://images.unsplash.com/photo-1562967914-608f82629710?w=700&q=75&auto=format&fit=crop',
  'sig-gyoza':   'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=700&q=75&auto=format&fit=crop',
  'sig-ramen':   'https://images.unsplash.com/photo-1535007813616-79dc02ba4021?w=700&q=75&auto=format&fit=crop',
  'sig-chashu':  'https://images.unsplash.com/photo-1432139555190-58524dae6a55?w=700&q=75&auto=format&fit=crop',
  'sig-buta':    'https://images.unsplash.com/photo-1604908177453-7462950a6a3b?w=700&q=75&auto=format&fit=crop',
  'sig-kimchi':  'https://images.unsplash.com/photo-1626804475297-41608ea09aeb?w=700&q=75&auto=format&fit=crop',
};
const PLATE_FALLBACK = 'assets/images/fallback.svg';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* --- 扉の段階表示：data-delay を CSS 変数に渡してから表示開始 --- */
document.querySelectorAll('.reveal').forEach((el) => {
  const delay = parseInt(el.dataset.delay || '0', 10);
  el.style.setProperty('--d', `${delay}ms`);
});
requestAnimationFrame(() => {
  document.body.classList.add('is-ready');
});

/* --- 営業中ステータス：タイ時間で判定（11:00〜24:00・火曜定休） --- */
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
  if (wd === 'Tue')        return { open: false, text: '本日休み — 明日十一時から' };
  if (hour >= 11 && hour < 24) return { open: true,  text: 'ただいま営業中 — 二十四時まで' };
  if (hour < 11)           return { open: false, text: '準備中 — 十一時から' };
  return { open: false, text: '本日は終了 — 明日十一時から' };
}

const statusEl = document.getElementById('now-status');
if (statusEl) {
  const s = storeStatus();
  statusEl.textContent = s.text;
  statusEl.classList.toggle('is-open', s.open);
}

/* --- 下部CTAバー：表紙を抜けたらせり上がる（要素はモバイルのみ表示） --- */
const mCta = document.getElementById('m-cta');
if (mCta) {
  const coverEl = document.querySelector('.cover');
  const toggleCta = () => {
    const past = coverEl ? window.scrollY > coverEl.offsetHeight - 140 : true;
    mCta.classList.toggle('is-shown', past);
  };
  toggleCta();
  window.addEventListener('scroll', toggleCta, { passive: true });
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
    img.src = PLATE_FALLBACK;
  };
  img.src = PLATE_IMAGES[key] || PLATE_FALLBACK;
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
