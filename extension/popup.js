const API_BASE = 'http://localhost:3000';

const siteNames = {
  yahooAuction: "ヤフオク!",
  ebaySold: "eBay(過去の落札)",
  mercari: "メルカリ",
  amazon: "Amazon",
  rakuten: "楽天市場"
};

// ポップアップが開いたら、今見ているタブのタイトルを取得してキーワード欄に自動入力
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