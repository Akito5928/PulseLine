// login.js（新方式）
// フロントは Supabase に直接触らない。
// すべて Cloudflare Worker 経由の api.js に任せる。

import { api } from "../api.js";

const emailInput = document.getElementById("email");
const emailLoginBtn = document.getElementById("emailLoginBtn");
const googleBtn = document.getElementById("googleBtn");

// ------------------------------
// メールで6桁コード送信 → verify.htmlへ
// ------------------------------
emailLoginBtn.onclick = async () => {
  const email = emailInput.value.trim();
  if (!email) {
    alert("メールアドレスを入力してください");
    return;
  }

  // 送信中ロック（連打防止）
  emailLoginBtn.disabled = true;
  emailLoginBtn.textContent = "送信中...";

  // Worker 経由で OTP を送信
  const result = await api.sendOtp(email);

  if (!result.ok) {
    alert("メール送信に失敗しました: " + result.error);

    // ロック解除
    emailLoginBtn.disabled = false;
    emailLoginBtn.textContent = "ログイン / サインアップ";
    return;
  }

  // verify.html にメールアドレスを渡す（sessionStorage）
  sessionStorage.setItem("pl_login_email", email);

  // 次の画面へ
  window.location.href = "verify.html";
};

// ------------------------------
// Google ログイン
// ------------------------------
googleBtn.onclick = async () => {
  googleBtn.disabled = true;
  googleBtn.textContent = "Googleに接続中...";

  // Worker 経由で Google OAuth 開始
  const result = await api.startGoogleLogin();

  if (!result.ok) {
    alert("Googleログインに失敗しました: " + result.error);
    googleBtn.disabled = false;
    googleBtn.textContent = "Googleでログイン";
    return;
  }

  // Worker から返された URL にリダイレクト
  window.location.href = result.url;
};
