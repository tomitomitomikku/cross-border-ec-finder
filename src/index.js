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

// 動作確認用
const keyword = "ナイキ スニーカー 限定";
const urls = generateAuctionUrls(keyword);

console.log("検索キーワード:", keyword);
console.log("ヤフオク!:", urls.yahooAuction);
console.log("eBay(Sold):", urls.ebaySold);
console.log("メルカリ:", urls.mercari);
console.log("Amazon:", urls.amazon);
console.log("楽天市場:", urls.rakuten);