import React, { useState, useEffect } from 'react';
import './App.css';

export default function App() {
  const [keyword, setKeyword] = useState<string>('');
  const [pageTitle, setPageTitle] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [results, setResults] = useState<any[]>([]);
  const [marketInfo, setMarketInfo] = useState<any>(null);
  
  // 検索範囲（domestic / global / overseas）
  const [scope, setScope] = useState<string>('global');

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const currentTab = tabs[0];
        if (currentTab && currentTab.title) {
          setPageTitle(currentTab.title);
          setKeyword(currentTab.title);
        }
      });
    } else {
      setPageTitle('開発用プレビュー');
      setKeyword('テストキーワード');
    }
  }, []);

  // 【リッチ検索】バックエンドの /api/smart-search を呼び出す
  const handleSmartSearch = async () => {
    if (!keyword) return;
    setStatusMessage('AIで幅広く検索中...');
    setResults([]);
    setMarketInfo(null);

    try {
      const response = await fetch('http://localhost:3000/api/smart-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: keyword, scope: scope })
      });

      if (!response.ok) throw new Error('サーバーからの応答が正常ではありません');

      const data = await response.json();
      console.log("スマート検索結果:", data);

      if (data.results && Array.isArray(data.results)) {
        setResults(data.results);
        setStatusMessage(`検索結果: ${data.results.length}件`);
      } else {
        setStatusMessage('結果が見つかりませんでした');
      }
    } catch (error) {
      console.error('通信エラー:', error);
      setStatusMessage('検索エラーが発生しました');
    }
  };

  // 相場ボタン（詳細な相場情報）
  const handleMarket = async () => {
    if (!keyword) return;
    setStatusMessage('相場を計算中...');
    setResults([]);
    setMarketInfo(null);

    try {
      const response = await fetch('http://localhost:3000/api/market-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: keyword })
      });

      const data = await response.json();
      
      if (data.sufficient) {
        setMarketInfo(data);
        setStatusMessage('相場情報を取得しました');
      } else {
        setStatusMessage(data.message || '相場情報を取得できませんでした');
      }
    } catch (err) {
      console.error(err);
      setStatusMessage('相場データの取得に失敗しました');
    }
  };

  // 信頼度に応じた色やバッジを返すヘルパー
  const getTrustBadge = (trust: string) => {
    if (trust === 'trusted') return <span style={{ color: 'green', fontSize: '10px', border: '1px solid green', padding: '1px 3px', borderRadius: '3px' }}>公式・大手</span>;
    if (trust === 'risky') return <span style={{ color: 'red', fontSize: '10px', border: '1px solid red', padding: '1px 3px', borderRadius: '3px' }}>要注意</span>;
    return <span style={{ color: '#888', fontSize: '10px', border: '1px solid #ccc', padding: '1px 3px', borderRadius: '3px' }}>一般・小規模</span>;
  };

  return (
    <div style={{ width: '340px', padding: '12px', fontFamily: 'sans-serif' }}>
      <h2>このページの商品を比較</h2>
      
      <div style={{ marginBottom: '8px', fontSize: '12px', color: '#666' }}>
        <strong>ページタイトル:</strong>
        <div style={{ background: '#f5f5f5', padding: '4px', marginTop: '2px' }}>
          {pageTitle || '読み込み中...'}
        </div>
      </div>

      <div style={{ marginBottom: '8px' }}>
        <input 
          type="text" 
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="キーワードを編集できます"
          style={{ width: '100%', padding: '6px', boxSizing: 'border-box' }}
        />
      </div>

      {/* 検索範囲（タブ）の選択UI */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px', fontSize: '12px' }}>
        <button 
          onClick={() => setScope('domestic')}
          style={{ flex: 1, padding: '4px', background: scope === 'domestic' ? '#0066cc' : '#f0f0f0', color: scope === 'domestic' ? '#fff' : '#333', border: '1px solid #ccc', cursor: 'pointer' }}
        >
          国内
        </button>
        <button 
          onClick={() => setScope('global')}
          style={{ flex: 1, padding: '4px', background: scope === 'global' ? '#0066cc' : '#f0f0f0', color: scope === 'global' ? '#fff' : '#333', border: '1px solid #ccc', cursor: 'pointer' }}
        >
          国内外
        </button>
        <button 
          onClick={() => setScope('overseas')}
          style={{ flex: 1, padding: '4px', background: scope === 'overseas' ? '#0066cc' : '#f0f0f0', color: scope === 'overseas' ? '#fff' : '#333', border: '1px solid #ccc', cursor: 'pointer' }}
        >
          国外
        </button>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        <button onClick={handleSmartSearch} style={{ flex: 1, padding: '6px', background: '#0066cc', color: '#fff', border: 'none', cursor: 'pointer', borderRadius: '3px' }}>
          検索する
        </button>
        <button onClick={handleMarket} style={{ flex: 1, padding: '6px', background: '#f0f0f0', border: '1px solid #ccc', cursor: 'pointer', borderRadius: '3px' }}>
          相場
        </button>
      </div>

      <div style={{ fontSize: '12px', color: '#444', marginBottom: '8px' }}>
        {statusMessage}
      </div>

      {/* 相場情報表示 */}
      {marketInfo && (
        <div style={{ background: '#f9f9f9', border: '1px solid #ddd', padding: '8px', borderRadius: '4px', fontSize: '12px', marginBottom: '8px' }}>
          <div style={{ fontWeight: 'bold', color: '#d9534f', fontSize: '14px', marginBottom: '4px' }}>
            相場: {marketInfo.priceRangeLow?.toLocaleString()}円 〜 {marketInfo.priceRangeHigh?.toLocaleString()}円
          </div>
          <div><strong>メーカー:</strong> {marketInfo.manufacturer}</div>
          <div><strong>発売時期:</strong> {marketInfo.releaseDate}</div>
          <div style={{ margin: '4px 0', color: '#333' }}>{marketInfo.description}</div>
          <div style={{ color: '#666', fontSize: '11px', borderTop: '1px solid #eee', paddingTop: '4px' }}>
            根拠: {marketInfo.note}
          </div>
        </div>
      )}

      {/* リッチな検索結果（サイト一覧）表示 */}
      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
        {results.length > 0 && results.map((item, index) => (
          <div key={index} style={{ marginBottom: '8px', padding: '6px', background: '#fafafa', border: '1px solid #eee', borderRadius: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
              <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', fontWeight: 'bold', color: '#0066cc', textDecoration: 'none' }}>
                {item.title} ↗
              </a>
              {getTrustBadge(item.trust)}
            </div>
            <div style={{ fontSize: '11px', color: '#555', marginBottom: '2px' }}>{item.snippet}</div>
            {item.trustReason && (
              <div style={{ fontSize: '10px', color: '#888', fontStyle: 'italic' }}>
                理由: {item.trustReason}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}