const API_BASE = 'http://localhost:3000';

const siteNames = {
  yahooAuction: "ヤフオク!",
  ebaySold: "eBay(過去の落札)",
  mercari: "メルカリ",
  amazon: "Amazon",
  rakuten: "楽天市場"
};

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const pageTitle = tabs[0].title || '';
  document.getElementById('pageTitle').textContent = `対象ページ: ${pageTitle}`;
  document.getElementById('keyword').value = pageTitle;
});

document.getElementById('searchBtn').addEventListener('click', async () => {
  const keyword = document.getElementById('keyword').value;
  if (!keyword) return;

  const res = await fetch(`${API_BASE}/api/search?keyword=${encodeURIComponent(keyword)}`);
  const urls = await res.json();

  const resultsDiv = document.getElementById('results');
  resultsDiv.innerHTML = '';

  for (const key in urls) {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <a href="${urls[key]}" target="_blank">${siteNames[key] || key}</a>
      <button class="heartBtn" data-url="${urls[key]}" data-site="${siteNames[key] || key}">♡</button>
    `;
    resultsDiv.appendChild(card);
  }

  document.querySelectorAll('.heartBtn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const favRes = await fetch(`${API_BASE}/api/favorites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          keyword,
          url: btn.dataset.url,
          siteName: btn.dataset.site
        })
      });

      if (favRes.ok) {
        btn.textContent = '♥';
        btn.disabled = true;
      } else if (favRes.status === 401) {
        document.getElementById('loginNotice').style.display = 'block';
      } else {
        const data = await favRes.json();
        alert(data.error);
      }
    });
  });
});

// ---- 相場チェック ----
document.getElementById('marketBtn').addEventListener('click', async () => {
  const keyword = document.getElementById('keyword').value;
  if (!keyword) return;

  const marketBtn = document.getElementById('marketBtn');
  const priceResultDiv = document.getElementById('priceResult');
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
    const data = await res.json();

    if (!data.sufficient) {
      priceResultDiv.innerHTML = `<div class="priceCard priceError">${data.message}</div>`;
    } else {
      const low = data.priceRangeLow.toLocaleString();
      const high = data.priceRangeHigh.toLocaleString();
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