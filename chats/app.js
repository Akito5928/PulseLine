// app.js（新方式）
// Supabase 直アクセス禁止。
// すべて Cloudflare Worker 経由の api.js に任せる。

import { api } from "../api.js";
import {
  initMessageModule,
  resetMessages,
  addOrUpdateMessage,
  removeMessage
} from "./message.js";

// UI
const channelsEl = document.getElementById("channels");
const messagesEl = document.getElementById("messages");
const inputEl = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

// 設定UI
const settingsBtn = document.getElementById("settingsBtn");
const settingsModal = document.getElementById("settingsModal");
const closeSettings = document.getElementById("closeSettings");
const displayNameEl = document.getElementById("displayName");
const userTagEl = document.getElementById("userTag");
const avatarPreview = document.getElementById("avatar-preview");
const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("fileInput");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");

let selectedFile = null;
let currentUser = null;
let currentProfile = null;
let currentChannelId = 1;

// ------------------------------
// 初期化
// ------------------------------
init();

async function init() {
  // Worker 経由でログイン中ユーザー取得
  const userRes = await api.getCurrentUser();
  if (!userRes.ok) {
    window.location.href = "/PulseLine/login/index.html";
    return;
  }

  currentUser = userRes.user;

  initMessageModule(messagesEl, currentUser);

  await loadProfile();
  setupSettingsUI();
  await loadChannels();
  await loadChannel(currentChannelId);
  setupRealtime();
}

// ------------------------------
// プロフィール
// ------------------------------
async function loadProfile() {
  const profileRes = await api.getProfile(currentUser.id);

  if (!profileRes.ok) {
    alert("プロフィール取得に失敗しました: " + profileRes.error);
    return;
  }

  currentProfile = profileRes.profile;

  displayNameEl.value = currentProfile.display_name || "";
  userTagEl.value = currentProfile.user_tag || "";

  if (currentProfile.icon_url) {
    avatarPreview.style.backgroundImage = `url(${currentProfile.icon_url})`;
  }
}

function validateUserTag(tag) {
  const regex = /^[a-z0-9._-]{1,32}$/;
  return regex.test(tag);
}

function setupSettingsUI() {
  settingsBtn.onclick = () => {
    settingsModal.style.display = "flex";
  };

  closeSettings.onclick = () => {
    settingsModal.style.display = "none";
  };

  dropZone.addEventListener("click", () => fileInput.click());
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });
  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
  });
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    const file = e.dataTransfer.files[0];
    if (file) {
      selectedFile = file;
      avatarPreview.style.backgroundImage = `url(${URL.createObjectURL(file)})`;
    }
  });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (file) {
      selectedFile = file;
      avatarPreview.style.backgroundImage = `url(${URL.createObjectURL(file)})`;
    }
  });

  saveSettingsBtn.onclick = async () => {
    const display_name = displayNameEl.value.trim();
    const user_tag = userTagEl.value.trim();

    if (!display_name) {
      alert("表示名を入力してください");
      return;
    }

    if (!validateUserTag(user_tag)) {
      alert("ユーザーIDは英小文字・数字・._- のみ、1〜32文字で入力してください");
      return;
    }

    // user_tag 重複チェック
    const tagCheck = await api.checkUserTag(user_tag, currentUser.id);
    if (!tagCheck.ok) {
      alert("ユーザーID確認に失敗しました: " + tagCheck.error);
      return;
    }
    if (tagCheck.exists) {
      alert("このユーザーIDは既に使われています");
      return;
    }

    // アイコンアップロード
    let icon_url = currentProfile.icon_url;

    if (selectedFile) {
      const uploadRes = await api.uploadAvatar(currentUser.id, selectedFile);
      if (!uploadRes.ok) {
        alert("アイコンのアップロードに失敗しました: " + uploadRes.error);
        return;
      }
      icon_url = uploadRes.url;
    }

    // プロフィール更新
    const updateRes = await api.updateProfile({
      id: currentUser.id,
      display_name,
      user_tag,
      icon_url
    });

    if (!updateRes.ok) {
      alert("プロフィール更新に失敗しました: " + updateRes.error);
      return;
    }

    settingsModal.style.display = "none";
    await loadProfile();
  };
}

// ------------------------------
// チャンネル
// ------------------------------
async function loadChannels() {
  const res = await api.getChannels();
  if (!res.ok) {
    alert("チャンネル取得に失敗しました: " + res.error);
    return;
  }

  channelsEl.innerHTML = "";

  res.channels.forEach((ch) => {
    const div = document.createElement("div");
    div.textContent = ch.name;
    div.style.cursor = "pointer";
    div.onclick = () => loadChannel(ch.id);
    channelsEl.appendChild(div);
  });
}

async function loadChannel(id) {
  currentChannelId = id;
  resetMessages();

  const res = await api.getMessages(id);
  if (!res.ok) {
    alert("メッセージ取得に失敗しました: " + res.error);
    return;
  }

  for (const msg of res.messages) {
    await addOrUpdateMessage(msg);
  }
}

// ------------------------------
// メッセージ送信
// ------------------------------
sendBtn.onclick = async () => {
  const content = inputEl.value.trim();
  if (!content) return;

  const res = await api.sendMessage({
    content,
    channel_id: currentChannelId,
    author_id: currentUser.id
  });

  if (!res.ok) {
    alert("メッセージ送信に失敗しました: " + res.error);
    return;
  }

  inputEl.value = "";
};

inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.ctrlKey) {
    e.preventDefault();
    const start = inputEl.selectionStart;
    const end = inputEl.selectionEnd;
    inputEl.value =
      inputEl.value.substring(0, start) +
      "\n" +
      inputEl.value.substring(end);
    inputEl.selectionStart = inputEl.selectionEnd = start + 1;
    return;
  }

  if (e.key === "Enter") {
    e.preventDefault();
    sendBtn.click();
  }
});

// ------------------------------
// Realtime（Worker 経由）
// ------------------------------
function setupRealtime() {
  api.subscribeMessages((event) => {
    if (event.type === "INSERT" && event.data.channel_id === currentChannelId) {
      addOrUpdateMessage(event.data);
    }
    if (event.type === "UPDATE" && event.data.channel_id === currentChannelId) {
      addOrUpdateMessage(event.data);
    }
    if (event.type === "DELETE") {
      removeMessage(event.data.id);
    }
  });
}
