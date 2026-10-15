import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import MyPage from './pages/MyPage';
import Help from './pages/Help';

// トークンをキャッチするための内部コンポーネント
function TokenHandler() {
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    if (token) {
      // トークンをブラウザに保存
      localStorage.setItem('token', token);
      console.log('トークンを保存しました:', token);
      
      // URLから ?token=... を消してスッキリさせる
      window.history.replaceState({}, document.title, location.pathname);
    }
  }, [location]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <TokenHandler />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/login" element={<Login />} />
        <Route path="/mypage" element={<MyPage />} />
        <Route path="/help" element={<Help />} />
      </Routes>
    </BrowserRouter>
  );
}