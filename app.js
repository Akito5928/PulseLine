import { createClient } from "https://esm.sh/@supabase/supabase-js";

const supabase = createClient(
  "https://xexmxegzextysojockkt.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhleG14ZWd6ZXh0eXNvam9ja2t0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NTcxNzAsImV4cCI6MjA4NDMzMzE3MH0.NZbo3YRCRzkS24ep_I9_PGmlJyK7y_hpBDThQENXqeo"
);

let currentChannelId = 1;

const channelsEl = document.getElementById("channels");
const messagesEl = document.getElementById("messages");
const inputEl = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

// 🔹 チャンネル一覧をロード
async function loadChannels() {
  const { data: channels } = await supabase
    .from("channels")
    .select("*")
    .order("id");

  channels.forEach((ch) => {
    const div = document.createElement("div");
    div.textContent = ch.name;
    div.style.cursor = "pointer";
    div.onclick = () => loadChannel(ch.id);
    channelsEl.appendChild(div);
  });
}

// 🔹 チャンネル切り替え
async function loadChannel(id) {
  currentChannelId = id;
  messagesEl.innerHTML = "";

  const { data } = await supabase
    .from("messages")
    .select("*")
    .eq("channel_id", id)
    .order("id");

  data.forEach(addMessage);

  // 読み込んだメッセージを既読にする
  markAsRead(data);
}

// 🔹 メッセージ送信
sendBtn.onclick = async () => {
  const content = inputEl.value.trim();
  if (!content) return;

  const user = (await supabase.auth.getUser()).data.user;

  await supabase.from("messages").insert({
    content,
    channel_id: currentChannelId,
    author_id: user ? user.id : null
  });

  inputEl.value = "";
};

// 🔹 Enter → 送信 / Ctrl+Enter → 改行
inputEl.addEventListener("keydown", (e) => {
  // Ctrl + Enter → 改行
  if (e.key === "Enter" && e.ctrlKey) {
    e.preventDefault();
    const start = inputEl.selectionStart;
    const end = inputEl.selectionEnd;
    inputEl.value =
      inputEl.value.substring(0, start) + "\n" + inputEl.value.substring(end);
    inputEl.selectionStart = inputEl.selectionEnd = start + 1;
    return;
  }

  // Enter → 送信
  if (e.key === "Enter") {
    e.preventDefault();
    sendBtn.click();
  }
});

// 🔹 Realtime（新規メッセージ）
supabase
  .channel("messages")
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "messages" },
    async (payload) => {
      if (payload.new.channel_id === currentChannelId) {
        addMessage(payload.new);
        markAsRead([payload.new]);
      }
    }
  )
  .subscribe();

// 🔹 既読数を取得
async function getReadCount(messageId) {
  const { data } = await supabase
    .from("read_receipts")
    .select("user_id")
    .eq("message_id", messageId);

  return data ? data.length : 0;
}

// 🔹 既読をつける
async function markAsRead(messages) {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) return; // 匿名は既読なし

  const inserts = messages.map((msg) => ({
    message_id: msg.id,
    user_id: user.id
  }));

  await supabase.from("read_receipts").upsert(inserts);
}

// 🔹 メッセージ描画（既読表示対応）
async function addMessage(msg) {
  const div = document.createElement("div");
  div.style.marginBottom = "10px";
  div.dataset.id = msg.id;

  // 本文
  const content = document.createElement("div");
  content.textContent = msg.content;
  div.appendChild(content);

  // 自分のメッセージだけ既読表示
  const user = (await supabase.auth.getUser()).data.user;
  if (user && msg.author_id === user.id) {
    const readCount = await getReadCount(msg.id);

    const readEl = document.createElement("div");
    readEl.className = "read";
    readEl.textContent = `（既読 ${readCount}）`;
    div.appendChild(readEl);
  }

  messagesEl.appendChild(div);
}

// 初期ロード
loadChannels();
loadChannel(1);
