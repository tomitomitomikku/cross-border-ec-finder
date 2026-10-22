import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App' // メインのコンポーネント
import './index.css'   // 必要に応じてスタイル

const rootElement = document.getElementById('root');

if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  console.error("Root element #root not found in popup.html");
}