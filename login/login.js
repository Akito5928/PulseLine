import { createClient } from "https://esm.sh/@supabase/supabase-js";

const supabase = createClient(
  "https://xexmxegzextysojockkt.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhleG14ZWd6ZXh0eXNvam9ja2t0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3NTcxNzAsImV4cCI6MjA4NDMzMzE3MH0.NZbo3YRCRzkS24ep_I9_PGmlJyK7y_hpBDThQENXqeo"
);

const emailInput = document.getElementById("email");
const emailLoginBtn = document.getElementById("emailLoginBtn");
const googleBtn = document.getElementById("googleBtn");

// メールで6桁コード送信 → verify.htmlへ
emailLoginBtn.onclick = async () => {
  const email = emailInput.value.trim();
  if (!email) {
    alert("メールアドレスを入力してください");
    return;
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: "https://your-domain.com/login/verify.html"
    }
  });

  if (error) {
    alert("メール送信に失敗しました: " + error.message);
    return;
  }

  // verify.html にメールアドレスを渡す（sessionStorage）
  sessionStorage.setItem("pl_login_email", email);
  window.location.href = "/login/verify.html";
};

// Google ログイン
googleBtn.onclick = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: "https://your-domain.com/login/setting/index.html"
    }
  });

  if (error) {
    alert("Googleログインに失敗しました: " + error.message);
  }
};
