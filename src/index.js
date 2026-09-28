require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const db = require('./db');
const Anthropic = require('@anthropic-ai/sdk');

// ==========================================================
// 設定(.env で切り替えられます。どれも省略できます)
// ==========================================================
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';
const DEV_MOCK = process.env.DEV_MOCK === '1';
const cacheMinutesSetting = Number(process.env.CACHE_MINUTES ?? 60);
const CACHE_MINUTES = Number.isFinite(cacheMinutesSetting) ? cacheMinutesSetting : 60;
const WEB_SEARCH_MAX_USES = Number(process.env.WEB_SEARCH_MAX_USES) || 3;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 180 * 1000
});

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

// ---- 検索範囲(domestic=国内 / global=国内外 / overseas=国外) ----
const ALLOWED_SCOPES = ['domestic', 'global', 'overseas'];
function normalizeScope(value) {
  return ALLOWED_SCOPES.includes(value) ? value : 'global';
}

// ==========================================================
// 結果のキャッシュ(同じ検索語の結果を一定時間使い回して、API利用料を抑える)
// ==========================================================
const responseCache = new Map();
const CACHE_LIMIT = 200;

function makeCacheKey(kind, text, scope = '') {
  return `${kind}|${scope}|${String(text).trim().toLowerCase()}`;
}

function cacheGet(key) {
  if (CACHE_MINUTES <= 0) return null;
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.savedAt > CACHE_MINUTES * 60 * 1000) {
    responseCache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key, value) {
  if (CACHE_MINUTES <= 0) return;
  if (responseCache.size >= CACHE_LIMIT) {
    responseCache.delete(responseCache.keys().next().value);
  }
  responseCache.set(key, { savedAt: Date.now(), value });
}

// ==========================================================
// 開発用ダミーモード(DEV_MOCK=1 のとき、APIを呼ばずにダミーの結果を返す)
// ==========================================================
function buildMockSmartSearch(text, scope) {
  const intent = /相場|いくら|落札|売れ|値段/.test(text) ? 'auction' : 'current';

  let results = [
    {
      title: '【ダミー】公式オンラインストア(国内)',
      url: 'https://example.com/dummy/official',
      snippet: 'これは画面確認用のダミーデータです。',
      trust: 'trusted',
      trustReason: 'ダミーデータ:ブランド公式サイトの想定です。',
      trustEvidence: [],
      region: 'domestic'
    },
    {
      title: '【ダミー】大手通販サイト(国内)',
      url: 'https://example.com/dummy/mall',
      snippet: 'これは画面確認用のダミーデータです。',
      trust: 'trusted',
      trustReason: 'ダミーデータ:広く知られた大手サイトの想定です。',
      trustEvidence: [],
      region: 'domestic'
    },
    {
      title: '【ダミー】小規模ショップ(国内)',
      url: 'https://example.com/dummy/small-shop',
      snippet: 'これは画面確認用のダミーデータです。',
      trust: 'unknown',
      trustReason: 'ダミーデータ:運営者情報が少ない想定です。',
      trustEvidence: [],
      region: 'domestic'
    },
    {
      title: '【ダミー】海外の大手マーケット',
      url: 'https://example.com/dummy/global-market',
      snippet: 'これは画面確認用のダミーデータです。',
      trust: 'trusted',
      trustReason: 'ダミーデータ:海外の大手サイトの想定です。',
      trustEvidence: [],
      region: 'overseas'
    },
    {
      title: '【ダミー】海外の個人ショップ',
      url: 'https://example.com/dummy/overseas-shop',
      snippet: 'これは画面確認用のダミーデータです。',
      trust: 'unknown',
      trustReason: 'ダミーデータ:情報が少ない海外サイトの想定です。',
      trustEvidence: [],
      region: 'overseas'
    },
    {
      title: '【ダミー】極端に安いと表示するサイト',
      url: 'https://example.com/dummy/too-cheap',
      snippet: 'これは画面確認用のダミーデータです。',
      trust: 'risky',
      trustReason: 'ダミーデータ:相場より極端に安い価格の想定です。',
      trustEvidence: ['ドメイン(dummy.example)の登録から30日と新しい(ダミー)'],
      trustAdjusted: true,
      region: 'overseas'
    }
  ];

  if (scope === 'overseas') {
    results = results.filter(r => r.region !== 'domestic');
  } else if (scope === 'domestic') {
    results = results.filter(r => r.region !== 'overseas');
  }

  return { keyword: text, intent, results, mock: true };
}

function buildMockMarketPrice(text) {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) {
    return { sufficient: false, message: 'キーワード不足、正式な商品名を入力してください', mock: true };
  }
  return {
    sufficient: true,
    releaseDate: '2020年3月(ダミー)',
    manufacturer: 'ダミー株式会社',
    description: 'これは画面確認用のダミーデータです。実際の商品情報や相場ではありません。',
    priceRangeLow: 3000,
    priceRangeHigh: 8000,
    note: 'ダミーデータのため、実際の取引実績にもとづく価格ではありません。',
    mock: true
  };
}

// ---- FR-04: URL生成機能 ----
function generateAuctionUrls(keyword, scope) {
  const encodedKeyword = encodeURIComponent(keyword);
  const ebaySold = `https://www.ebay.com/sch/i.html?_nkw=${encodedKeyword}&LH_Sold=1&LH_Complete=1`;

  if (scope === 'overseas') {
    return { ebaySold };
  }

  if (scope === 'domestic') {
    return {
      yahooAuction: `https://auctions.yahoo.co.jp/search/search?p=${encodedKeyword}`,
      mercari: `https://jp.mercari.com/search?keyword=${encodedKeyword}`,
      amazon: `https://www.amazon.co.jp/s?k=${encodedKeyword}`,
      rakuten: `https://search.rakuten.co.jp/search/mall/${encodedKeyword}/`
    };
  }

  // global(国内外)
  return {
    yahooAuction: `https://auctions.yahoo.co.jp/search/search?p=${encodedKeyword}`,
    ebaySold,
    mercari: `https://jp.mercari.com/search?keyword=${encodedKeyword}`,
    amazon: `https://www.amazon.co.jp/s?k=${encodedKeyword}`,
    rakuten: `https://search.rakuten.co.jp/search/mall/${encodedKeyword}/`
  };
}

// ---- FR-04: 検索API(URLを返すだけ) ----
app.get('/api/search', (req, res) => {
  const keyword = req.query.keyword;
  const scope = normalizeScope(req.query.scope);
  if (!keyword) {
    return res.status(400).json({ error: 'keywordが必要です' });
  }
  res.json(generateAuctionUrls(keyword, scope));
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

// ==========================================================
// FR-08: 客観指標(ドメインの登録日など)による信頼性判定の補正
// ==========================================================
const rdapCache = new Map();
let rdapBootstrap = null; // { 'com': 'https://rdap.verisign.com/com/v1', 'jp': 'https://rdap.jprs.jp', ... }

function getHostname(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch (err) {
    return null;
  }
}

// ドメインの切り出し(簡易版): co.jp のような二段のドメインにも対応
const SECOND_LEVEL_LABELS = new Set(['co', 'com', 'ne', 'or', 'ac', 'go', 'org', 'net', 'gov', 'edu', 'ad', 'ed', 'gr', 'lg']);
function getRegistrableDomain(hostname) {
  const labels = hostname.split('.').filter(Boolean);
  if (labels.length <= 2) return hostname;
  const tld = labels[labels.length - 1];
  const second = labels[labels.length - 2];
  if (tld.length === 2 && SECOND_LEVEL_LABELS.has(second)) {
    return labels.slice(-3).join('.');
  }
  return labels.slice(-2).join('.');
}

// ドメインの種類(.com、.jp など)ごとの、登録情報の問い合わせ先をIANAの公式一覧から取得する
async function loadRdapBootstrap() {
  if (rdapBootstrap) return rdapBootstrap;

  const map = {};
  try {
    const response = await fetch('https://data.iana.org/rdap/dns.json', {
      signal: AbortSignal.timeout(8000)
    });
    if (response.ok) {
      const data = await response.json();
      for (const [tlds, urls] of data.services || []) {
        const base = (urls.find(u => u.startsWith('https://')) || urls[0] || '').replace(/\/+$/, '');
        if (!base) continue;
        for (const tld of tlds) {
          map[tld.toLowerCase()] = base;
        }
      }
    }
  } catch (err) {
    // 取得できない場合は、次回の検索でもう一度試す
  }

  if (Object.keys(map).length > 0) rdapBootstrap = map;
  return map;
}

// 登録元(レジストリ)に直接問い合わせて、ドメインの登録日数を取得する。取得できなければ null
async function fetchDomainAgeDays(domain) {
  if (rdapCache.has(domain)) return rdapCache.get(domain);

  let ageDays = null;
  let reason = '';
  try {
    const tld = domain.split('.').pop();
    const bootstrap = await loadRdapBootstrap();
    const base = bootstrap[tld];

    if (!base) {
      reason = `.${tld} の問い合わせ先が見つかりません`;
    } else {
      const response = await fetch(`${base}/domain/${domain}`, {
        headers: {
          Accept: 'application/rdap+json',
          'User-Agent': 'ItemJournal-Thesis/1.0'
        },
        signal: AbortSignal.timeout(6000)
      });

      if (!response.ok) {
        reason = `HTTP ${response.status}`;
      } else {
        const data = await response.json();
        const registration = (data.events || []).find(e => e.eventAction === 'registration');
        if (registration && registration.eventDate) {
          const registered = new Date(registration.eventDate);
          if (!isNaN(registered.getTime())) {
            ageDays = Math.floor((Date.now() - registered.getTime()) / 86400000);
          } else {
            reason = '登録日の形式が不明';
          }
        } else {
          reason = '登録日の情報がありません';
        }
      }
    }
  } catch (err) {
    reason = `${err.name}: ${err.message}`;
  }

  console.log(`[RDAP] ${domain}: ${ageDays === null ? '取得できませんでした(' + reason + ')' : ageDays + '日'}`);
  if (ageDays !== null) rdapCache.set(domain, ageDays);
  return ageDays;
}

// 詐欺サイトで使われる傾向のあるドメイン種別(単独では判定に使わない、弱い指標)
const SUSPICIOUS_TLDS = new Set(['top', 'xyz', 'click', 'icu', 'cyou', 'buzz', 'cfd', 'sbs', 'vip', 'monster', 'rest']);

async function analyzeDomain(url) {
  const hostname = getHostname(url);
  if (!hostname) return { evidence: [], strong: false, weak: 0, ageDays: null };

  const domain = getRegistrableDomain(hostname);
  const tld = hostname.split('.').pop();
  const evidence = [];
  let strong = false;
  let weak = 0;

  const ageDays = await fetchDomainAgeDays(domain);
  if (ageDays !== null) {
    if (ageDays < 90) {
      evidence.push(`ドメイン(${domain})の登録から${ageDays}日と新しい`);
      strong = true;
    } else if (ageDays < 365) {
      evidence.push(`ドメイン(${domain})の登録から1年未満(${ageDays}日)`);
      weak++;
    }
  }
  if (typeof url === 'string' && url.toLowerCase().startsWith('http://')) {
    evidence.push('暗号化されていない接続(http)');
    weak++;
  }
  if (SUSPICIOUS_TLDS.has(tld)) {
    evidence.push(`詐欺サイトで使われる傾向のあるドメイン種別(.${tld})`);
    weak++;
  }
  if ((hostname.match(/-/g) || []).length >= 3) {
    evidence.push('ドメイン名にハイフンが多い');
    weak++;
  }

  return { evidence, strong, weak, ageDays };
}

// 強い指標が1つ、または弱い指標が2つ以上ある場合は "risky" に引き上げる
async function applyObjectiveIndicators(results) {
  return Promise.all(results.map(async (item) => {
    const info = await analyzeDomain(item && item.url);
    const escalate = info.strong || info.weak >= 2;
    return {
      ...item,
      trust: escalate ? 'risky' : item.trust,
      trustEvidence: info.evidence,
      trustAdjusted: escalate && item.trust !== 'risky'
    };
  }));
}

// ---- FR-02 + FR-03 + FR-08 + FR-13: 意図判定・Web検索・信頼性判定(国内/国内外/国外) ----
app.post('/api/smart-search', async (req, res) => {
  const { text } = req.body;
  const scope = normalizeScope(req.body.scope);
  if (!text) {
    return res.status(400).json({ error: 'textが必要です' });
  }

  // 開発用ダミーモード(APIを呼ばない)
  if (DEV_MOCK) {
    console.log(`[MOCK] smart-search: ${text}`);
    return res.json(buildMockSmartSearch(text, scope));
  }

  // キャッシュ(同じ検索語・同じ範囲の結果を使い回す)
  const cacheKey = makeCacheKey('smart', text, scope);
  const cached = cacheGet(cacheKey);
  if (cached) {
    console.log(`[cache] smart-search: 保存済みの結果を返しました(${text})`);
    return res.json({ ...cached, cached: true });
  }

  let scopeInstruction;
  if (scope === 'domestic') {
    scopeInstruction = `検索範囲は「国内」です。日本国内向けに販売していて、日本語で利用でき、日本国内へ通常配送されるサイトだけを対象にしてください。海外サイトは含めないでください。`;
  } else if (scope === 'overseas') {
    scopeInstruction = `検索範囲は「国外」です。海外のサイトだけを対象にしてください。日本国内向けのサイト(.co.jpのサイト、楽天市場、ヤフオク!、メルカリなど)は含めないでください。海外サイトを探すため、商品名を英語などにも言い換えて検索してください。日本語版・日本向けに転送されやすいURLではなく、そのサイト本来の地域(米国版など)のURLを優先してください。`;
  } else {
    scopeInstruction = `検索範囲は「国内外」です。日本国内のサイトに加えて、海外のサイトも必ず含めてください。海外サイトを探すため、商品名を英語などにも言い換えて検索してください。海外サイトについては、日本語版・日本向けに転送されやすいURLではなく、そのサイト本来の地域(米国版など)のURLを優先してください。`;
  }

  try {
    const message = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 3500,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: WEB_SEARCH_MAX_USES }],
      messages: [{
        role: 'user',
        content: `ユーザーが次の商品を探しています: 「${text}」

${scopeInstruction}

この商品を購入できる、実在するECサイトをWeb検索で調べてください。
- 大手ECサイトや公式サイトだけでなく、小規模なショップ、個人運営のサイト、新興サイト、情報の少ないサイトも含めて、幅広く6〜10件程度を採り上げてください。通常の検索に加えて、「格安」「激安」「通販」「輸入」などの語を組み合わせた検索も行い、大手以外のサイトも拾ってください
- Web検索で実際に見つかったサイトだけを挙げてください。存在しないサイトやURLを作らないでください

見つかった各サイトについて、信頼性を次の基準で判定し、その理由を1文で添えてください:
- 商品ブランドの公式サイト・公式オンラインストア、大手・広く知られたECサイト(Amazon, 楽天, eBay, Etsyなど)は "trusted"
- 実在するが、小規模・聞き馴染みがない・運営者情報が少ないなど、判断材料が乏しいサイトは "unknown"
- 次のような特徴が、検索結果から具体的に確認できたサイトは "risky": 相場より極端に安い価格、会社情報・運営者情報の記載がない、支払い方法が限られる(銀行振込のみなど)、不自然な日本語、有名ブランドやサイトに似せたドメイン、詐欺の報告があるなど
- "risky" は、上記のような具体的な根拠を確認できた場合だけにしてください。根拠が確認できない場合は "unknown" にしてください。理由(trustReason)には、確認できた根拠を書いてください

また、各サイトについて、日本国内向けのサイトなら "domestic"、海外のサイトなら "overseas" を region に入れてください。

最後に、必ず以下のJSON形式のみで回答してください(他の文章は含めない):

{
  "keyword": "検索に使ったキーワード",
  "intent": "current または auction または unknown",
  "results": [
    {"title": "サイト名や商品名", "url": "URL", "snippet": "簡単な説明(自分の言葉で)", "trust": "trusted または unknown または risky", "trustReason": "その判定にした理由(1文)", "region": "domestic または overseas"}
  ]
}`
      }]
    });

    const textBlock = message.content.find(block => block.type === 'text');
    if (!textBlock || !textBlock.text) {
      throw new Error('Claudeからテキスト応答が得られませんでした');
    }
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('JSON抽出失敗。Claudeの生の返答:', textBlock.text);
      throw new Error('JSON形式の応答が見つかりませんでした');
    }
    const result = JSON.parse(jsonMatch[0]);

    // 検索範囲に合わないサイトが混ざっていた場合の安全策(region未指定のものは残す)
    if (Array.isArray(result.results)) {
      if (scope === 'overseas') {
        result.results = result.results.filter(r => r.region !== 'domestic');
      } else if (scope === 'domestic') {
        result.results = result.results.filter(r => r.region !== 'overseas');
      }

      // 客観指標(ドメインの登録日など)による判定の補正
      result.results = await applyObjectiveIndicators(result.results);
    }

    cacheSet(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '検索に失敗しました' });
  }
});

// ---- FR-12: 相場チェック(正式商品名限定、商品概要付き) ----
app.post('/api/market-price', async (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'textが必要です' });
  }

  // 開発用ダミーモード(APIを呼ばない)
  if (DEV_MOCK) {
    console.log(`[MOCK] market-price: ${text}`);
    return res.json(buildMockMarketPrice(text));
  }

  // キャッシュ(同じ商品名の結果を使い回す。相場のブレも抑えられる)
  const cacheKey = makeCacheKey('market', text);
  const cached = cacheGet(cacheKey);
  if (cached) {
    console.log(`[cache] market-price: 保存済みの結果を返しました(${text})`);
    return res.json({ ...cached, cached: true });
  }

  try {
    const message = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2000,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: WEB_SEARCH_MAX_USES }],
      messages: [{
        role: 'user',
        content: `ユーザーが次のように入力しました: 「${text}」

まず、これが特定の商品を指す「正式な商品名」として十分具体的かどうか判定してください。
- 「クレヨンしんちゃん」のような作品名・カテゴリ名・ブランド名だけの入力は不十分です
- 「クレヨンしんちゃん フィギュア 2020年 限定版」のように、種類・年代・型番などが分かる具体的な商品名なら十分です

十分具体的な場合は、Web検索で以下を調べてください。
1. 商品概要:発売時期、発売元・メーカー、簡単な商品説明(自分の言葉で2〜3文程度)
2. 現在の実際の取引相場:定価・発売時の価格ではなく、フリマ・オークション・中古市場での直近の取引実績や出品価格を優先する。生産終了品・入手困難品・コレクター需要の高い商品はプレミア価格(定価より高騰した価格)がついている場合があるため、そうした実勢価格を反映する。逆に、大量生産品や需要の落ち着いた商品は、定価より安い相場になっている場合もある

重要(価格帯の範囲について): 価格帯は「一般的な状態(並品〜美品程度)」での相場に絞ってください。鑑定機関によるトップグレード品(例: PSA10等)や、極端に状態の良い/悪い個体による外れ値は除外し、実用的な範囲(価格帯の上限が下限の10倍を大きく超えないことを目安)に収めてください。もし対象商品に極端な高額取引事例(鑑定品等)が存在する場合は、価格帯には含めず "note" にその旨を補足するだけに留めてください

重要(通貨について): 海外の商品で現地通貨(ドル、ユーロ等)の相場情報しか見つからない場合は、必ず現在のおおよその為替レートで日本円に換算した金額を priceRangeLow / priceRangeHigh に入れてください。現地通貨の数値をそのまま円の数値として使うことは絶対にしないでください(例: 150ドルは約22,500円であり、150円ではありません)。円換算した場合はその旨を note に明記してください

必ず以下のJSON形式のみで回答してください(他の文章は含めない、説明や前置きも書かない):

十分具体的な場合:
{
  "sufficient": true,
  "releaseDate": "発売時期(分かる範囲で、例: 2020年3月)",
  "manufacturer": "発売元・メーカー",
  "description": "商品概要(2〜3文程度)",
  "priceRangeLow": 数値,
  "priceRangeHigh": 数値,
  "note": "価格帯の根拠を一言(自分の言葉で。プレミア価格や鑑定品の高額事例、円換算した場合はその旨も触れる)"
}

不十分な場合:
{"sufficient": false, "message": "キーワード不足、正式な商品名を入力してください"}`
      }]
    });

    const textBlock = message.content.find(block => block.type === 'text');
    if (!textBlock || !textBlock.text) {
      throw new Error('Claudeからテキスト応答が得られませんでした');
    }
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('JSON抽出失敗。Claudeの生の返答:', textBlock.text);
      throw new Error('JSON形式の応答が見つかりませんでした');
    }
    const result = JSON.parse(jsonMatch[0]);

    cacheSet(cacheKey, result);
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
  console.log(`設定: モデル=${CLAUDE_MODEL} / ダミーモード=${DEV_MOCK ? 'ON(APIを呼びません)' : 'OFF'} / キャッシュ=${CACHE_MINUTES}分 / Web検索の上限=${WEB_SEARCH_MAX_USES}回`);
});