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
