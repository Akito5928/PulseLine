// verify.js（新方式）
// フロントは Supabase に直接触らない。
// すべて Cloudflare Worker 経由の api.js に任せる。

import { api } from "../api.js";

const emailLabel = document.getElementById("emailLabel");
const codeInput = document.getElementById("code");
const verifyBtn = document.getElementById("verifyBtn");

// login.js から渡されたメール
const email = sessionStorage.getItem("pl_login_email") || "";
emailLabel.textContent = email ? `送信先: ${email}` : "メールアドレスを確認してください";

verifyBtn.onclick = async () => {
  const code = codeInput.value.trim();
  if (code.length !== 6) {
    alert("6桁のコードを入力してください");
    return;
  }

  // Worker 経由で OTP を検証
  const result = await api.verifyOtp(email, code);

  if (!result.ok) {
    alert("コードの確認に失敗しました: " + result.error);
    return;
  }

  const user = result.user;
  if (!user) {
    alert("ユーザー情報の取得に失敗しました");
    return;
  }

  // プロフィールが存在するか Worker 経由で確認
  const profile = await api.getProfile(user.id);

  if (!profile.ok) {
    alert("プロフィール確認に失敗しました: " + profile.error);
    return;
  }

  if (!profile.exists) {
    // 初回 → 設定画面へ
    window.location.href = "/PulseLine/login/setting/index.html";
  } else {
    // 既存 → チャットへ
    window.location.href = "/PulseLine/chats/index.html";
  }
};
