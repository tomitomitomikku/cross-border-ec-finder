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
        const res = await fetch('/api/favorites');
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
      const res = await fetch(`/api/favorites/${id}`, { method: 'DELETE' });
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

  return (
    <div style={{ maxWidth: '320px', margin: '30px auto', padding: '16px', fontFamily: 'sans-serif', background: '#F7F3E9', color: '#1B1B1B', borderRadius: '8px' }}>
      <nav style={{ marginBottom: '15px' }}>
        <button 
          onClick={() => navigate('/dashboard')} 
          style={{ background: 'none', border: 'none', color: '#1B2A4A', cursor: 'pointer', padding: 0, fontSize: '0.9em', textDecoration: 'underline' }}
        >
          &laquo; 検索画面に戻る
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
  　　{/* aタグのペア */}
  　　<a href={fav.url} target="_blank" rel="noopener noreferrer" style={{ color: '#1B2A4A', textDecoration: 'none', fontWeight: 'bold', wordBreak: 'break-all' }}>
    　{fav.site_name || fav.url}
  </a>
　
  {/* spanタグのペア */}
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
