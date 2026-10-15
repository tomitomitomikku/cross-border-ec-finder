import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

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
        const res = await fetch('/api/exchange-rate');
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
      const smartRes = await fetch('/api/smart-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: keyword, scope: 'global' })
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
      const res = await fetch(`/api/search?keyword=${encodeURIComponent(keyword)}&scope=global`);
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
      const res = await fetch('/api/market-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: keyword })
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
      const res = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, url, siteName })
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
        <button onClick={() => { api.logout(); navigate('/'); }} style={{ background: '#f44336', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}>ログアウト</button>
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