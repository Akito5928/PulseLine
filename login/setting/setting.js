// setting.js（新方式）
// すべての Supabase 操作は Cloudflare Worker 経由の api.js に任せる。

import { api } from "../api.js";  // ← パス注意（/login/setting/setting.js）

const displayNameEl = document.getElementById("displayName");
const userTagEl = document.getElementById("userTag");
const fileInput = document.getElementById("fileInput");
const dropZone = document.getElementById("drop-zone");
const avatarPreview = document.getElementById("avatar-preview");
const saveBtn = document.getElementById("saveBtn");

let selectedFile = null;
let currentUser = null;

// 初期化
init();

async function init() {
  // Worker 経由でログイン中ユーザー取得
  const userRes = await api.getCurrentUser();
  if (!userRes.ok) {
    window.location.href = "/PulseLine/login/index.html";
    return;
  }

  currentUser = userRes.user;

  // プロフィールが既にあるなら /chats へ
  const profileRes = await api.getProfile(currentUser.id);
  if (profileRes.ok && profileRes.exists) {
    window.location.href = "/PulseLine/chats/index.html";
    return;
  }

  // Google ログインの場合、user_metadata から初期値を入れる
  const meta = currentUser.user_metadata || {};
  if (meta.full_name || meta.name) {
    displayNameEl.value = meta.full_name || meta.name;
  }
  if (meta.avatar_url) {
    avatarPreview.style.backgroundImage = `url(${meta.avatar_url})`;
  }

  // user_tag 自動生成
  const base = (displayNameEl.value || "user")
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "");
  const rand = Math.floor(1000 + Math.random() * 9000);
  userTagEl.value = (base || "user") + rand;
}

// ドラッグ&ドロップ
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

// user_tag バリデーション
function validateUserTag(tag) {
  const regex = /^[a-z0-9._-]{1,32}$/;
  return regex.test(tag);
}

// 保存
saveBtn.onclick = async () => {
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

  // user_tag 重複チェック（Worker 経由）
  const tagCheck = await api.checkUserTag(user_tag);
  if (!tagCheck.ok) {
    alert("ユーザーID確認に失敗しました: " + tagCheck.error);
    return;
  }
  if (tagCheck.exists) {
    alert("このユーザーIDは既に使われています");
    return;
  }

  // アイコンアップロード（Worker 経由）
  let icon_url = null;

  if (selectedFile) {
    const uploadRes = await api.uploadAvatar(currentUser.id, selectedFile);
    if (!uploadRes.ok) {
      alert("アイコンのアップロードに失敗しました: " + uploadRes.error);
      return;
    }
    icon_url = uploadRes.url;
  } else {
    // Google の avatar_url をそのまま使うケース
    const meta = currentUser.user_metadata || {};
    if (meta.avatar_url) {
      icon_url = meta.avatar_url;
    }
  }

  // プロフィール作成（Worker 経由）
  const saveRes = await api.createProfile({
    id: currentUser.id,
    display_name,
    user_tag,
    icon_url,
    email: currentUser.email || null
  });

  if (!saveRes.ok) {
    alert("プロフィールの保存に失敗しました: " + saveRes.error);
    return;
  }

  window.location.href = "/PulseLine/chats/index.html";
};
