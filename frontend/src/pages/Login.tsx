import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const navigate = useNavigate();
  const [isLoginMode, setIsLoginMode] = useState<boolean>(true);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [message, setMessage] = useState<{ text: string; color: string } | null>(null);

  const handleSubmit = async () => {
    setMessage(null);
    const endpoint = isLoginMode ? '/api/login' : '/api/signup';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
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
    <div style={{ maxWidth: '320px', margin: '40px auto', padding: '20px', fontFamily: 'sans-serif', background: '#F7F3E9', color: '#1B1B1B', borderRadius: '8px', border: '1px solid #1B2A4A' }}>
      <h1 style={{ fontSize: '1.4em', color: '#1B2A4A', textAlign: 'center', marginBottom: '20px' }}>Item Journal</h1>

      <div style={{ background: '#fff', padding: '16px', borderRadius: '6px', border: '1px solid #ddd' }}>
        <h2 style={{ fontSize: '1.1em', color: '#1B2A4A', marginTop: 0, marginBottom: '15px' }}>
          {isLoginMode ? 'ログイン' : '新規登録'}
        </h2>

        <input 
          type="email" 
          placeholder="メールアドレス" 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: '100%', padding: '8px', marginBottom: '10px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px' }}
        />
        <input 
          type="password" 
          placeholder="パスワード" 
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: '100%', padding: '8px', marginBottom: '15px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px' }}
        />
        <button 
          onClick={handleSubmit}
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
                onClick={() => { setIsLoginMode(true); setMessage(null); }}
                style={{ background: 'none', border: 'none', color: '#1B2A4A', cursor: 'pointer', textDecoration: 'underline', padding: 0, font: 'inherit' }}
              >
                ログイン
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
