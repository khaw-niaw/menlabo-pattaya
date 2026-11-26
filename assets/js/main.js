"use strict";

document.documentElement.classList.add("js");

// data/shop.json から build.py が生成する。LINE_URL は公式URL確認後にデータ側で設定する。
const PHONE_URL = "tel:+66961479518";
const PHONE_DISPLAY = "+66 96-147-9518";
const MAP_URL = "https://maps.app.goo.gl/t9EeHTfAjPL7jj5u8";
const LINE_URL = "https://lin.ee/7GQmsKU";
const INSTAGRAM_URL = "https://www.instagram.com/menlabo.pattaya/";
const FACEBOOK_URL = "https://www.facebook.com/menlabo.pattaya";
const X_URL = "https://x.com/menlabo_sakaba";
const FALLBACK_IMAGE_URL = "/assets/images/fallback.svg";

const EXTERNAL_URLS = {
  phone: PHONE_URL,
  map: MAP_URL,
  line: LINE_URL,
  instagram: INSTAGRAM_URL,
  facebook: FACEBOOK_URL,
  x: X_URL,
};

const EXTERNAL_VALUES = {
  phone: PHONE_DISPLAY,
};

document.querySelectorAll("[data-action]").forEach((element) => {
  const url = EXTERNAL_URLS[element.dataset.action];

  if (element instanceof HTMLAnchorElement && url) {
    element.href = url;
  }

  if (element.dataset.action === "line" && !LINE_URL) {
    element.setAttribute("aria-disabled", "true");
  }
});

document.querySelectorAll("[data-value]").forEach((element) => {
  const value = EXTERNAL_VALUES[element.dataset.value];
  if (value) element.textContent = value;
});

const menuButton = document.querySelector(".menu-button");
const menuLabel = menuButton?.querySelector(".menu-button__label");
const menuOpenLabel = menuButton?.dataset.openLabel || "";
const menuCloseLabel = menuButton?.dataset.closeLabel || "";
const mobileMenu = document.querySelector(".mobile-menu");
const pageMain = document.querySelector("main");
const pageFooter = document.querySelector(".site-footer");
const mobileActions = document.querySelector(".mobile-actions");
const desktopMedia = window.matchMedia("(min-width: 992px)");
let closeTimer;

function setMenu(open, returnFocus = false, focusFirstLink = false) {
  if (!menuButton || !menuLabel || !mobileMenu) return;

  window.clearTimeout(closeTimer);
  document.body.classList.toggle("menu-open", open);
  menuButton.setAttribute("aria-expanded", String(open));
  menuLabel.textContent = open ? menuCloseLabel : menuOpenLabel;
  menuLabel.dataset.key = open ? "menu-close" : "menu-open";
  pageMain.inert = open;
  pageFooter.inert = open;
  if (mobileActions) mobileActions.inert = open;

  if (open) {
    mobileMenu.hidden = false;
    mobileMenu.inert = false;
    window.requestAnimationFrame(() => {
      mobileMenu.classList.add("is-open");
      // 2026-11-16 ちえと指摘：スマホで指で開くと、最初のリンク「MENLABOについて」に赤い枠（キーボード操作用の印）が出ていた。
      // キーボードで開いたときだけ最初のリンクへ移る。指やマウスで開いたときは移らない
      if (focusFirstLink) mobileMenu.querySelector("a")?.focus();
    });
    return;
  }

  mobileMenu.classList.remove("is-open");
  mobileMenu.inert = true;
  closeTimer = window.setTimeout(() => {
    mobileMenu.hidden = true;
  }, 220);

  if (returnFocus) menuButton.focus();
}

menuButton?.addEventListener("click", (event) => {
  // event.detail が 0 ＝ Enter・スペースキーで押された（指やマウスなら 1 以上）
  setMenu(!document.body.classList.contains("menu-open"), false, event.detail === 0);
});

mobileMenu?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => setMenu(false));
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.body.classList.contains("menu-open")) {
    setMenu(false, true);
  }
});

desktopMedia.addEventListener("change", (event) => {
  if (event.matches) setMenu(false);
});

if (mobileMenu) {
  mobileMenu.inert = true;
}

document.querySelectorAll("img").forEach((image) => {
  image.addEventListener("error", () => {
    if (image.dataset.fallbackApplied === "true") return;
    image.dataset.fallbackApplied = "true";
    image.src = FALLBACK_IMAGE_URL;
  });
});

const revealElements = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries, revealObserver) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      revealObserver.unobserve(entry.target);
    });
  }, {
    threshold: 0.08,
    rootMargin: "0px 0px -8% 0px",
  });

  revealElements.forEach((element) => observer.observe(element));
} else {
  revealElements.forEach((element) => element.classList.add("is-visible"));
}

function sendAnalyticsEvent(eventName, parameters) {
  if (typeof window.gtag !== "function") return;
  window.gtag("event", eventName, parameters);
}

function analyticsArea(element) {
  if (element.closest(".site-header, .mobile-menu")) return "header";
  if (element.closest(".hero, .menu-hero, .access-hero, .about-hero")) return "hero";
  if (element.closest(".mobile-actions")) return "cta";
  if (element.closest(".site-footer")) return "footer";
  return "inline";
}

// 2026-11-17 メニュー系ページ（夜・ランチ・おすすめ・お酒・ラーメン）へのリンク先を判定する
function menuLinkPage(pathname) {
  const match = pathname.match(/^\/(?:en\/|th\/|zh\/)?(menu|lunch|recommended|drinks|ramen)(?:\.html)?\/?$/);
  return match ? match[1] : "";
}

function menuPageFromPath(pathname) {
  const match = pathname.match(/\/(menu|lunch|recommended|drinks)(?:\.html)?\/?$/);
  return match ? match[1] : "";
}

// トップの料理説明パネル。スマホの「戻る」でも閉じられるよう、開くときに履歴を1つ積む
let openDish = null;

function openDishDialog(dialog, opener) {
  if (openDish) return;
  openDish = { dialog, opener };
  document.documentElement.classList.add("is-dish-open");
  dialog.showModal();
  history.pushState({ dishDialog: dialog.id }, "");
}

function finishDishDialog() {
  if (!openDish) return;
  const { dialog, opener } = openDish;
  openDish = null;
  if (dialog.open) dialog.close();
  document.documentElement.classList.remove("is-dish-open");
  opener.focus({ preventScroll: true });
}

function closeDishDialog() {
  if (!openDish) return;
  if (history.state && history.state.dishDialog) {
    history.back();
  } else {
    finishDishDialog();
  }
}

window.addEventListener("popstate", () => {
  if (openDish) finishDishDialog();
});

document.querySelectorAll(".dish-dialog").forEach((dialog) => {
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeDishDialog();
  });
});

document.querySelectorAll("a[data-lang]").forEach((link) => {
  link.addEventListener("click", () => {
    try {
      localStorage.setItem("langPref", link.dataset.lang || "ja");
    } catch (_error) {
      // localStorageを使えない環境でも通常のリンク遷移は続ける。
    }
  });
});

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!target || typeof target.closest !== "function") return;

  // 2026-11-17 ちえと承認：トップの料理写真を押すと、その場で料理の説明パネルを開く（ページは移らない）
  const topPick = target.closest(".food-grid .dish[data-menu-id]");
  if (topPick) {
    sendAnalyticsEvent("top_pick_click", { item: topPick.dataset.menuId });
    const opener = topPick.querySelector("[data-dish-open]");
    const dialog = opener && document.getElementById(opener.dataset.dishOpen);
    if (dialog && typeof dialog.showModal === "function") openDishDialog(dialog, opener);
    return;
  }

  const dishDialog = target.closest(".dish-dialog");
  if (dishDialog) {
    if (target === dishDialog || target.closest("[data-dish-close]")) {
      closeDishDialog();
      return;
    }
    const more = target.closest("a[data-dish-more]");
    if (more) {
      // 説明パネルから夜のメニューへ進んだ数。izakaya_menu_click とは二重にしない
      sendAnalyticsEvent("top_pick_menu_click", { item: dishDialog.dataset.menuId });
      return;
    }
  }

  const recommendedItem = target.closest(".recommended-card[data-menu-id], .recommended-list [data-menu-id]");
  if (recommendedItem) {
    const category = recommendedItem.closest(".recommended-category")?.id.replace(/^recommended-/, "") || "";
    sendAnalyticsEvent("recommended_item_click", {
      language: document.documentElement.lang.split("-")[0],
      category,
      item: recommendedItem.dataset.menuId,
    });
    return;
  }

  const anchor = target.closest("a");
  if (!anchor) return;

  const href = anchor.getAttribute("href") || "";
  let link;
  try {
    link = new URL(href, window.location.href);
  } catch (_error) {
    return;
  }

  const area = analyticsArea(anchor);
  const isInternal = link.origin === window.location.origin;
  if (href.includes("maps.app.goo.gl")) {
    sendAnalyticsEvent("map_click", { area, link_url: href });
  } else if (href.includes("google.com/maps")) {
    sendAnalyticsEvent("review_click", { area });
  } else if (link.hostname === "lin.ee") {
    sendAnalyticsEvent("line_click", { area });
  } else if (isInternal && menuLinkPage(link.pathname) && !href.startsWith("#")) {
    // 2026-11-17 GA4計測漏れ一覧（ちえと指示）：トップ本文のおすすめ・メニューは旧サイトと同じ固定名。
    // それ以外のメニュー系ページへのリンクは menu_click に menu_page を付けて数える（固定名と二重には送らない）
    const menuPage = menuLinkPage(link.pathname);
    const onTop = /^\/(?:en\/|th\/|zh\/)?(?:index\.html)?$/.test(window.location.pathname);
    const onRecommended = menuPageFromPath(window.location.pathname) === "recommended";
    if (onTop && area === "inline" && menuPage === "recommended") {
      sendAnalyticsEvent("top_pick_more_click", { area });
    } else if (onTop && area === "inline" && menuPage === "menu") {
      sendAnalyticsEvent("izakaya_menu_click", { area });
    } else if (onRecommended && area === "inline" && menuPage === "menu") {
      sendAnalyticsEvent("recommended_menu_click", { area });
    } else {
      sendAnalyticsEvent("menu_click", { area, menu_page: menuPage });
    }
  } else if (isInternal && /^\/(?:en\/|th\/|zh\/)?access(?:\.html)?\/?$/.test(link.pathname) && !href.startsWith("#")) {
    sendAnalyticsEvent("access_click", { area });
  } else if (href.startsWith("tel:")) {
    sendAnalyticsEvent("tel_click", { area });
  } else if (href.startsWith("mailto:")) {
    sendAnalyticsEvent("email_click", { area });
  } else if (/(^|\.)(facebook\.com|instagram\.com|x\.com)$/.test(link.hostname)) {
    const service = link.hostname.includes("facebook") ? "facebook" : link.hostname.includes("instagram") ? "instagram" : "x";
    sendAnalyticsEvent("social_click", { area, service });
  } else if (anchor.dataset.delivery) {
    // 2026-11-16 デリバリー（Grab・LINE MAN）へのリンク。どちらが押されたかを service で分ける
    sendAnalyticsEvent("delivery_click", { area, service: anchor.dataset.delivery });
  }
}, { passive: true });

const analyticsMenuPage = menuPageFromPath(window.location.pathname);
const analyticsLanguage = document.documentElement.lang.split("-")[0];
if (analyticsMenuPage) {
  sendAnalyticsEvent("menu_view", {
    language: analyticsLanguage,
    menu_page: analyticsMenuPage,
  });
}
if (analyticsMenuPage === "recommended") {
  sendAnalyticsEvent("recommended_view", { language: analyticsLanguage });
}
