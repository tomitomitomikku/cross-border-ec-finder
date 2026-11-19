# Cross-Border EC Finder 詳細設計書

- **文書番号**: CED-DDS-001
- **版**: 1.1
- **作成日**: 2026-11-19
- **ステータス**: 完成版（v1.1）
- **上位の文書**: 仕様書 (spec.md)、基本設計書 (design.md)
- **リポジトリ**: `tomitomitomikku/cross-border-ec-finder`

本書は、「Cross-Border EC Finder（Item Journal）」プロジェクトにおける主要なソースコードおよび環境設定を網羅し、開発・実装・保守を円滑に行うための詳細設計を定めたものである。

---

## 1. システム構成・全体アーキテクチャ

### 1.1 概要
本システムは、国内外の商品を横断的に検索・相場調査・レコメンドするクロスボーダーEC支援サービスである。Webブラウザ（Vercel）およびGoogle Chrome拡張機能（Popup）の双方に対応するデュアルターゲット設計を採用している。

### 1.2 技術スタック
- **フロントエンド**: React 19, TypeScript, Vite, React Router
- **ホスティング・デプロイ**: Vercel（パブリックアクセスのため `Deployment Protection` 無効化済み）
- **バックエンド**: 外部APIサーバー（ローカル開発時は `http://localhost:3000/api`、または `/api` プロキシ経由で連携）
- **バージョン管理**: Git / GitHub (`tomitomitomikku/cross-border-ec-finder`)

---

## 2. ディレクトリ構造とリポジトリ構成

```text
cross-border-ec-finder/
├── docs/                   # 各種ドキュメント・仕様書
├── extension/              # Chrome拡張機能向け出力先
├── frontend/
│   ├── public/             # 静的アセット・マニフェスト
│   ├── src/
│   │   ├── assets/         # 画像・スタイル等
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx # メイン検索・相場画面
│   │   │   ├── Help.tsx      # ヘルプ画面
│   │   │   ├── Login.tsx     # ログイン・新規登録画面
│   │   │   └── MyPage.tsx    # マイページ画面
│   │   ├── App.tsx         # ルーティング・画面遷移定義
│   │   ├── api.js          # API通信クライアント
│   │   └── main.tsx / jsx  # エントリーポイント
│   ├── popup.html
│   ├── popup.ts
│   ├── vite.config.js / ts
│   └── package.json
└── src/                    # バックエンド・共通モジュール
```

---

## 3. ビルド・環境切替設計 (`frontend/vite.config.js`)

### 3.1 概要
`process.env.VERCEL` を判定し、Vercel環境（`dist/`・`index.html`）とローカル／Chrome拡張機能ビルド（`../extension/`・`popup.html`）を動的に切り替える。開発サーバーでは `/api` を `http://localhost:3000` へプロキシする。

### 3.2 実装コード
```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  const isVercel = process.env.VERCEL;

  return {
    plugins: [react()],
    resolve: {
      alias: {
        react: resolve(import.meta.dirname, 'node_modules/react'),
        'react-dom': resolve(import.meta.dirname, 'node_modules/react-dom'),
      },
    },
    server: {
      proxy: {
        '/api': 'http://localhost:3000'
      }
    },
    build: {
      outDir: isVercel ? 'dist' : resolve(import.meta.dirname, '../extension'),
      emptyOutDir: true,
      rollupOptions: {
        input: {
          // Vercelの場合はindex.htmlを、それ以外はpopup.htmlをメインにするなどの切り分け
          main: resolve(import.meta.dirname, isVercel ? 'index.html' : 'popup.html'),
        },
        output: {
          entryFileNames: 'assets/[name].js',
          chunkFileNames: 'assets/[name].js',
          assetFileNames: 'assets/[name].[ext]'
        }
      }
    }
  }
})
```

---

## 4. API通信クライアント設計 (`frontend/src/api.js`)

### 4.1 概要
ベースURL（`http://localhost:3000/api`）に対する共通リクエスト関数 `request` を提供し、JSONヘッダ付与および非2xxレスポンス時のエラーオブジェクト（`status`, `data`）生成を一元化する。

### 4.2 エンドポイント一覧
| メソッド / キー | HTTPメソッド | パス | 用途 |
| :--- | :--- | :--- | :--- |
| `signup` / `register` | POST | `/signup` | 新規ユーザー登録 |
| `login` | POST | `/login` | ログイン認証 |
| `logout` | POST | `/logout` | ログアウト |
| `me` | GET | `/me` | ログイン中ユーザー情報取得 |
| `smartSearch` | POST | `/smart-search` | スマート検索（`text`, `scope`） |
| `auctionUrls` | GET | `/search` | 過去相場・オークション検索URL取得（`keyword`, `scope`） |
| `marketPrice` | POST | `/market-price` | 相場調査（`text`） |
| `exchangeRate` | GET | `/exchange-rate` | 為替レート取得 |
| `addFavorite` | POST | `/favorites` | お気に入り追加（`keyword`, `url`, `siteName`） |
| `listFavorites` | GET | `/favorites` | お気に入り一覧取得 |
| `deleteFavorite` | DELETE | `/favorites/:id` | お気に入り削除 |

### 4.3 実装コード
```javascript
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
```

---

## 5. ルーティング設計 (`frontend/src/App.tsx`)

### 5.1 概要
拡張機能やデモ環境でもブラウザURLに依存せず画面遷移できるよう `MemoryRouter` を使用し、`/login`、`/mypage`、`/help`、`/dashboard`、`/` のルートを定義する。

### 5.2 実装コード
```tsx
import React, { useState } from 'react';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import MyPage from './pages/MyPage';
import Help from './pages/Help';

export default function App() {
  // 常にログイン済みとして扱う（拡張機能やデモ用）
  const [isAuthenticated] = useState<boolean>(true);

  return (
    <MemoryRouter>
      <Routes>
        {/* ログイン画面 */}
        <Route path="/login" element={<Login />} />
        
        {/* マイページ */}
        <Route 
          path="/mypage" 
          element={isAuthenticated ? <MyPage /> : <Navigate to="/login" replace />} 
        />
        
        {/* ヘルプ */}
        <Route path="/help" element={<Help />} />
        
        {/* ダッシュボード */}
        <Route 
          path="/dashboard" 
          element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/" 
          element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" replace />} 
        />
      </Routes>
    </MemoryRouter>
  );
}
```

---

## 6. 画面詳細設計

### 6.1 ログイン・新規登録画面 (`frontend/src/pages/Login.tsx`)
- **機能概要**: ログインモードと新規登録モードを切り替え、メールアドレス・パスワードを送信する。`credentials: 'include'` によりセッションクッキーを保持し、ログイン成功時は `/dashboard` へ遷移する。新規登録成功時はログインモードへ戻し完了メッセージを表示する。

```tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const navigate = useNavigate();
  const [isLoginMode, setIsLoginMode] = useState<boolean>(true);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [message, setMessage] = useState<{ text: string; color: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const endpoint = isLoginMode ? '/api/login' : '/api/signup';

    try {
      const res = await fetch(`http://localhost:3000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include' // セッションクッキーを確実に保持
      });
      const data = await res.json();

      if (res.ok) {
        if (isLoginMode) {
          navigate('/dashboard');
        } else {
          setMessage({ text: '登録できました。ログインしてください。', color: 'green' });
          setIsLoginMode(true);
        }
      } else {
        setMessage({ text: data.error || 'エラーが発生しました', color: '#B23A2E' });
      }
    } catch (err) {
      setMessage({ text: '通信エラーが発生しました。', color: '#B23A2E' });
    }
  };

  return (
    <div style={{ width: '320px', margin: '20px auto', padding: '20px', fontFamily: 'sans-serif', background: '#F7F3E9', color: '#1B1B1B', borderRadius: '8px', border: '1px solid #1B2A4A', boxSizing: 'border-box' }}>
      <h1 style={{ fontSize: '1.4em', color: '#1B2A4A', textAlign: 'center', marginBottom: '20px' }}>Item Journal</h1>

      <form onSubmit={handleSubmit} style={{ background: '#fff', padding: '16px', borderRadius: '6px', border: '1px solid #ddd' }}>
        <h2 style={{ fontSize: '1.1em', color: '#1B2A4A', marginTop: 0, marginBottom: '15px' }}>
          {isLoginMode ? 'ログイン' : '新規登録'}
        </h2>

        <input 
          type="email" 
          placeholder="メールアドレス" 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ width: '100%', padding: '8px', marginBottom: '10px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px' }}
        />
        <input 
          type="password" 
          placeholder="パスワード" 
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ width: '100%', padding: '8px', marginBottom: '15px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px' }}
        />
        <button 
          type="submit"
          style={{ width: '100%', padding: '10px', background: '#1B2A4A', color: '#F7F3E9', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {isLoginMode ? 'ログイン' : '登録する'}
        </button>

        {message && (
          <div style={{ marginTop: '10px', fontSize: '0.85em', color: message.color }}>
            {message.text}
          </div>
        )}

        <div style={{ marginTop: '15px', fontSize: '0.85em', textAlign: 'center', color: '#706a5a' }}>
          {isLoginMode ? (
            <span>
              アカウントをお持ちでない方は{' '}
              <button 
                type="button"
                onClick={() => { setIsLoginMode(false); setMessage(null); }}
                style={{ background: 'none', border: 'none', color: '#1B2A4A', cursor: 'pointer', textDecoration: 'underline', padding: 0, font: 'inherit' }}
              >
                新規登録
              </button>
            </span>
          ) : (
            <span>
              すでにアカウントをお持ちの方は{' '}
              <button 
                type="button"
                onClick={() => { setIsLoginMode(true); setMessage(null); }}
                style={{ background: 'none', border: 'none', color: '#1B2A4A', cursor: 'pointer', textDecoration: 'underline', padding: 0, font: 'inherit' }}
              >
                ログイン
              </button>
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
```

### 6.2 ダッシュボード画面 (`frontend/src/pages/Dashboard.tsx`)
- **機能概要**:
  - 初期マウント時に `/api/exchange-rate` からUSD/JPY参考レートを取得・表示。
  - キーワード検索時に `/api/smart-search`（意図判定・候補リスト）と `/api/search`（過去相場・オークションURL）を呼び出し、判定意図（`current` / `auction` / `unknown`）に応じて初期タブ（`panelCurrent` / `panelAuction`）を自動選択。
  - 「相場」ボタン押下で `/api/market-price` を呼び出し、発売時期・発売元・価格帯・備考を表示。
  - 地域フィルタ（`all`: 国内外 / `domestic`: 国内 / `overseas`: 国外）および信頼性ラベル（`trusted` / `unknown` / `risky`）による警告表示・リンク遷移確認を実装。
  - `/api/favorites` によるお気に入り登録（HTTP `409` 重複時も登録済み扱いとしてUI反映）およびログアウト（`/api/logout`）に対応。

```tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// --- 型定義 ---
interface SmartItem {
  url: string;
  title: string;
  trust: 'trusted' | 'unknown' | 'risky';
  trustReason?: string;
  trustEvidence?: string[];
  trustAdjusted?: boolean;
  snippet: string;
  region?: 'domestic' | 'overseas';
}

interface MarketPriceResult {
  sufficient: boolean;
  message?: string;
  error?: string;
  releaseDate?: string;
  manufacturer?: string;
  description?: string;
  priceRangeLow?: number;
  priceRangeHigh?: number;
  note?: string;
}

const siteNames: Record<string, string> = {
  yahooAuction: "ヤフオク!",
  ebaySold: "eBay(過去の落札)",
  mercari: "メルカリ",
  amazon: "Amazon",
  rakuten: "楽天市場",
  etsy: "Etsy",
  aliexpress: "AliExpress"
};

const OVERSEAS_SITE_KEYS = ['ebaySold', 'etsy', 'aliexpress'];

const trustLabels: Record<string, string> = {
  trusted: "信頼できるサイト",
  unknown: "情報の少ないサイト",
  risky: "⚠️信頼性の低いサイトの可能性があります"
};

const intentLabels: Record<string, string> = {
  current: "「今すぐ買いたい」の意図と判定し、現行販売タブを表示しています",
  auction: "「相場を知りたい」の意図と判定し、過去の相場タブを表示しています",
  unknown: "意図が明確でないため、現行販売タブを表示しています(過去の相場も確認できます)"
};

export default function Dashboard() {
  const navigate = useNavigate();

  const [keyword, setKeyword] = useState<string>('');
  const [exchangeRate, setExchangeRate] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  
  const [smartItems, setSmartItems] = useState<SmartItem[]>([]);
  const [smartError, setSmartError] = useState<boolean>(false);
  const [auctionUrls, setAuctionUrls] = useState<Record<string, string>>({});
  const [intent, setIntent] = useState<string>('unknown');
  
  const [regionFilter, setRegionFilter] = useState<'all' | 'domestic' | 'overseas'>('all');
  const [activeTab, setActiveTab] = useState<'panelCurrent' | 'panelAuction'>('panelCurrent');
  
  const [marketResult, setMarketResult] = useState<MarketPriceResult | null>(null);
  const [marketLoading, setMarketLoading] = useState<boolean>(false);
  
  const [favoritedUrls, setFavoritedUrls] = useState<Set<string>>(new Set());
  const [hasSearched, setHasSearched] = useState<boolean>(false);

  useEffect(() => {
    async function fetchRate() {
      try {
        const res = await fetch('http://localhost:3000/api/exchange-rate');
        const data = await res.json();
        if (data && data.usdToJpy) {
          setExchangeRate(data.usdToJpy.toFixed(2));
        }
      } catch (err) {
        console.error("為替レートの取得に失敗しました", err);
      }
    }
    fetchRate();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('http://localhost:3000/api/logout', {
        method: 'POST',
        credentials: 'include'
      });
      navigate('/login');
    } catch (err) {
      console.error('ログアウトエラー:', err);
      navigate('/login');
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim()) return;

    setLoading(true);
    setHasSearched(true);
    setSmartItems([]);
    setSmartError(false);
    setAuctionUrls({});
    setMarketResult(null);

    let detectedIntent = 'unknown';
    let items: SmartItem[] = [];
    let auctions: Record<string, string> = {};

    try {
      const smartRes = await fetch('http://localhost:3000/api/smart-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: keyword, scope: 'global' }),
        credentials: 'include'
      });
      const smartData = await smartRes.json();
      if (smartRes.ok && Array.isArray(smartData.results)) {
        detectedIntent = smartData.intent || 'unknown';
        items = smartData.results;
      } else {
        setSmartError(true);
      }
    } catch (err) {
      setSmartError(true);
    }

    try {
      const res = await fetch(`http://localhost:3000/api/search?keyword=${encodeURIComponent(keyword)}&scope=global`, {
        credentials: 'include'
      });
      auctions = await res.json();
    } catch (err) {
      auctions = {};
    }

    setIntent(detectedIntent);
    setSmartItems(items);
    setAuctionUrls(auctions);
    setLoading(false);

    setActiveTab(detectedIntent === 'auction' ? 'panelAuction' : 'panelCurrent');
  };

  const handleMarketCheck = async () => {
    if (!keyword.trim()) return;
    setMarketLoading(true);
    setMarketResult(null);

    try {
      const res = await fetch('http://localhost:3000/api/market-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: keyword }),
        credentials: 'include'
      });
      const data = await res.json();
      setMarketResult(data);
    } catch (err) {
      setMarketResult({ sufficient: false, error: '相場の取得に失敗しました。' });
    }
    setMarketLoading(false);
  };

  const handleFavorite = async (url: string, siteName: string) => {
    try {
      const res = await fetch('http://localhost:3000/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, url, siteName }),
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok || res.status === 409) {
        setFavoritedUrls(prev => new Set(prev).add(url));
        if (res.ok) {
          alert('お気に入りに登録されました！');
        }
      } else {
        alert(data.error || 'お気に入り登録に失敗しました');
      }
    } catch (err) {
      alert('通信エラーが発生しました');
    }
  };

  const matchesFilter = (isOverseas: boolean) => {
    if (regionFilter === 'all') return true;
    return regionFilter === 'overseas' ? isOverseas : !isOverseas;
  };

  const visibleSmartItems = smartItems.filter(item => matchesFilter(item.region === 'overseas'));
  const overseasShown = visibleSmartItems.some(item => item.region === 'overseas');
  const auctionKeys = Object.keys(auctionUrls).filter(key => matchesFilter(OVERSEAS_SITE_KEYS.includes(key)));

  return (
    <div style={{ maxWidth: '900px', margin: '30px auto', padding: '20px', fontFamily: "'Noto Sans JP', sans-serif" }}>
      <nav style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px', marginBottom: '20px', borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>
        <button onClick={() => navigate('/mypage')} style={{ background: 'none', border: 'none', color: '#0066cc', cursor: 'pointer' }}>マイページ</button>
        <button onClick={() => navigate('/help')} style={{ background: 'none', border: 'none', color: '#0066cc', cursor: 'pointer' }}>ヘルプ</button>
        <button onClick={handleLogout} style={{ background: '#f44336', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>ログアウト</button>
      </nav>

      <h1>商品を探す</h1>
      {exchangeRate && (
        <div style={{ fontSize: '0.85em', color: '#706a5a', marginBottom: '16px' }}>
          参考為替レート: 1ドル ≒ {exchangeRate}円 (送料・関税別)
        </div>
      )}

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="例: ナイキの限定スニーカーが欲しい"
          style={{ flex: '1', minWidth: '250px', padding: '10px', fontSize: '1em', border: '1px solid #ccc', borderRadius: '4px' }}
        />
        <button type="submit" style={{ padding: '10px 20px', background: '#333', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>検索</button>
        <button type="button" onClick={handleMarketCheck} disabled={marketLoading} style={{ padding: '10px 20px', background: '#b23a2e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          {marketLoading ? '調査中…' : '相場'}
        </button>
        <button type="button" onClick={() => { setKeyword(''); setHasSearched(false); setMarketResult(null); }} style={{ padding: '10px 20px', background: 'none', border: '1px solid #333', borderRadius: '4px', cursor: 'pointer' }}>リセット</button>
      </form>

      {marketResult && (
        <div style={{ border: '2px solid #333', background: '#fff', padding: '18px', marginBottom: '20px', borderRadius: '4px' }}>
          {!marketResult.sufficient ? (
            <div style={{ color: '#b23a2e' }}>{marketResult.message || marketResult.error}</div>
          ) : (
            <div>
              <div style={{ fontSize: '0.85em', color: '#706a5a', marginBottom: '4px' }}>
                発売時期: {marketResult.releaseDate || '不明'} / 発売元: {marketResult.manufacturer || '不明'}
              </div>
              <div style={{ marginBottom: '8px' }}>{marketResult.description || ''}</div>
              <div style={{ fontSize: '1.4em', color: '#b23a2e', fontWeight: 'bold', margin: '8px 0' }}>
                {marketResult.priceRangeLow?.toLocaleString()}円 〜 {marketResult.priceRangeHigh?.toLocaleString()}円
              </div>
              <div style={{ fontSize: '0.85em', color: '#706a5a' }}>{marketResult.note || ''}</div>
            </div>
          )}
        </div>
      )}

      {loading && <div style={{ color: '#706a5a', margin: '12px 0' }}>検索中です、少々お待ちください…</div>}

      {hasSearched && !loading && (
        <div>
          <p style={{ fontSize: '0.8em', color: '#706a5a', margin: '8px 0' }}>
            {intentLabels[intent] || intentLabels.unknown}
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '16px 0' }}>
            <span style={{ fontSize: '0.85em', color: '#706a5a' }}>表示するサイト:</span>
            <div style={{ display: 'inline-flex', border: '1px solid #333', borderRadius: '4px', overflow: 'hidden' }}>
              {(['all', 'domestic', 'overseas'] as const).map((scope) => (
                <button
                  key={scope}
                  type="button"
                  onClick={() => setRegionFilter(scope)}
                  style={{
                    padding: '6px 18px',
                    background: regionFilter === scope ? '#333' : 'transparent',
                    color: regionFilter === scope ? '#fff' : '#333',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {scope === 'all' ? '国内外' : scope === 'domestic' ? '国内' : '国外'}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', borderBottom: '2px solid #333', marginTop: '20px' }}>
            <button
              onClick={() => setActiveTab('panelCurrent')}
              style={{ padding: '10px 20px', background: 'none', border: 'none', borderBottom: activeTab === 'panelCurrent' ? '3px solid #b23a2e' : '3px solid transparent', fontWeight: activeTab === 'panelCurrent' ? 'bold' : 'normal', cursor: 'pointer' }}
            >
              現行販売
            </button>
            <button
              onClick={() => setActiveTab('panelAuction')}
              style={{ padding: '10px 20px', background: 'none', border: 'none', borderBottom: activeTab === 'panelAuction' ? '3px solid #b23a2e' : '3px solid transparent', fontWeight: activeTab === 'panelAuction' ? 'bold' : 'normal', cursor: 'pointer' }}
            >
              過去の相場
            </button>
          </div>

          {activeTab === 'panelCurrent' && (
            <div style={{ paddingTop: '16px' }}>
              {overseasShown && (
                <div style={{ fontSize: '0.8em', color: '#8a6d1d', background: '#f7f0dc', padding: '8px 12px', marginBottom: '12px' }}>
                  海外サイトは、アクセスすると日本版のサイトに自動で転送される場合があります。転送された場合は、ページ内の国・地域の設定から切り替えてください。
                </div>
              )}
              {smartError ? (
                <p style={{ color: '#706a5a' }}>検索に失敗しました。</p>
              ) : visibleSmartItems.length === 0 ? (
                <p style={{ color: '#706a5a' }}>該当するサイトはありません。</p>
              ) : (
                visibleSmartItems.map((item, idx) => {
                  const isRisky = item.trust === 'risky';
                  const isFav = favoritedUrls.has(item.url);
                  return (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid #ccc', borderRadius: '6px', marginBottom: '10px', borderLeft: isRisky ? '4px solid #b23a2e' : '1px solid #ccc' }}>
                      <div>
                        <a 
                          href={item.url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          onClick={(e) => {
                            if (isRisky && !confirm('このサイトは信頼性が低い可能性があります。それでも開きますか？')) {
                              e.preventDefault();
                            }
                          }}
                          style={{ color: '#0066cc', textDecoration: 'none', fontWeight: 'bold' }}
                        >
                          {item.title}
                        </a>
                        <div style={{ marginTop: '4px' }}>
                          <span style={{ fontSize: '0.75em', padding: '2px 8px', borderRadius: '3px', background: isRisky ? '#fbe4e2' : '#e3f0e3', color: isRisky ? '#b23a2e' : '#2d6a2d' }}>
                            {trustLabels[item.trust] || item.trust}
                          </span>
                          {item.region === 'overseas' && (
                            <span style={{ fontSize: '0.75em', padding: '2px 8px', borderRadius: '3px', marginLeft: '8px', background: '#e6ecf5', color: '#1a365d' }}>海外サイト</span>
                          )}
                        </div>
                        {item.trustReason && <div style={{ fontSize: '0.8em', color: '#706a5a', marginTop: '4px' }}>判定理由: {item.trustReason}</div>}
                        <div style={{ fontSize: '0.85em', color: '#706a5a', marginTop: '4px' }}>{item.snippet}</div>
                      </div>
                      <button
                        onClick={() => handleFavorite(item.url, item.title)}
                        disabled={isFav}
                        style={{ background: 'none', border: 'none', fontSize: '1.5em', cursor: 'pointer', color: isFav ? '#e91e63' : '#ccc' }}
                      >
                        {isFav ? '♥' : '♡'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === 'panelAuction' && (
            <div style={{ paddingTop: '16px' }}>
              {auctionKeys.length === 0 ? (
                <p style={{ color: '#706a5a' }}>該当するサイトはありません。</p>
              ) : (
                auctionKeys.map((key) => {
                  const siteName = siteNames[key] || key;
                  const url = auctionUrls[key];
                  const isFav = favoritedUrls.has(url);
                  return (
                    <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid #ccc', borderRadius: '6px', marginBottom: '10px' }}>
                      <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: '#0066cc', textDecoration: 'none', fontWeight: 'bold' }}>
                        {siteName} で見る
                      </a>
                      <button
                        onClick={() => handleFavorite(url, siteName)}
                        disabled={isFav}
                        style={{ background: 'none', border: 'none', fontSize: '1.5em', cursor: 'pointer', color: isFav ? '#e91e63' : '#ccc' }}
                      >
                        {isFav ? '♥' : '♡'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

### 6.3 マイページ画面 (`frontend/src/pages/MyPage.tsx`)
- **機能概要**: `GET /api/favorites`（`credentials: 'include'`）でお気に入り一覧を取得し、未認証（非OK）の場合は `/login` へ遷移する。お気に入りの削除（`DELETE /api/favorites/:id`）およびログアウト（`POST /api/logout`）機能を備える。

```tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface FavoriteItem {
  id: number;
  keyword: string;
  url: string;
  site_name: string;
  created_at: string;
}

export default function MyPage() {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadFavorites() {
      try {
        const res = await fetch('http://localhost:3000/api/favorites', {
          credentials: 'include' // セッションを送信して認証を通す
        });
        if (!res.ok) {
          alert('ログインが必要です');
          navigate('/login');
          return;
        }
        const data = await res.json();
        setFavorites(data);
      } catch (err) {
        console.error('通信エラー:', err);
      } finally {
        setLoading(false);
      }
    }
    loadFavorites();
  }, [navigate]);

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`http://localhost:3000/api/favorites/${id}`, { 
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        alert('お気に入りから削除しました');
        setFavorites(prev => prev.filter(item => item.id !== id));
      } else {
        alert('削除に失敗しました');
      }
    } catch (err) {
      console.error('通信エラー:', err);
    }
  };

  // ログアウト処理を追加
  const handleLogout = async () => {
    try {
      await fetch('http://localhost:3000/api/logout', {
        method: 'POST',
        credentials: 'include'
      });
      navigate('/login');
    } catch (err) {
      console.error('ログアウトエラー:', err);
      navigate('/login');
    }
  };

  return (
    <div style={{ maxWidth: '320px', margin: '30px auto', padding: '16px', fontFamily: 'sans-serif', background: '#F7F3E9', color: '#1B1B1B', borderRadius: '8px' }}>
      <nav style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
        <button 
          onClick={() => navigate('/dashboard')} 
          style={{ background: 'none', border: 'none', color: '#1B2A4A', cursor: 'pointer', padding: 0, fontSize: '0.9em', textDecoration: 'underline' }}
        >
          &laquo; 検索画面に戻る
        </button>
        <button 
          onClick={handleLogout}
          style={{ background: 'none', border: 'none', color: '#B23A2E', cursor: 'pointer', padding: 0, fontSize: '0.9em', textDecoration: 'underline', fontWeight: 'bold' }}
        >
          ログアウト
        </button>
      </nav>

      <h1 style={{ fontSize: '1.2em', color: '#1B2A4A', marginBottom: '15px', borderBottom: '1px solid #1B2A4A', paddingBottom: '5px' }}>
        Item Journal - マイページ
      </h1>

      {loading && <p style={{ fontSize: '0.85em', color: '#706a5a' }}>読み込み中...</p>}

      {!loading && favorites.length === 0 && (
        <p style={{ fontSize: '0.85em', color: '#706a5a' }}>まだお気に入りがありません。</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {favorites.map((fav) => (
          <div 
            key={fav.id} 
            style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              border: '1px dashed #1B2A4A', 
              background: '#fff', 
              padding: '8px 10px', 
              fontSize: '0.85em' 
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', paddingRight: '8px' }}>
              <a href={fav.url} target="_blank" rel="noopener noreferrer" style={{ color: '#1B2A4A', textDecoration: 'none', fontWeight: 'bold', wordBreak: 'break-all' }}>
                {fav.site_name || fav.url}
              </a>
              <span style={{ fontSize: '0.8em', color: '#706a5a', marginTop: '2px' }}>
                検索キーワード: {fav.keyword}
              </span>
            </div>
            <button 
              onClick={() => handleDelete(fav.id)}
              style={{ background: 'none', border: 'none', color: '#B23A2E', fontSize: '1.1em', cursor: 'pointer', flex: 'none', padding: '4px' }}
            >
              ☓
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 6.4 ヘルプ画面 (`frontend/src/pages/Help.tsx`)
- **機能概要**: クロスボーダーEC利用時のガイド（決済方法、関税・消費税の仕組み、怪しいサイトの見分け方、よく使う英単語辞典、転送サービス）および検索・マイページへのナビゲーションを提供する。

```tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Help() {
  const navigate = useNavigate();

  return (
    <div style={{ maxWidth: '800px', margin: '30px auto', padding: '20px', fontFamily: "sans-serif", background: '#F7F3E9', color: '#1B1B1B', borderRadius: '8px', lineHeight: '1.6' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1B2A4A', paddingBottom: '10px', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '1.4em', color: '#1B2A4A', margin: 0 }}>Item Journal - ヘルプ</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => navigate('/dashboard')} style={{ padding: '6px 12px', background: '#1B2A4A', color: '#F7F3E9', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>検索に戻る</button>
          <button onClick={() => navigate('/mypage')} style={{ padding: '6px 12px', background: 'none', border: '1px solid #1B2A4A', color: '#1B2A4A', borderRadius: '4px', cursor: 'pointer' }}>マイページ</button>
        </div>
      </div>

      <nav style={{ background: '#fff', padding: '12px', border: '1px solid #1B2A4A', borderRadius: '6px', marginBottom: '20px' }}>
        <h3 style={{ fontSize: '0.9em', color: '#1B2A4A', margin: '0 0 8px 0' }}>目次</h3>
        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.9em' }}>
          <li><a href="#payment" style={{ color: '#1B2A4A', textDecoration: 'none' }}>決済方法について</a></li>
          <li><a href="#tax" style={{ color: '#1B2A4A', textDecoration: 'none' }}>関税・消費税の仕組み</a></li>
          <li><a href="#scam" style={{ color: '#1B2A4A', textDecoration: 'none' }}>怪しいサイトの見分け方</a></li>
          <li><a href="#glossary" style={{ color: '#1B2A4A', textDecoration: 'none' }}>よく使う英単語辞典</a></li>
          <li><a href="#forwarding" style={{ color: '#1B2A4A', textDecoration: 'none' }}>転送サービスについて</a></li>
        </ul>
      </nav>

      <section id="payment" style={{ marginBottom: '25px', background: '#fff', padding: '16px', borderRadius: '6px', border: '1px solid #ddd' }}>
        <h2 style={{ fontSize: '1.1em', color: '#1B2A4A', borderBottom: '2px solid #1B2A4A', paddingBottom: '6px', marginTop: 0 }}>1. 決済方法について</h2>
        <p style={{ fontSize: '0.9em' }}>海外サイトでは主に以下の決済方法が使われます。</p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85em', marginTop: '10px' }}>
          <thead>
            <tr style={{ background: '#1B2A4A', color: '#F7F3E9' }}>
              <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #ddd' }}>決済方法</th>
              <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #ddd' }}>特徴</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>クレジットカード</td>
              <td style={{ padding: '8px', border: '1px solid #ddd' }}>一番一般的。3Dセキュア(本人認証)が求められる場合がある</td>
            </tr>
            <tr>
              <td style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>PayPal</td>
              <td style={{ padding: '8px', border: '1px solid #ddd' }}>カード情報をサイトに直接渡さずに決済できるので比較的安全。多くのECサイトで対応</td>
            </tr>
            <tr>
              <td style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>Wise (旧TransferWise)</td>
              <td style={{ padding: '8px', border: '1px solid #ddd' }}>海外送金サービス。銀行振込よりレートが良いことが多い</td>
            </tr>
          </tbody>
        </table>
        <p style={{ fontSize: '0.85em', color: '#706a5a', marginTop: '10px' }}>銀行振込のみしか選べないサイトは、後述の「怪しいサイトの見分け方」に該当することが多いので注意してください。</p>
      </section>

      <section id="tax" style={{ marginBottom: '25px', background: '#fff', padding: '16px', borderRadius: '6px', border: '1px solid #ddd' }}>
        <h2 style={{ fontSize: '1.1em', color: '#1B2A4A', borderBottom: '2px solid #1B2A4A', paddingBottom: '6px', marginTop: 0 }}>2. 関税・消費税の仕組み</h2>
        <p style={{ fontSize: '0.9em' }}>
          海外から商品を輸入する場合、商品の価格や種類によって関税・消費税がかかることがあります。
          金額はサイト購入時の価格には含まれておらず、荷物が日本に届く際に別途請求されるケースが多いので、
          「思ったより高くついた」とならないよう、事前に大まかな仕組みを知っておくと安心です。
        </p>
      </section>

      <section id="scam" style={{ marginBottom: '25px', background: '#fff', padding: '16px', borderRadius: '6px', border: '1px solid #ddd' }}>
        <h2 style={{ fontSize: '1.1em', color: '#1B2A4A', borderBottom: '2px solid #1B2A4A', paddingBottom: '6px', marginTop: 0 }}>3. 怪しいサイトの見分け方</h2>
        <div style={{ background: '#FBEBEA', borderLeft: '4px solid #B23A2E', padding: '10px', fontSize: '0.9em', color: '#B23A2E', marginBottom: '10px' }}>
          以下に複数当てはまる場合は、購入前に一度立ち止まって確認しましょう。
        </div>
        <ul style={{ fontSize: '0.9em', paddingLeft: '20px', margin: 0 }}>
          <li style={{ marginBottom: '4px' }}>価格が相場より極端に安い</li>
          <li style={{ marginBottom: '4px' }}>支払い方法が銀行振込のみ</li>
          <li style={{ marginBottom: '4px' }}>サイト全体の日本語/英語が不自然(機械翻訳感が強い)</li>
          <li style={{ marginBottom: '4px' }}>会社情報・住所・問い合わせ先が不明瞭</li>
          <li style={{ marginBottom: '4px' }}>レビュー・評価が全くない、または不自然に高評価ばかり</li>
        </ul>
      </section>

      <section id="glossary" style={{ marginBottom: '25px', background: '#fff', padding: '16px', borderRadius: '6px', border: '1px solid #ddd' }}>
        <h2 style={{ fontSize: '1.1em', color: '#1B2A4A', borderBottom: '2px solid #1B2A4A', paddingBottom: '6px', marginTop: 0 }}>4. よく使う英単語辞典</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85em', marginTop: '10px' }}>
          <thead>
            <tr style={{ background: '#1B2A4A', color: '#F7F3E9' }}>
              <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #ddd' }}>英単語</th>
              <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #ddd' }}>意味</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>Buy It Now</td><td style={{ padding: '8px', border: '1px solid #ddd' }}>即決価格(入札せずすぐ購入できる)</td></tr>
            <tr><td style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>Bid</td><td style={{ padding: '8px', border: '1px solid #ddd' }}>入札</td></tr>
            <tr><td style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>Sold</td><td style={{ padding: '8px', border: '1px solid #ddd' }}>売却済み・落札済み</td></tr>
            <tr><td style={{ padding: '8px', border: '1px solid #ddd', fontWeight: 'bold' }}>Shipping</td><td style={{ padding: '8px', border: '1px solid #ddd' }}>配送・送料</td></tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
```