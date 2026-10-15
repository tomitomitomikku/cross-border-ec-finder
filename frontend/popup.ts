const API_BASE = 'https://cross-border-ec-finder.onrender.com';

const siteNames: Record<string, string> = {
  yahooAuction: "ヤフオク!",
  ebaySold: "eBay(過去の落札)",
  mercari: "メルカリ",
  amazon: "Amazon",
  rakuten: "楽天市場"
};

interface MarketPriceResponse {
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

// 現在のタブのタイトルをキーワードに設定
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const pageTitle = tabs[0]?.title || '';
  const pageTitleEl = document.getElementById('pageTitle');
  const keywordEl = document.getElementById('keyword') as HTMLInputElement | null;

  if (pageTitleEl) pageTitleEl.textContent = `対象ページ: ${pageTitle}`;
  if (keywordEl) keywordEl.value = pageTitle;
});

// 検索ボタン
document.getElementById('searchBtn')?.addEventListener('click', async () => {
  const keywordEl = document.getElementById('keyword') as HTMLInputElement | null;
  const keyword = keywordEl?.value || '';
  if (!keyword) return;

  try {
    const res = await fetch(`${API_BASE}/api/search?keyword=${encodeURIComponent(keyword)}`);
    const urls: Record<string, string> = await res.json();

    const resultsDiv = document.getElementById('results');
    if (!resultsDiv) return;
    resultsDiv.innerHTML = '';

    for (const key in urls) {
      const card = document.createElement('div');
      card.className = 'card';
      const siteName = siteNames[key] || key;
      const url = urls[key];
      
      card.innerHTML = `
        <a href="${url}" target="_blank" rel="noopener noreferrer">${siteName}</a>
        <button class="heartBtn" data-url="${url}" data-site="${siteName}">♡</button>
      `;
      resultsDiv.appendChild(card);
    }

    // お気に入りボタンのイベント付与
    document.querySelectorAll('.heartBtn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const button = btn as HTMLButtonElement;
        const targetUrl = button.dataset.url || '';
        const siteName = button.dataset.site || '';

        try {
          const favRes = await fetch(`${API_BASE}/api/favorites`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ keyword, url: targetUrl, siteName })
          });

          if (favRes.ok) {
            button.textContent = '♥';
            button.disabled = true;
          } else if (favRes.status === 401) {
            const loginNotice = document.getElementById('loginNotice');
            if (loginNotice) loginNotice.style.display = 'block';
          } else {
            const data = await favRes.json();
            alert(data.error || 'エラーが発生しました');
          }
        } catch (err) {
          alert('通信エラーが発生しました');
        }
      });
    });
  } catch (err) {
    alert('検索処理に失敗しました');
  }
});

// ---- 相場チェック ----
document.getElementById('marketBtn')?.addEventListener('click', async () => {
  const keywordEl = document.getElementById('keyword') as HTMLInputElement | null;
  const keyword = keywordEl?.value || '';
  if (!keyword) return;

  const marketBtn = document.getElementById('marketBtn') as HTMLButtonElement | null;
  const priceResultDiv = document.getElementById('priceResult');
  if (!marketBtn || !priceResultDiv) return;

  marketBtn.classList.add('loading');
  marketBtn.textContent = '調査中…';
  marketBtn.disabled = true;
  priceResultDiv.innerHTML = '';

  try {
    const res = await fetch(`${API_BASE}/api/market-price`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: keyword })
    });
    const data: MarketPriceResponse = await res.json();

    if (!data.sufficient) {
      priceResultDiv.innerHTML = `<div class="priceCard priceError">${data.message || data.error || '相場情報を取得できませんでした'}</div>`;
    } else {
      const low = data.priceRangeLow?.toLocaleString() ?? '0';
      const high = data.priceRangeHigh?.toLocaleString() ?? '0';
      priceResultDiv.innerHTML = `
        <div class="priceCard">
          <div class="priceMeta">発売時期: ${data.releaseDate || '不明'} / 発売元: ${data.manufacturer || '不明'}</div>
          <div>${data.description || ''}</div>
          <div class="priceRange">${low}円 〜 ${high}円</div>
          <div class="priceMeta">${data.note || ''}</div>
        </div>
      `;
    }
  } catch (err) {
    priceResultDiv.innerHTML = '<div class="priceCard priceError">相場の取得に失敗しました。</div>';
  }

  marketBtn.classList.remove('loading');
  marketBtn.textContent = '相場';
  marketBtn.disabled = false;
});
