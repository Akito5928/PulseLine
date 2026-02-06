import { createClient } from "https://esm.sh/@supabase/supabase-js";

const supabase = createClient(
  "https://xexmxegzextysojockkt.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhleG14ZWd6ZXh0eXNvam9ja2t0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NTcxNzAsImV4cCI6MjA4NDMzMzE3MH0.NZbo3YRCRzkS24ep_I9_PGmlJyK7y_hpBDThQENXqeo"
);

const emailLabel = document.getElementById("emailLabel");
const codeInput = document.getElementById("code");
const verifyBtn = document.getElementById("verifyBtn");

// index.js から渡されたメール
const email = sessionStorage.getItem("pl_login_email") || "";
emailLabel.textContent = email ? `送信先: ${email}` : "メールアドレスを確認してください";

verifyBtn.onclick = async () => {
  const code = codeInput.value.trim();
  if (code.length !== 6) {
    alert("6桁のコードを入力してください");
    return;
  }

  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token: code,
    type: "email"
  });

  if (error) {
    alert("コードの確認に失敗しました: " + error.message);
    return;
  }

  // ログイン成功 → プロフィールがあるか確認
  const user = data.user;
  if (!user) {
    alert("ユーザー情報の取得に失敗しました");
    return;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    // 初回 → 設定画面へ
    window.location.href = "./login/setting/index.html";
  } else {
    // 既存 → チャットへ
    window.location.href = "./chats/index.html";
  }
};
