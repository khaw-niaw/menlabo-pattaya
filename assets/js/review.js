(() => {
  const REVIEW_ENDPOINT = "";
  // 空のときは段階1（下書きなし）。URLが入ったときだけ下書きボタンが出る。
  const DRAFT_ENDPOINT = (document.getElementById("review-result").dataset.draftEndpoint || "").trim();
  const form = document.getElementById("review-form");
  const result = document.getElementById("review-result");
  const summary = result.querySelector(".review-summary");
  let counted = false;
  let lastPayload = null;
  const draftBlock = document.getElementById("review-draft-block");
  const draftMake = document.getElementById("review-draft-make");
  const draftArea = document.getElementById("review-draft-area");
  const draftText = document.getElementById("review-draft");
  const draftError = document.getElementById("review-draft-error");
  const draftStatus = document.getElementById("review-draft-status");

  if (DRAFT_ENDPOINT) {
    for (const id of ["review-privacy", "review-note-help"]) {
      const el = document.getElementById(id);
      if (el && el.dataset.aiText) el.textContent = el.dataset.aiText;
    }
  }

  async function makeDraft() {
    if (!lastPayload) return;
    const label = draftMake.textContent;
    draftMake.disabled = true;
    draftMake.textContent = draftBlock.dataset.making;
    draftError.hidden = true;
    draftStatus.textContent = "";
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25000);
      // 自由記入は、このボタンを押したときだけ、下書き作成のために送る。保存しない。
      const response = await fetch(DRAFT_ENDPOINT, {
        method: "POST",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        signal: controller.signal,
        body: JSON.stringify(lastPayload),
      });
      clearTimeout(timer);
      const data = await response.json();
      if (!data || !data.ok || typeof data.draft !== "string" || !data.draft.trim()) throw new Error("draft");
      draftText.value = data.draft.trim();
      draftArea.hidden = false;
      draftText.focus();
    } catch (error) {
      draftError.hidden = false;
    } finally {
      draftMake.disabled = false;
      draftMake.textContent = label;
    }
  }

  draftMake.addEventListener("click", makeDraft);
  document.getElementById("review-draft-copy").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(draftText.value);
    } catch (error) {
      draftText.select();
      document.execCommand("copy");
    }
    draftStatus.textContent = draftBlock.dataset.copied;
  });

  function countOnce(payload) {
    // 「回答を直す」で同じ人の回答を二重に数えない。
    if (counted) return;
    counted = true;
    if (!REVIEW_ENDPOINT) {
      console.info("review_survey", payload);
      return;
    }
    fetch(REVIEW_ENDPOINT, {
      method: "POST",
      mode: "no-cors",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      keepalive: true,
      body: JSON.stringify(payload),
    }).catch(() => {});
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (form.hidden) return;
    const payload = { v: 1, lang: document.documentElement.lang };
    for (const question of ["q1", "q2", "q3", "q4"]) {
      const choices = Array.from(form.querySelectorAll(`input[name="${question}"]:checked`));
      payload[question] = choices.map((choice) => choice.value);
      const labels = choices.map((choice) => choice.labels[0].textContent.trim());
      summary.querySelector(`[data-answer="${question}"]`).textContent = labels.join("\n") || summary.dataset.empty;
    }
    const note = document.getElementById("review-note").value;
    summary.querySelector('[data-answer="q5"]').textContent = note || summary.dataset.empty;
    // 下書きの材料は、選んだ項目か自由記入のどちらかがあるときだけ。何もなければ下書きは出さない。
    const hasInput = note.trim() !== "" || ["q1", "q2", "q3", "q4"].some((question) => payload[question].length);
    lastPayload = Object.assign({}, payload, { note: note.trim().slice(0, 300) });
    draftArea.hidden = true;
    draftError.hidden = true;
    draftBlock.hidden = !(DRAFT_ENDPOINT && hasInput);
    form.hidden = true;
    result.hidden = false;
    document.getElementById("review-result-title").focus();
    countOnce(payload);
  });

  form.querySelector('[type="submit"]').disabled = false;
  document.getElementById("review-back").addEventListener("click", () => {
    result.hidden = true;
    form.hidden = false;
    document.getElementById("review-title").focus();
  });
  document.getElementById("review-google").addEventListener("click", () => {
    sendAnalyticsEvent("review_click", { area: "review_survey" });
  });
})();
