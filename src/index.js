require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const db = require('./db');
const Anthropic = require('@anthropic-ai/sdk');
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

// ---- FR-04: URL生成機能 ----
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

// ---- FR-04: 検索API(URLを返すだけ) ----
app.get('/api/search', (req, res) => {
  const keyword = req.query.keyword;
  if (!keyword) {
    return res.status(400).json({ error: 'keywordが必要です' });
  }
  res.json(generateAuctionUrls(keyword));
});

// ---- FR-06: 為替換算の目安表示 ----
app.get('/api/exchange-rate', async (req, res) => {
  try {
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    const data = await response.json();
    res.json({ usdToJpy: data.rates.JPY });
  } catch (err) {
    res.status(500).json({ error: '為替レートの取得に失敗しました' });
  }
});

// ---- FR-02 + FR-03 + FR-08: 意図判定・Web検索・信頼性簡易判定を統合 ----
app.post('/api/smart-search', async (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'textが必要です' });
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{
        role: 'user',
        content: `ユーザーが次の商品を探しています: 「${text}」

この商品を購入できる、実在するECサイトをWeb検索で調べてください。
見つかった各サイトについて、以下を判定してください:
- 商品ブランドの公式サイト・公式オンラインストアは無条件で "trusted"
- 大手・広く知られたECサイト(Amazon, 楽天, eBay, Etsyなど)も "trusted"
- 実在するが小規模・聞き馴染みのないサイトなら "unknown"
- ドメインが不自然、詐欺的な特徴が見られるサイトなら "risky"

最後に、必ず以下のJSON形式のみで回答してください(他の文章は含めない):

{
  "keyword": "検索に使ったキーワード",
  "intent": "current または auction または unknown",
  "results": [
    {"title": "商品名", "url": "URL", "snippet": "簡単な説明(自分の言葉で)", "trust": "trusted または unknown または risky"}
  ]
}`
      }]
    });

    const textBlock = message.content.find(block => block.type === 'text');
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    const result = JSON.parse(jsonMatch[0]);

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '検索に失敗しました' });
  }
});

// ---- 新機能: 相場チェック(正式商品名限定、商品概要付き) ----
app.post('/api/market-price', async (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'textが必要です' });
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{
        role: 'user',
        content: `ユーザーが次のように入力しました: 「${text}」

まず、これが特定の商品を指す「正式な商品名」として十分具体的かどうか判定してください。
- 「クレヨンしんちゃん」のような作品名・カテゴリ名・ブランド名だけの入力は不十分です
- 「クレヨンしんちゃん フィギュア 2020年 限定版」のように、種類・年代・型番などが分かる具体的な商品名なら十分です

十分具体的な場合は、Web検索で以下を調べてください。
1. 商品概要:発売時期、発売元・メーカー、簡単な商品説明(自分の言葉で2〜3文程度)
2. 現在の実際の取引相場:定価・発売時の価格ではなく、フリマ・オークション・中古市場での直近の取引実績や出品価格を優先する。生産終了品・入手困難品・コレクター需要の高い商品はプレミア価格(定価より高騰した価格)がついている場合があるため、そうした実勢価格を反映する。逆に、大量生産品や需要の落ち着いた商品は、定価より安い相場になっている場合もある

重要: 価格帯は「一般的な状態(並品〜美品程度)」での相場に絞ってください。鑑定機関によるトップグレード品(例: PSA10等)や、極端に状態の良い/悪い個体による外れ値は除外し、実用的な範囲(価格帯の上限が下限の10倍を大きく超えないことを目安)に収めてください。もし対象商品に極端な高額取引事例(鑑定品等)が存在する場合は、価格帯には含めず "note" にその旨を補足するだけに留めてください

必ず以下のJSON形式のみで回答してください(他の文章は含めない):

十分具体的な場合:
{
  "sufficient": true,
  "releaseDate": "発売時期(分かる範囲で、例: 2020年3月)",
  "manufacturer": "発売元・メーカー",
  "description": "商品概要(2〜3文程度)",
  "priceRangeLow": 数値,
  "priceRangeHigh": 数値,
  "note": "価格帯の根拠を一言(自分の言葉で。プレミア価格や鑑定品の高額事例がある場合はその旨も触れる)"
}

不十分な場合:
{"sufficient": false, "message": "キーワード不足、正式な商品名を入力してください"}`
      }]
    });

    const textBlock = message.content.find(block => block.type === 'text');
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    const result = JSON.parse(jsonMatch[0]);

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '相場の取得に失敗しました' });
  }
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

  try {
    const stmt = db.prepare('INSERT INTO favorites (user_id, keyword, url, site_name) VALUES (?, ?, ?, ?)');
    stmt.run(req.session.userId, keyword, url, siteName);
    res.json({ message: 'お気に入りに追加しました' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'すでにお気に入り登録済みです' });
    }
    res.status(500).json({ error: '登録に失敗しました' });
  }
});

// ---- FR-10: お気に入り一覧取得 ----
app.get('/api/favorites', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'ログインが必要です' });
  }

  const favorites = db.prepare('SELECT * FROM favorites WHERE user_id = ?').all(req.session.userId);
  res.json(favorites);
});

// ---- FR-10: お気に入り削除 ----
app.delete('/api/favorites/:id', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'ログインが必要です' });
  }

  const stmt = db.prepare('DELETE FROM favorites WHERE id = ? AND user_id = ?');
  stmt.run(req.params.id, req.session.userId);
  res.json({ message: '削除しました' });
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