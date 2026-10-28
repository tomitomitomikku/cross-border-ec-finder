import React, { useState } from 'react';
import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import MyPage from './pages/MyPage';
import Help from './pages/Help';

export default function App() {
  // 常にログイン済みとして扱う（拡張機能やデモ用）
  const [isAuthenticated] = useState<boolean>(true);

  return (
    <MemoryRouter>
      <Routes>
        {/* ログイン画面 */}
        <Route path="/login" element={<Login />} />
        
        {/* マイページ */}
        <Route 
          path="/mypage" 
          element={isAuthenticated ? <MyPage /> : <Navigate to="/login" replace />} 
        />
        
        {/* ヘルプ */}
        <Route path="/help" element={<Help />} />
        
        {/* ダッシュボード */}
        <Route 
          path="/dashboard" 
          element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/" 
          element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" replace />} 
        />
      </Routes>
    </MemoryRouter>
  );
}