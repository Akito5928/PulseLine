import { createClient } from "https://esm.sh/@supabase/supabase-js";

const supabase = createClient(
  "https://xexmxegzextysojockkt.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhleG14ZWd6ZXh0eXNvam9ja2t0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NTcxNzAsImV4cCI6MjA4NDMzMzE3MH0.NZbo3YRCRzkS24ep_I9_PGmlJyK7y_hpBDThQENXqeoY"
);

const displayNameEl = document.getElementById("displayName");
const userTagEl = document.getElementById("userTag");
const fileInput = document.getElementById("fileInput");
const dropZone = document.getElementById("drop-zone");
const avatarPreview = document.getElementById("avatar-preview");
const saveBtn = document.getElementById("saveBtn");

let selectedFile = null;

// 🔥 ドラッグ&ドロップ処理
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

// 🔥 ファイル選択
fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (file) {
    selectedFile = file;
    avatarPreview.style.backgroundImage = `url(${URL.createObjectURL(file)})`;
  }
});

// 🔥 user_tag バリデーション
function validateUserTag(tag) {
  const regex = /^[a-z0-9._-]{1,32}$/;
  return regex.test(tag);
}

// 🔥 保存処理
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

  // 🔥 ログインユーザー取得
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) {
    alert("ログイン情報が見つかりません。");
    return;
  }

  // 🔥 user_tag 重複チェック
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_tag", user_tag)
    .neq("id", user.id);

  if (existing && existing.length > 0) {
    alert("このユーザーIDは既に使われています");
    return;
  }

  // 🔥 アイコンアップロード
  let icon_url = null;

  if (selectedFile) {
    const fileExt = selectedFile.name.split(".").pop();
    const filePath = `avatars/${user.id}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, selectedFile, { upsert: true });

    if (uploadError) {
      alert("アイコンのアップロードに失敗しました: " + uploadError.message);
      return;
    }

    // 公開URL取得
    const { data: publicUrl } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath);

    icon_url = publicUrl.publicUrl;
  }

  // 🔥 profiles に保存（upsert）
  const { error: profileError } = await supabase
    .from("profiles")
    .upsert({
      id: user.id,
      display_name,
      user_tag,
      icon_url
    });

  if (profileError) {
    alert("プロフィールの保存に失敗しました: " + profileError.message);
    return;
  }

  // 🔥 完了 → チャットへ
  window.location.href = "/chats/index.html";
};
