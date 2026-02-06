import { createClient } from "https://esm.sh/@supabase/supabase-js";
import {
  initMessageModule,
  resetMessages,
  addOrUpdateMessage,
  removeMessage
} from "./message.js";

const supabase = createClient(
  "https://xexmxegzextysojockkt.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhleG14ZWd6ZXh0eXNvam9ja2t0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NTcxNzAsImV4cCI6MjA4NDMzMzE3MH0.NZbo3YRCRzkS24ep_I9_PGmlJyK7y_hpBDThQENXqeo"
);

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
  const { data } = await supabase.auth.getUser();
  currentUser = data.user;

  if (!currentUser) {
    window.location.href = "/login/index.html";
    return;
  }

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
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .single();

  currentProfile = profile;

  displayNameEl.value = profile.display_name || "";
  userTagEl.value = profile.user_tag || "";

  if (profile.icon_url) {
    avatarPreview.style.backgroundImage = `url(${profile.icon_url})`;
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

    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_tag", user_tag)
      .neq("id", currentUser.id);

    if (existing && existing.length > 0) {
      alert("このユーザーIDは既に使われています");
      return;
    }

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

    await supabase
      .from("profiles")
      .update({ display_name, user_tag, icon_url })
      .eq("id", currentUser.id);

    settingsModal.style.display = "none";
    await loadProfile();
  };
}

// ------------------------------
// チャンネル
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

async function loadChannel(id) {
  currentChannelId = id;
  resetMessages();

  const { data } = await supabase
    .from("messages")
    .select("*")
    .eq("channel_id", id)
    .order("id");

  for (const msg of data) {
    await addOrUpdateMessage(msg);
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
          await addOrUpdateMessage(payload.new);
        }
      }
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "messages" },
      async (payload) => {
        if (payload.new.channel_id === currentChannelId) {
          await addOrUpdateMessage(payload.new);
        }
      }
    )
    .on(
      "postgres_changes",
      { event: "DELETE", schema: "public", table: "messages" },
      (payload) => {
        removeMessage(payload.old.id);
      }
    )
    .subscribe();
}
