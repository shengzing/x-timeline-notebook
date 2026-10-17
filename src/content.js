"use strict";

(() => {
  const MESSAGE = {
    RECORD: "X_NOTES_RECORD",
    STATUS: "X_NOTES_GET_STATUS",
    START_SCROLL: "X_NOTES_START_SCROLL",
    STOP_SCROLL: "X_NOTES_STOP_SCROLL"
  };

  const NAV_PATHS = new Set([
    "home", "explore", "notifications", "messages", "i", "settings",
    "search", "compose", "intent", "hashtag", "personalization"
  ]);

  let savedInSession = new Set();
  let autoScrolling = false;
  let autoScrollToken = 0;
  let observer = null;
  const runtimeStatus = {
    sessionSaved: 0,
    sessionTarget: 0,
    total: 0
  };

  function isProfilePage() {
    const segments = location.pathname.split("/").filter(Boolean);
    if (segments.length === 0) return null;
    const handle = segments[0];
    if (NAV_PATHS.has(handle.toLowerCase())) return null;
    if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) return null;
    const sub = segments[1] || "";
    if (sub && !["with_replies", "media", "likes", "superfollows", "analytics"].includes(sub)) return null;
    return handle.toLowerCase();
  }

  function normalizeText(value) {
    return String(value || "").replace(/\r?\n\s*\n\s*\n+/g, "\n\n").replace(/[ \t]+/g, " ").trim();
  }

  function statusIdFromHref(href) {
    const match = String(href || "").match(/\/status\/(\d+)/);
    return match ? match[1] : null;
  }

  function statusUrlFromArticle(article) {
    const time = article.querySelector("time");
    const timeLink = time?.closest("a[href*='/status/']");
    if (timeLink?.href && statusIdFromHref(timeLink.href)) return timeLink.href;

    for (const link of article.querySelectorAll("a[href*='/status/']")) {
      const id = statusIdFromHref(link.href);
      if (id && !link.href.includes("/analytics") && !link.href.includes("/photo") && !link.href.includes("/video")) {
        return new URL(link.href, location.origin).href;
      }
    }
    return null;
  }

  function authorLinksFromArticle(article) {
    return Array.from(article.querySelectorAll("a[href^='/']"))
      .map((a) => {
        const m = a.getAttribute("href")?.match(/^\/([A-Za-z0-9_]{1,15})\/?$/);
        return m ? m[1].toLowerCase() : null;
      })
      .filter(Boolean);
  }

  function serializeNode(node) {
    if (!node) return "";
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    const tag = node.tagName.toLowerCase();
    if (tag === "br") return "\n";
    if (tag === "img") {
      const src = node.getAttribute("src") || "";
      const alt = node.getAttribute("alt") || "";
      if (src.includes("/emoji/")) return alt || "";
      return `[图片${alt ? `：${alt}` : ""}]`;
    }
    if (tag === "video") return "[视频]";
    if (tag === "script" || tag === "style" || tag === "svg" || tag === "path") return "";

    if (tag === "a") {
      const href = node.href || node.getAttribute("href") || "";
      const text = normalizeText(Array.from(node.childNodes).map(serializeNode).join(""));
      const absolute = href && !href.startsWith("#") ? new URL(href, location.origin).href : "";
      if (absolute && absolute !== text && !text.includes(absolute)) {
        if (absolute.includes("/status/")) return `${text || absolute} (${absolute})`;
        if (absolute.includes("hashtag/") || absolute.includes("search?q=")) return text || absolute;
        return `${text || absolute} (${absolute})`;
      }
      return text || absolute;
    }

    const children = Array.from(node.childNodes).map(serializeNode).join("");
    if (["p", "div", "li", "blockquote"].includes(tag)) return children + (children ? "\n" : "");
    return children;
  }

  function readLinks(root) {
    const links = new Set();
    for (const a of root.querySelectorAll("a[href]")) {
      try {
        const url = new URL(a.href, location.origin).href;
        if (url.startsWith("https://x.com/") || url.startsWith("https://twitter.com/")) continue;
        if (url.startsWith("https://t.co/")) links.add(url);
        else if (/^https?:\/\//.test(url)) links.add(url);
      } catch (_) {}
    }
    return [...links];
  }

  function readMedia(article) {
    const media = [];
    const seen = new Set();
    for (const img of article.querySelectorAll("img[src]")) {
      const src = img.src || "";
      if (!src || src.includes("/emoji/") || seen.has(src)) continue;
      if (src.includes("pbs.twimg.com/media/") || src.includes("pbs.twimg.com/card_img/")) {
        seen.add(src);
        media.push({ type: "image", url: src, alt: img.alt || "" });
      } else if (/^https?:\/\//.test(src) && !src.includes("/emoji/")) {
        seen.add(src);
        media.push({ type: "image", url: src, alt: img.alt || "" });
      }
    }
    for (const video of article.querySelectorAll("video[src], video source[src]")) {
      const src = video.getAttribute("src") || "";
      if (src && !seen.has(src)) {
        seen.add(src);
        media.push({ type: "video", url: src, alt: "" });
      }
    }
    return media;
  }

  function cardInfo(article, content, links) {
    const card = article.querySelector('a[data-testid^="card.layout"], a[data-testid="cardWrapper"]');
    if (!card?.href) return null;
    try {
      const url = new URL(card.href, location.origin).href;
      const textNodes = card.querySelectorAll('[dir="auto"]');
      const title = normalizeText(textNodes.length ? textNodes[0].textContent : "");
      if (!title || content.includes(url)) return { url, title };
      return { url, title };
    } catch (_) {
      return null;
    }
  }

  function parseTweet(article, profileHandle) {
    const tweetUrl = statusUrlFromArticle(article);
    const statusId = statusIdFromHref(tweetUrl);
    if (!tweetUrl || !statusId) return null;

    const time = article.querySelector("time");
    const publishedAt = time?.getAttribute("datetime") || null;

    const body = article.querySelector('[data-testid="tweetText"]');
    const content = normalizeText(body ? Array.from(body.childNodes).map(serializeNode).join("") : "");

    const links = readLinks(body || article);
    const media = readMedia(article);
    const card = cardInfo(article, content, links);
    if (card?.url && !links.includes(card.url)) links.unshift(card.url);

    const social = article.querySelector('[data-testid="socialContext"]');
    const socialText = normalizeText(social?.textContent || "");
    const authors = authorLinksFromArticle(article);
    const ownHandle = new URL(tweetUrl).pathname.split("/")[1]?.toLowerCase();

    return {
      id: `x-${statusId}`,
      platform: "x",
      profileHandle,
      statusId,
      tweetUrl: new URL(tweetUrl, location.origin).href,
      publishedAt,
      author: {
        handle: ownHandle || authors[0] || profileHandle,
        name: normalizeText(article.querySelector('[data-testid="User-Name"]')?.textContent || "")
      },
      content,
      links,
      media,
      card,
      socialContext: socialText || null,
      isRepost: /repost|转推|转发了/i.test(socialText || ""),
      isReply: Boolean(article.querySelector('a[href*="/status/"][role="link"] time') === time &&
        article.querySelector('[data-testid="tweet"]')?.previousElementSibling?.textContent),
      savedAt: new Date().toISOString(),
      sourceUrl: location.href
    };
  }

  function cleanRecord(record) {
    return {
      ...record,
      isReply: false
    };
  }

  async function saveRecord(record) {
    if (!record || savedInSession.has(record.id)) return false;
    savedInSession.add(record.id);

    const result = await chrome.storage.local.get({ tweets: [] });
    const tweets = result.tweets;
    const existingIndex = tweets.findIndex((item) => item.id === record.id);
    let changed = false;

    if (existingIndex === -1) {
      tweets.unshift(cleanRecord(record));
      changed = true;
    } else {
      const old = tweets[existingIndex];
      const next = cleanRecord(record);
      if (!old.content && next.content) {
        tweets[existingIndex] = next;
        changed = true;
      }
    }

    if (changed) {
      const savedCount = tweets.filter((item) => item.profileHandle === record.profileHandle).length;
      await chrome.storage.local.set({ tweets: tweets.slice(0, 5000) });
      updateBadge(savedCount);
    } else {
      const savedCount = tweets.filter((item) => item.profileHandle === record.profileHandle).length;
      updateBadge(savedCount);
    }
    return changed;
  }

  function scanTweets() {
    const profileHandle = isProfilePage();
    if (!profileHandle) return;
    const articles = document.querySelectorAll('article[data-testid="tweet"]');
    for (const article of articles) {
      const record = parseTweet(article, profileHandle);
      if (record) void saveRecord(record);
    }
  }

  function ensureObserver() {
    if (observer) return;
    observer = new MutationObserver(() => {
      clearTimeout(ensureObserver._timer);
      ensureObserver._timer = setTimeout(scanTweets, 250);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function ensureBadge() {
    let badge = document.getElementById("x-notes-badge");
    if (!badge) {
      badge = document.createElement("div");
      badge.id = "x-notes-badge";
      badge.innerHTML = '<span id="x-notes-count">已保存 0 条</span>';
      document.body.appendChild(badge);
    }
    return badge;
  }

  function updateBadge(total, added = 0, target = 0) {
    if (!document.body) return;
    const badge = ensureBadge();
    badge.innerHTML = `
      <span class="metric">
        <b>${total}</b>
        <i>总量</i>
      </span>
      <span class="separator"></span>
      <span class="metric">
        <b>${added}${target ? `/${target}` : ""}</b>
        <i>新增</i>
      </span>
    `;
  }

  async function startAutoScroll(targetCount, sendProgress) {
    if (autoScrolling) return;
    autoScrolling = true;
    const token = ++autoScrollToken;
    const profileHandle = isProfilePage();
    if (!profileHandle) {
      autoScrolling = false;
      return;
    }

    const startingCount = await countForProfile(profileHandle);
    const desiredCount = startingCount + Math.max(1, Number(targetCount) || 0);
    const startTime = Date.now();
    let savedCount = startingCount;

    runtimeStatus.sessionSaved = savedCount - startingCount;
    runtimeStatus.sessionTarget = desiredCount - startingCount;
    runtimeStatus.total = savedCount;

    const sendStatus = (running, reason = null) => {
      updateBadge(savedCount, savedCount - startingCount, desiredCount - startingCount);
      if (!sendProgress) return;
      try {
        chrome.runtime.sendMessage({
          type: "X_NOTES_PROGRESS",
          total: savedCount,
          saved: savedCount - startingCount,
          target: desiredCount - startingCount,
          running,
          stoppedByUser: running === false,
          reason
        });
      } catch (_) {}
    };

    sendStatus(true);

    // 先完整收集当前屏幕内容。
    scanTweets();
    savedCount = await countForProfile(profileHandle);
    sendStatus(true);

    // 自然滚动节奏：一次滚动一页，等待整页加载完成后再继续。
    let consecutiveStalls = 0;
    let previousHeight = document.documentElement.scrollHeight;
    let previousCount = savedCount;

    while (autoScrolling && token === autoScrollToken && savedCount < desiredCount) {
      const beforeScrollTop = window.scrollY;
      const beforeHeight = document.documentElement.scrollHeight;

      window.scrollBy({
        top: Math.max(600, window.innerHeight * 0.85),
        behavior: "smooth"
      });

      // 等待新页面渲染、请求返回并解析整页内容。
      await new Promise((resolve) => setTimeout(resolve, 1500));
      scanTweets();

      // 如果已经到当前文档底部，稍等 X 追加下一批数据。
      const atDocumentBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 12;
      if (atDocumentBottom) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        scanTweets();
      }

      savedCount = await countForProfile(profileHandle);
      sendStatus(true);

      const currentHeight = document.documentElement.scrollHeight;
      const scrollTopChanged = Math.abs(window.scrollY - beforeScrollTop) > 10;
      const heightChanged = currentHeight !== beforeHeight;
      const countChanged = savedCount !== previousCount;

      // 不因为短时间无新增而退出。只有长时间既不能滚动、也没有新数据时，才继续重试。
      if (!scrollTopChanged && !heightChanged && !countChanged) {
        consecutiveStalls += 1;
      } else {
        consecutiveStalls = 0;
      }

      previousCount = savedCount;
      previousHeight = currentHeight;

      // 网络慢或页面需要更多时间时继续等待，而不是停止任务。
      if (consecutiveStalls > 0 && consecutiveStalls % 10 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }

      // 长时间完全无进展时尝试点击“加载更多”/恢复滚动。
      if (consecutiveStalls >= 30) {
        const retry = document.querySelector('[data-testid="cellInnerDiv"] [role="button"], [data-testid="placementTracking"]');
        if (retry) retry.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        window.scrollBy({ top: window.innerHeight, behavior: "smooth" });
        await new Promise((resolve) => setTimeout(resolve, 3000));
        scanTweets();
        savedCount = await countForProfile(profileHandle);
        sendStatus(true);
        consecutiveStalls = 15; // 继续给后续请求留时间
      }

      // 防御性保底：2 小时完全无停止动作时退出，避免页面被遗忘后无限运行。
      if (Date.now() - startTime > 2 * 60 * 60 * 1000) {
        autoScrolling = false;
        sendStatus(false, "timeout");
        return;
      }
    }

    if (token !== autoScrollToken) return;

    autoScrolling = false;
    if (savedCount >= desiredCount) {
      runtimeStatus.sessionSaved = savedCount - startingCount;
      runtimeStatus.sessionTarget = desiredCount - startingCount;
      runtimeStatus.total = savedCount;
      updateBadge(savedCount, savedCount - startingCount, desiredCount - startingCount);
    } else {
      updateBadge(savedCount, savedCount - startingCount, desiredCount - startingCount);
    }

    if (sendProgress) {
      try {
        chrome.runtime.sendMessage({
          type: "X_NOTES_PROGRESS",
          total: savedCount,
          saved: savedCount - startingCount,
          target: desiredCount - startingCount,
          running: false,
          stoppedByUser: false,
          reason: savedCount >= desiredCount ? "completed" : "stopped"
        });
      } catch (_) {}
    }
  }

  function stopAutoScroll() {
    autoScrolling = false;
    autoScrollToken++;
  }

  function getRuntimeStatus() {
    return {
      sessionSaved: runtimeStatus.sessionSaved,
      sessionTarget: runtimeStatus.sessionTarget,
      total: runtimeStatus.total
    };
  }

  async function countForProfile(handle) {
    if (!handle) return 0;
    const { tweets } = await chrome.storage.local.get({ tweets: [] });
    return tweets.filter((item) => item.profileHandle === handle).length;
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === MESSAGE.STATUS) {
      const profileHandle = isProfilePage();
      Promise.all([
        countForProfile(profileHandle),
        getRuntimeStatus()
      ]).then(([count, runtime]) => {
        sendResponse({
          profileHandle,
          count,
          autoScrolling,
          sessionSaved: runtime.sessionSaved,
          sessionTarget: runtime.sessionTarget
        });
      });
      return true;
    }
    if (message?.type === MESSAGE.START_SCROLL) {
      startAutoScroll(Number(message.targetCount || 0), message.sendProgress !== false);
      sendResponse({ ok: true });
      return true;
    }
    if (message?.type === MESSAGE.STOP_SCROLL) {
      stopAutoScroll();
      sendResponse({ ok: true });
      return true;
    }
    return false;
  });

  function initialize() {
    ensureObserver();
    scanTweets();
    showSavedCount();
  }

  if (document.body) initialize();
  else document.addEventListener("DOMContentLoaded", initialize);
})();
