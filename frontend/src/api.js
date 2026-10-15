const BASE = 'http://localhost:3000/api';
async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || 'エラーが発生しました');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  // 登録用（signup と register の両方で動くようにする）
  signup: (email, password) =>
    request('/signup', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (email, password) =>
    request('/signup', { method: 'POST', body: JSON.stringify({ email, password }) }),

  login: (email, password) =>
    request('/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  logout: () =>
    request('/logout', { method: 'POST' }),

  me: () =>
    request('/me'),

  smartSearch: (text, scope) =>
    request('/smart-search', { method: 'POST', body: JSON.stringify({ text, scope }) }),

  auctionUrls: (keyword, scope) =>
    request(`/search?keyword=${encodeURIComponent(keyword)}&scope=${scope}`),

  marketPrice: (text) =>
    request('/market-price', { method: 'POST', body: JSON.stringify({ text }) }),

  exchangeRate: () =>
    request('/exchange-rate'),

  addFavorite: (keyword, url, siteName) =>
    request('/favorites', { method: 'POST', body: JSON.stringify({ keyword, url, siteName }) }),

  listFavorites: () =>
    request('/favorites'),

  deleteFavorite: (id) =>
    request(`/favorites/${id}`, { method: 'DELETE' })
};