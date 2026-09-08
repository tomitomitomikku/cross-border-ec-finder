const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const db = require('./db');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'kari-no-himitsu-kagi', // ■要変更: 本番では推測されにくい文字列にする
  resave: false,
  saveUninitialized: false
}));
app.use(express.static('public'));

// ---- FR-04: URL生成機能(既存) ----
function generateAuctionUrls(keyword) {
  const encodedKeyword = encodeURIComponent(keyword);
  return {
    yahooAuction: `https://auctions.yahoo.co.jp/search/search?p=${encodedKeyword}`,
    ebaySold: `https://www.ebay.com/sch/i.html?_nkw=${encodedKeyword}&LH_Sold=1&LH_Complete=1`,
    mercari: `https://jp.mercari.com/search?keyword=${encodedKeyword}`,
    amazon: `https://www.amazon.co.jp/s?k=${encodedKeyword}`,
    rakuten: `https://search.rakuten.co.jp/search/mall/${encodedKeyword}/`
  };
}

// 検索API(URLを返すだけ)
app.get('/api/search', (req, res) => {
  const keyword = req.query.keyword;
  if (!keyword) {
    return res.status(400).json({ error: 'keywordが必要です' });
  }
  res.json(generateAuctionUrls(keyword));
});

// ---- FR-09: 会員登録 ----
app.post('/api/signup', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'メールアドレスとパスワードが必要です' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const stmt = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)');
    stmt.run(email, passwordHash);
    res.json({ message: '登録に成功しました' });
  } catch (err) {
    res.status(400).json({ error: 'すでに登録されているメールアドレスです' });
  }
});

// ---- FR-09: ログイン ----
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  if (!user) {
    return res.status(401).json({ error: 'メールアドレスまたはパスワードが違います' });
  }

  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    return res.status(401).json({ error: 'メールアドレスまたはパスワードが違います' });
  }

  req.session.userId = user.id;
  res.json({ message: 'ログインしました' });
});

// ---- FR-09: ログアウト ----
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ message: 'ログアウトしました' });
});

// ---- FR-10: お気に入り登録(要ログイン) ----
app.post('/api/favorites', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'ログインが必要です' });
  }

  const { keyword, url, siteName } = req.body;
  const stmt = db.prepare('INSERT INTO favorites (user_id, keyword, url, site_name) VALUES (?, ?, ?, ?)');
  stmt.run(req.session.userId, keyword, url, siteName);
  res.json({ message: 'お気に入りに追加しました' });
});

// ---- FR-10: お気に入り一覧取得 ----
app.get('/api/favorites', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'ログインが必要です' });
  }

  const favorites = db.prepare('SELECT * FROM favorites WHERE user_id = ?').all(req.session.userId);
  res.json(favorites);
});

// ---- ログイン状態の確認 ----
app.get('/api/me', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: '未ログインです' });
  }
  res.json({ userId: req.session.userId });
});

app.listen(PORT, () => {
  console.log(`サーバー起動: http://localhost:${PORT}`);
});

// ---- ログイン状態の確認 ----
app.get('/api/me', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: '未ログインです' });
  }
  res.json({ userId: req.session.userId });
});