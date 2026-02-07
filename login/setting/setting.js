import { createClient } from "https://esm.sh/@supabase/supabase-js";

const supabase = createClient(
  "https://xexmxegzextysojockkt.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhleG14ZWd6ZXh0eXNvam9ja2t0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NTcxNzAsImV4cCI6MjA4NDMzMzE3MH0.NZbo3YRCRzkS24ep_I9_PGmlJyK7y_hpBDThQENXqeo"
);

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
  const { data } = await supabase.auth.getUser();
  currentUser = data.user;

  if (!currentUser) {
    window.location.href = "./login/index.html";
    return;
  }

  // すでにプロフィールがあるなら /chats へ（Google 2回目以降など）
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (profile) {
    window.location.href = "./chats/index.html";
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

  // user_tag は自動生成候補
  const base = (displayNameEl.value || "user").toLowerCase().replace(/[^a-z0-9._-]/g, "");
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

  // user_tag 重複チェック
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_tag", user_tag);

  if (existing && existing.length > 0) {
    alert("このユーザーIDは既に使われています");
    return;
  }

  // アイコンアップロード
  let icon_url = null;

  if (selectedFile) {
    const ext = selectedFile.name.split(".").pop();
    const filePath = `avatars/${currentUser.id}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, selectedFile, { upsert: true });

    if (uploadError) {
      alert("アイコンのアップロードに失敗しました: " + uploadError.message);
      return;
    }

    const { data: publicUrl } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath);

    icon_url = publicUrl.publicUrl;
  } else {
    // Google の avatar_url をそのまま使うケース
    const meta = currentUser.user_metadata || {};
    if (meta.avatar_url) {
      icon_url = meta.avatar_url;
    }
  }

  // email は auth.users.email を保存
  const email = currentUser.email || null;

  // profiles 作成
  const { error: profileError } = await supabase
    .from("profiles")
    .insert({
      id: currentUser.id,
      display_name,
      user_tag,
      icon_url,
      email
    });

  if (profileError) {
    alert("プロフィールの保存に失敗しました: " + profileError.message);
    return;
  }

  window.location.href = "./chats/index.html";
};
