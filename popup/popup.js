"use strict";

const $ = (id) => document.getElementById(id);
let latestStatus = null;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function formatDateTime(iso) {
  if (!iso) return "未知时间";
  try {
    return new Date(iso).toLocaleString("zh-CN", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit"
    });
  } catch (_) {
    return iso;
  }
}

async function getTweets() {
  const { tweets = [] } = await chrome.storage.local.get({ tweets: [] });
  return tweets;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.url?.startsWith("https://x.com/") ? tab : null;
}

function sendToTab(tabId, message) {
  return chrome.tabs.sendMessage(tabId, message).catch(() => null);
}

async function render(profileHandle) {
  const tweets = await getTweets();
  const records = profileHandle
    ? tweets.filter((item) => item.profileHandle === profileHandle)
    : [];

  $("profileName").textContent = profileHandle
    ? `@${profileHandle}`
    : "请打开 X 账号首页，例如 x.com/wquguru";

  $("currentCount").textContent = String(records.length);

  const container = $("records");
  if (!records.length) {
    container.innerHTML = `<div class="record"><div class="record-title">暂无笔记</div><p class="record-text">打开账号主页并阅读，插件会把已显示的内容保存到本地笔记。</p></div>`;
    return;
  }

  container.innerHTML = records.slice(0, 5).map((item) => {
    const date = formatDateTime(item.publishedAt);
    const text = escapeHtml(item.content || item.card?.title || "无正文内容");
    return `
      <div class="record">
        <div class="record-title">@${escapeHtml(item.author.handle)} <span class="date">${escapeHtml(date)}</span></div>
        <p class="record-text">${text}</p>
        <a href="${escapeHtml(item.tweetUrl)}" target="_blank" rel="noopener">打开推文</a>
      </div>
    `;
  }).join("");

  container.querySelectorAll("a").forEach((a) => a.addEventListener("click", (event) => {
    event.preventDefault();
    chrome.tabs.create({ url: a.href });
  }));
}

function updateProgress(status, running) {
  const saved = Number(status?.sessionSaved || 0);
  const target = Number(status?.sessionTarget || 0);
  const currentCount = Number(status?.total ?? latestStatus?.count ?? 0);
  $("currentCount").textContent = String(currentCount);
  $("sessionCount").textContent = `${saved} / ${target}`;

  const percent = target > 0 ? Math.min(100, (saved / target) * 100) : 0;
  $("progressBar").style.width = `${running ? percent : 100}%`;
  $("progressText").textContent = running
    ? "正在辅助阅读，点击停止可随时结束"
    : saved >= target
      ? "已完成本次阅读"
      : "已停止";
}

async function loadStatus() {
  const tab = await getActiveTab();
  const status = tab ? await sendToTab(tab.id, { type: "X_NOTES_GET_STATUS" }) : null;
  latestStatus = status || null;
  const running = Boolean(status?.autoScrolling);

  $("runningBadge").classList.toggle("hidden", !running);
  $("targetCount").disabled = running;
  $("startScroll").disabled = running;
  $("stopScroll").disabled = !running;

  await render(status?.profileHandle || null);
  updateProgress(status, running);
  return { tab, status };
}

function csvCell(value) {
  const str = String(value ?? "");
  return `"${str.replace(/"/g, '""')}"`;
}

function tweetsToCsv(tweets) {
  const head = ["published_at", "author_handle", "author_name", "content", "links", "media_urls", "tweet_url", "status_id", "profile_handle", "saved_at"];
  const rows = tweets.map((item) => [
    item.publishedAt,
    item.author?.handle,
    item.author?.name,
    item.content,
    (item.links || []).join(" "),
    (item.media || []).map((media) => media.url).join(" "),
    item.tweetUrl,
    item.statusId,
    item.profileHandle,
    item.savedAt
  ].map(csvCell).join(","));
  return [head.join(","), ...rows].join("\n");
}

function tweetsToJsonl(tweets) {
  return tweets.map((item) => JSON.stringify(item)).join("\n");
}

function downloadFile(name, content, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({ url, filename: name, saveAs: true }, () => {
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  });
}

function timestampName(base, ext) {
  const time = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `${base}-${time}.${ext}`;
}

async function currentTweets() {
  const { status } = await loadStatus();
  const tweets = await getTweets();
  if (!status?.profileHandle) return [];
  return tweets.filter((item) => item.profileHandle === status.profileHandle);
}

function attachEvents() {
  $("startScroll").addEventListener("click", async () => {
    const { tab } = await loadStatus();
    if (!tab) return;
    const targetCount = Math.max(1, Math.min(20000, Number($("targetCount").value || 2000)));
    await sendToTab(tab.id, { type: "X_NOTES_START_SCROLL", targetCount, sendProgress: true });

    $("runningBadge").classList.remove("hidden");
    $("targetCount").disabled = true;
    $("startScroll").disabled = true;
    $("stopScroll").disabled = false;
    $("progressText").textContent = "正在辅助阅读，点击停止可随时结束";
  });

  $("stopScroll").addEventListener("click", async () => {
    const { tab } = await loadStatus();
    if (tab) await sendToTab(tab.id, { type: "X_NOTES_STOP_SCROLL" });
  });

  $("openManager").addEventListener("click", () => $("managerModal").classList.remove("hidden"));
  $("closeManager").addEventListener("click", () => $("managerModal").classList.add("hidden"));

  $("exportCurrent").addEventListener("click", async () => {
    const tweets = await currentTweets();
    if (tweets.length) {
      downloadFile(timestampName(`x-notes-${latestStatus.profileHandle}`, "jsonl"), tweetsToJsonl(tweets), "application/x-ndjson");
    }
  });

  $("downloadCurrentJsonl").addEventListener("click", async () => {
    const tweets = await currentTweets();
    if (tweets.length) {
      downloadFile(timestampName(`x-notes-${latestStatus.profileHandle}`, "csv"), tweetsToCsv(tweets), "text/csv;charset=utf-8");
    }
  });

  $("exportAll").addEventListener("click", async () => {
    const tweets = await getTweets();
    if (tweets.length) {
      downloadFile(timestampName("x-notes-all", "jsonl"), tweetsToJsonl(tweets), "application/x-ndjson");
    }
  });

  $("downloadJsonl").addEventListener("click", async () => {
    const tweets = await getTweets();
    if (tweets.length) {
      downloadFile(timestampName("x-notes-all", "csv"), tweetsToCsv(tweets), "text/csv;charset=utf-8");
    }
  });

  $("clearCurrent").addEventListener("click", async () => {
    const { status } = await loadStatus();
    if (!status?.profileHandle) return;
    const tweets = await getTweets();
    const next = tweets.filter((item) => item.profileHandle !== status.profileHandle);
    await chrome.storage.local.set({ tweets: next });
    render(status.profileHandle);
  });

  $("clearAll").addEventListener("click", async () => {
    await chrome.storage.local.set({ tweets: [] });
    render(null);
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== "X_NOTES_PROGRESS") return;
    latestStatus = {
      ...latestStatus,
      autoScrolling: message.running,
      sessionSaved: message.saved,
      sessionTarget: message.target,
      total: message.total
    };
    updateProgress(message, message.running);

    if (!message.running) {
      $("runningBadge").classList.add("hidden");
      $("targetCount").disabled = false;
      $("startScroll").disabled = false;
      $("stopScroll").disabled = true;
      loadStatus();
    }
  });
}

attachEvents();
loadStatus();
