import { createClient } from "https://esm.sh/@supabase/supabase-js";

const supabase = createClient(
  "https://xexmxegzextysojockkt.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhleG14ZWd6ZXh0eXNvam9ja2t0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NTcxNzAsImV4cCI6MjA4NDMzMzE3MH0.NZbo3YRCRzkS24ep_I9_PGmlJyK7y_hpBDThQENXqeo"
);

// UI要素
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
let lastDate = null;
let lastMessageUser = null;
let lastMessageMinute = null;

// ------------------------------
// 初期ロード
// ------------------------------
init();

async function init() {
  const { data } = await supabase.auth.getUser();
  currentUser = data.user;

  if (!currentUser) {
    window.location.href = "/login/index.html";
    return;
  }

  await loadProfile();
  await loadChannels();
  await loadChannel(currentChannelId);
  setupRealtime();
}

// ------------------------------
// プロフィール読み込み
// ------------------------------
async function loadProfile() {
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .single();

  currentProfile = profile;

  // 設定UIに反映
  displayNameEl.value = profile.display_name || "";
  userTagEl.value = profile.user_tag || "";

  if (profile.icon_url) {
    avatarPreview.style.backgroundImage = `url(${profile.icon_url})`;
  }
}

// ------------------------------
// 設定モーダル開閉
// ------------------------------
settingsBtn.onclick = () => {
  settingsModal.style.display = "flex";
};

closeSettings.onclick = () => {
  settingsModal.style.display = "none";
};

// ------------------------------
// アイコンアップロード（ドラッグ&ドロップ）
// ------------------------------
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

// ------------------------------
// user_tag バリデーション
// ------------------------------
function validateUserTag(tag) {
  const regex = /^[a-z0-9._-]{1,32}$/;
  return regex.test(tag);
}

// ------------------------------
// 設定保存
// ------------------------------
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

  // 重複チェック
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_tag", user_tag)
    .neq("id", currentUser.id);

  if (existing && existing.length > 0) {
    alert("このユーザーIDは既に使われています");
    return;
  }

  // アイコンアップロード
  let icon_url = currentProfile.icon_url;

  if (selectedFile) {
    const ext = selectedFile.name.split(".").pop();
    const filePath = `avatars/${currentUser.id}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, selectedFile, { upsert: true });

    if (uploadError) {
      alert("アイコンのアップロードに失敗しました");
      return;
    }

    const { data: publicUrl } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath);

    icon_url = publicUrl.publicUrl;
  }

  // プロフィール更新
  await supabase.from("profiles").update({
    display_name,
    user_tag,
    icon_url
  }).eq("id", currentUser.id);

  settingsModal.style.display = "none";
  await loadProfile();
};

// ------------------------------
// チャンネル一覧
// ------------------------------
async function loadChannels() {
  const { data: channels } = await supabase
    .from("channels")
    .select("*")
    .order("id");

  channelsEl.innerHTML = "";

  channels.forEach((ch) => {
    const div = document.createElement("div");
    div.textContent = ch.name;
    div.style.cursor = "pointer";
    div.onclick = () => loadChannel(ch.id);
    channelsEl.appendChild(div);
  });
}

// ------------------------------
// チャンネル切り替え
// ------------------------------
async function loadChannel(id) {
  currentChannelId = id;
  messagesEl.innerHTML = "";
  lastDate = null;
  lastMessageUser = null;
  lastMessageMinute = null;

  const { data } = await supabase
    .from("messages")
    .select("*")
    .eq("channel_id", id)
    .order("id");

  for (const msg of data) {
    await addMessage(msg);
  }
}

// ------------------------------
// メッセージ送信
// ------------------------------
sendBtn.onclick = async () => {
  const content = inputEl.value.trim();
  if (!content) return;

  await supabase.from("messages").insert({
    content,
    channel_id: currentChannelId,
    author_id: currentUser.id
  });

  inputEl.value = "";
};

// Enter → 送信 / Ctrl+Enter → 改行
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
// Realtime
// ------------------------------
function setupRealtime() {
  supabase
    .channel("messages")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      async (payload) => {
        if (payload.new.channel_id === currentChannelId) {
          await addMessage(payload.new);
        }
      }
    )
    .subscribe();
}

// ------------------------------
// 既読処理
// ------------------------------
async function markAsRead(messageId) {
  await supabase.from("read_receipts").upsert({
    message_id: messageId,
    user_id: currentUser.id,
    read_at: new Date().toISOString()
  });
}

async function getReadCount(messageId) {
  const { data } = await supabase
    .from("read_receipts")
    .select("user_id")
    .eq("message_id", messageId);

  return data ? data.length : 0;
}

// ------------------------------
// メッセージ描画（Discord風グルーピング）
// ------------------------------
async function addMessage(msg) {
  const msgDate = formatDate(msg.created_at);

  // 日付区切り線
  if (lastDate !== msgDate) {
    lastDate = msgDate;

    const line = document.createElement("div");
    line.style.textAlign = "center";
    line.style.color = "#bbb";
    line.style.margin = "15px 0";
    line.textContent = `---------- ${msgDate} ----------`;
    messagesEl.appendChild(line);
  }

  // プロフィール取得
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", msg.author_id)
    .single();

  const nameTag = `${profile.display_name}@${profile.user_tag}`;
  const minute = formatTime(msg.created_at);

  const sameUser = (msg.author_id === lastMessageUser);
  const sameMinute = (minute === lastMessageMinute);

  let bubble;

  if (!sameUser || !sameMinute) {
    // 新しいバブル
    bubble = document.createElement("div");
    bubble.style.marginBottom = "10px";

    const header = document.createElement("div");
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.marginBottom = "3px";

    const avatar = document.createElement("img");
    avatar.src = profile.icon_url;
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

    header.appendChild(avatar);
    header.appendChild(nameEl);
    header.appendChild(timeEl);

    bubble.appendChild(header);

    messagesEl.appendChild(bubble);
  } else {
    // 同じバブル → 最後のバブルを取得
    bubble = messagesEl.lastElementChild;
  }

  // 本文
  const content = document.createElement("div");
  content.textContent = msg.content;
  content.style.marginLeft = "46px";
  bubble.appendChild(content);

  // 既読（自分のメッセージだけ）
  if (msg.author_id === currentUser.id) {
    const readCount = await getReadCount(msg.id);

    const readEl = document.createElement("div");
    readEl.style.fontSize = "10px";
    readEl.style.color = "#aaa";
    readEl.style.marginLeft = "46px";
    readEl.textContent = `既読 ${readCount}`;

    bubble.appendChild(readEl);
  } else {
    // 自分以外のメッセージ → 既読をつける
    markAsRead(msg.id);
  }

  lastMessageUser = msg.author_id;
  lastMessageMinute = minute;

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ------------------------------
// 日付・時刻フォーマット
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
