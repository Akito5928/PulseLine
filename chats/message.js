// message.js（新方式）
// Supabase 直アクセス禁止。
// すべて Cloudflare Worker 経由の api.js に任せる。

import { api } from "../api.js";

let messagesEl = null;
let currentUser = null;

let lastDate = null;
let lastMessageUser = null;
let lastMessageMinute = null;

const messageMap = new Map();      // id → { bubble, contentEl, readEl }
const readCountMap = new Map();    // id → readEl

// ------------------------------
// 初期化
// ------------------------------
export function initMessageModule(rootEl, user) {
  messagesEl = rootEl;
  currentUser = user;

  // Worker 経由のリアルタイム購読
  api.subscribeReadReceipts(async (event) => {
    if (event.type === "INSERT") {
      const msgId = event.data.message_id;
      await updateReadCount(msgId);
    }
  });
}

export function resetMessages() {
  messagesEl.innerHTML = "";
  lastDate = null;
  lastMessageUser = null;
  lastMessageMinute = null;
  messageMap.clear();
  readCountMap.clear();
}

export async function addOrUpdateMessage(msg) {
  if (messageMap.has(msg.id)) {
    await updateMessageContent(msg);
    return;
  }

  await renderNewMessage(msg);
}

export function removeMessage(messageId) {
  const entry = messageMap.get(messageId);
  if (!entry) return;
  entry.bubble.remove();
  messageMap.delete(messageId);
  readCountMap.delete(messageId);
}

// ------------------------------
// 内部処理
// ------------------------------
async function renderNewMessage(msg) {
  const msgDate = formatDate(msg.created_at);

  if (lastDate !== msgDate) {
    lastDate = msgDate;
    const line = document.createElement("div");
    line.style.textAlign = "center";
    line.style.color = "#bbb";
    line.style.margin = "15px 0";
    line.textContent = `---------- ${msgDate} ----------`;
    messagesEl.appendChild(line);
  }

  // Worker 経由でプロフィール取得
  const profileRes = await api.getProfile(msg.author_id);
  if (!profileRes.ok) return;

  const profile = profileRes.profile;
  const nameTag = `${profile.display_name}@${profile.user_tag}`;
  const minute = formatTime(msg.created_at);

  const sameUser = msg.author_id === lastMessageUser;
  const sameMinute = minute === lastMessageMinute;

  let bubble;

  if (!sameUser || !sameMinute) {
    bubble = document.createElement("div");
    bubble.style.marginBottom = "10px";
    bubble.dataset.messageGroup = "1";

    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.marginBottom = "3px";

    const avatar = document.createElement("img");
    avatar.src = profile.icon_url || "";
    avatar.style.width = "36px";
    avatar.style.height = "36px";
    avatar.style.borderRadius = "50%";
    avatar.style.marginRight = "10px";

    const nameEl = document.createElement("div");
    nameEl.textContent = nameTag;
    nameEl.style.fontWeight = "bold";

    const timeEl = document.createElement("div");
    timeEl.textContent = minute;
    timeEl.style.color = "#aaa";
    timeEl.style.fontSize = "12px";
    timeEl.style.marginLeft = "8px";

    const menuWrapper = document.createElement("div");
    menuWrapper.style.marginLeft = "auto";
    menuWrapper.style.position = "relative";

    if (msg.author_id === currentUser.id) {
      const menuBtn = document.createElement("div");
      menuBtn.textContent = "⋯";
      menuBtn.style.cursor = "pointer";
      menuBtn.style.padding = "0 6px";

      const menu = document.createElement("div");
      menu.style.position = "absolute";
      menu.style.right = "0";
      menu.style.top = "18px";
      menu.style.background = "#202225";
      menu.style.borderRadius = "4px";
      menu.style.padding = "4px 0";
      menu.style.minWidth = "80px";
      menu.style.display = "none";
      menu.style.zIndex = "10";

      const editItem = document.createElement("div");
      editItem.textContent = "編集";
      editItem.style.padding = "4px 10px";
      editItem.style.cursor = "pointer";

      const deleteItem = document.createElement("div");
      deleteItem.textContent = "削除";
      deleteItem.style.padding = "4px 10px";
      deleteItem.style.cursor = "pointer";
      deleteItem.style.color = "#ff6b6b";

      editItem.onclick = () => startEditMessage(msg.id);
      deleteItem.onclick = (e) => handleDeleteClick(e, msg.id);

      menu.appendChild(editItem);
      menu.appendChild(deleteItem);

      menuBtn.onclick = () => {
        menu.style.display = menu.style.display === "none" ? "block" : "none";
      };

      document.addEventListener("click", (e) => {
        if (!menuWrapper.contains(e.target)) {
          menu.style.display = "none";
        }
      });

      menuWrapper.appendChild(menuBtn);
      menuWrapper.appendChild(menu);
    }

    header.appendChild(avatar);
    header.appendChild(nameEl);
    header.appendChild(timeEl);
    header.appendChild(menuWrapper);

    bubble.appendChild(header);
    messagesEl.appendChild(bubble);
  } else {
    bubble = messagesEl.lastElementChild;
  }

  const content = document.createElement("div");
  content.textContent = msg.content;
  content.style.marginLeft = "46px";
  content.style.whiteSpace = "pre-wrap";

  bubble.appendChild(content);

  let readEl = null;

  if (msg.author_id === currentUser.id) {
    const count = await api.getReadCount(msg.id);
    readEl = document.createElement("div");
    readEl.style.fontSize = "10px";
    readEl.style.color = "#aaa";
    readEl.style.marginLeft = "46px";
    readEl.textContent = `既読 ${count}`;
    bubble.appendChild(readEl);
    readCountMap.set(msg.id, readEl);
  } else {
    api.markAsRead(msg.id);
  }

  messageMap.set(msg.id, { bubble, contentEl: content, readEl });

  lastMessageUser = msg.author_id;
  lastMessageMinute = minute;

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function updateMessageContent(msg) {
  const entry = messageMap.get(msg.id);
  if (!entry) return;

  entry.contentEl.textContent = msg.content + (msg.edited_at ? " (編集済み)" : "");
}

async function updateReadCount(messageId) {
  const readEl = readCountMap.get(messageId);
  if (!readEl) return;

  const count = await api.getReadCount(messageId);
  readEl.textContent = `既読 ${count}`;
}

// ------------------------------
// 編集
// ------------------------------
function startEditMessage(messageId) {
  const entry = messageMap.get(messageId);
  if (!entry) return;

  const originalText = entry.contentEl.textContent.replace(" (編集済み)", "");

  const textarea = document.createElement("textarea");
  textarea.value = originalText;
  textarea.style.width = "100%";
  textarea.style.background = "#40444b";
  textarea.style.border = "none";
  textarea.style.borderRadius = "8px";
  textarea.style.padding = "8px";
  textarea.style.color = "white";
  textarea.style.fontSize = "14px";
  textarea.style.lineHeight = "1.4";
  textarea.style.resize = "none";
  textarea.style.outline = "none";
  textarea.style.boxSizing = "border-box";
  textarea.style.marginLeft = "46px";

  const autoResize = () => {
    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
  };
  autoResize();
  textarea.addEventListener("input", autoResize);

  entry.contentEl.replaceWith(textarea);

  textarea.focus();
  textarea.selectionStart = textarea.value.length;

  textarea.addEventListener("keydown", async (e) => {
    if (e.key === "Escape") {
      textarea.replaceWith(entry.contentEl);
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const newContent = textarea.value.trim();
      if (!newContent) {
        textarea.replaceWith(entry.contentEl);
        return;
      }

      const res = await api.updateMessage(messageId, newContent);
      if (!res.ok) {
        alert("メッセージ編集に失敗しました: " + res.error);
        return;
      }

      entry.contentEl.textContent = newContent + " (編集済み)";
      textarea.replaceWith(entry.contentEl);
    }
  });
}

// ------------------------------
// 削除
// ------------------------------
async function handleDeleteClick(e, messageId) {
  const skipConfirm = e.shiftKey;

  if (!skipConfirm) {
    const ok = confirm("このメッセージを削除しますか?");
    if (!ok) return;
  }

  const res = await api.deleteMessage(messageId);
  if (!res.ok) {
    alert("削除に失敗しました: " + res.error);
    return;
  }

  removeMessage(messageId);
}

// ------------------------------
// 既読
// ------------------------------
async function markAsRead(messageId) {
  await api.markAsRead(messageId);
}

async function getReadCount(messageId) {
  const res = await api.getReadCount(messageId);
  return res.ok ? res.count : 0;
}

// ------------------------------
// 日付・時刻
// ------------------------------
function formatTime(ts) {
  const d = new Date(ts);
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

function formatDate(ts) {
  const d = new Date(ts);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}
