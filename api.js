// api.js（PulseLine 新方式 API レイヤー）
// すべての通信を Cloudflare Worker に集約する。

const API_BASE = "https://YOUR_WORKER_URL/api";

export const api = {
  // ------------------------------
  // 認証
  // ------------------------------
  async sendOtp(email) {
    return post("/auth/send-otp", { email });
  },

  async startGoogleLogin() {
    return post("/auth/google/start");
  },

  async verifyOtp(email, code) {
    return post("/auth/verify-otp", { email, code });
  },

  async getCurrentUser() {
    return get("/auth/user");
  },

  // ------------------------------
  // プロフィール
  // ------------------------------
  async getProfile(userId) {
    return get(`/profile/${userId}`);
  },

  async checkUserTag(user_tag, excludeUserId = null) {
    return post("/profile/check-tag", { user_tag, excludeUserId });
  },

  async uploadAvatar(userId, file) {
    const form = new FormData();
    form.append("file", file);
    form.append("userId", userId);

    return fetch(`${API_BASE}/profile/upload-avatar`, {
      method: "POST",
      body: form
    }).then(r => r.json());
  },

  async createProfile(data) {
    return post("/profile/create", data);
  },

  async updateProfile(data) {
    return post("/profile/update", data);
  },

  // ------------------------------
  // チャンネル
  // ------------------------------
  async getChannels() {
    return get("/channels/list");
  },

  // ------------------------------
  // メッセージ
  // ------------------------------
  async getMessages(channelId) {
    return get(`/messages/list/${channelId}`);
  },

  async sendMessage(data) {
    return post("/messages/send", data);
  },

  async updateMessage(messageId, content) {
    return post("/messages/update", { messageId, content });
  },

  async deleteMessage(messageId) {
    return post("/messages/delete", { messageId });
  },

  // ------------------------------
  // 既読
  // ------------------------------
  async markAsRead(messageId) {
    return post("/messages/read", { messageId });
  },

  async getReadCount(messageId) {
    return get(`/messages/read-count/${messageId}`);
  },

  // ------------------------------
  // Realtime（SSE or WebSocket）
  // ------------------------------
  subscribeMessages(callback) {
    const es = new EventSource(`${API_BASE}/realtime/messages`);
    es.onmessage = (e) => callback(JSON.parse(e.data));
    return es;
  },

  subscribeReadReceipts(callback) {
    const es = new EventSource(`${API_BASE}/realtime/read-receipts`);
    es.onmessage = (e) => callback(JSON.parse(e.data));
    return es;
  }
};

// ------------------------------
// 内部ユーティリティ
// ------------------------------
async function get(path) {
  return fetch(`${API_BASE}${path}`, {
    method: "GET",
    credentials: "include"
  }).then(r => r.json());
}

async function post(path, body) {
  return fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body)
  }).then(r => r.json());
}
