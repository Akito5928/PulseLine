import { createClient } from "https://esm.sh/@supabase/supabase-js";

const supabase = createClient(
  "https://xexmxegzextysojockkt.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhleG14ZWd6ZXh0eXNvam9ja2t0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NTcxNzAsImV4cCI6MjA4NDMzMzE3MH0.NZbo3YRCRzkS24ep_I9_PGmlJyK7y_hpBDThQENXqeo"
);

const emailEl = document.getElementById("email");
const loginBtn = document.getElementById("loginBtn");

// 🔥 ログイン / サインアップ（マジックリンク送信）
loginBtn.onclick = async () => {
  const email = emailEl.value.trim();
  if (!email) return;

  const { error } = await supabase.auth.signInWithOtp({ email });

  if (error) {
    alert("エラーが発生しました: " + error.message);
    return;
  }

  alert("ログインリンクを送信しました！");
};

// 🔥 ログイン状態を監視
supabase.auth.onAuthStateChange(async (event, session) => {
  if (!session) return;

  const user = session.user;

  // 🔍 profiles にレコードがあるか確認
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    // 初回ログイン → 初期設定へ
    window.location.href = "/login/setting/index.html";
  } else {
    // 既存ユーザー → チャットへ
    window.location.href = "/chats/index.html";
  }
});
