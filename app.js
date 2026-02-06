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
}

// 🔹 メッセージ送信
sendBtn.onclick = async () => {
  const content = inputEl.value.trim();
  if (!content) return;

  await supabase.from("messages").insert({
    content,
    channel_id: currentChannelId
  });

  inputEl.value = "";
};

// 🔹 Realtime 購読
supabase
  .channel("messages")
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "messages" },
    (payload) => {
      if (payload.new.channel_id === currentChannelId) {
        addMessage(payload.new);
      }
    }
  )
  .subscribe();

function addMessage(msg) {
  const div = document.createElement("div");
  div.textContent = msg.content;
  messagesEl.appendChild(div);
}

// 初期ロード
loadChannels();
loadChannel(1);
