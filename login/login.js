// login.js（新方式）
// フロントは Supabase に直接触らない。
// すべて Cloudflare Worker 経由の api.js に任せる。

import { api } from "../api.js";

const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const loginOrRegisterBtn = document.getElementById("loginOrRegisterBtn");
const googleBtn = document.getElementById("googleBtn");

// ------------------------------
// ログイン / 新規登録（統合ボタン）
// ------------------------------
loginOrRegisterBtn.onclick = async () => {
  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();

  if (!username || !password) {
    alert("ユーザー名とパスワードを入力してください");
    return;
  }

  // ボタン連打防止
  loginOrRegisterBtn.disabled = true;
  loginOrRegisterBtn.textContent = "処理中...";

  try {
    // 1. ユーザーが存在するか確認
    const exists = await api.checkUserExists(username);

    if (exists?.exists) {
      // ------------------------------
      // 既存ユーザー → ログイン
      // ------------------------------
      const result = await api.login(username, password);

      if (!result.ok) {
        alert("ログインに失敗しました: " + (result.error || ""));
        loginOrRegisterBtn.disabled = false;
        loginOrRegisterBtn.textContent = "ログイン / 新規登録";
        return;
      }

      // ログイン成功 → チャットへ
      window.location.href = "../chats/index.html";

    } else {
      // ------------------------------
      // 新規ユーザー → 登録
      // ------------------------------
      const result = await api.register(username, password);

      if (!result.ok) {
        alert("新規登録に失敗しました: " + (result.error || ""));
        loginOrRegisterBtn.disabled = false;
        loginOrRegisterBtn.textContent = "ログイン / 新規登録";
        return;
      }

      // 新規登録成功 → プロフィール設定へ
      window.location.href = "./setting/index.html";
    }

  } catch (err) {
    console.error(err);
    alert("通信エラーが発生しました");
    loginOrRegisterBtn.disabled = false;
    loginOrRegisterBtn.textContent = "ログイン / 新規登録";
  }
};

// ------------------------------
// Google ログイン
// ------------------------------
googleBtn.onclick = async () => {
  googleBtn.disabled = true;
  googleBtn.textContent = "Googleに接続中...";

  try {
    const result = await api.startGoogleLogin();

    if (!result.ok) {
      alert("Googleログインに失敗しました: " + result.error);
      googleBtn.disabled = false;
      googleBtn.textContent = "Googleでログイン";
      return;
    }

    // Worker から返された URL にリダイレクト
    window.location.href = result.url;

  } catch (err) {
    console.error(err);
    alert("Googleログインに失敗しました");
    googleBtn.disabled = false;
    googleBtn.textContent = "Googleでログイン";
  }
};
