import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  // アカウントロック管理の状態
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockTimer, setLockTimer] = useState(0); // ロック解除までの残り秒数

  const navigate = useNavigate();

  // カウントダウンタイマーの処理
  useEffect(() => {
    let timer;
    if (isLocked && lockTimer > 0) {
      timer = setInterval(() => {
        setLockTimer((prevTimer) => prevTimer - 1);
      }, 1000);
    } else if (lockTimer === 0 && isLocked) {
      // タイマーが0になったらロック解除
      setIsLocked(false);
      setFailedAttempts(0);
      setMessage('ロックが解除されました。再度ログインを試みてください。');
    }

    return () => clearInterval(timer);
  }, [isLocked, lockTimer]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("handleSubmit が呼ばれました！isLogin:", isLogin);

    if (isLocked) {
      setMessage(`アカウントがロックされています。あと ${lockTimer} 秒お待ちください。`);
      return;
    }

    try {
      if (isLogin) {
        console.log("ログイン処理を開始します...");
        await api.login(email, password);
        setFailedAttempts(0); // ログイン成功でカウントリセット
        navigate('/dashboard');
      } else {
        console.log("新規登録処理を開始します...");
        await api.register(email, password);
        setMessage('登録が完了しました！');
      }
    } catch (err) {
      console.error("エラーが発生しました:", err);
      if (isLogin) {
        const newFailedCount = failedAttempts + 1;
        setFailedAttempts(newFailedCount);

        if (newFailedCount >= 3) {
          setIsLocked(true);
          setLockTimer(30); // 30秒間のタイマーロック
          setMessage('パスワードを3回間違えたため、アカウントが30秒間ロックされました。');
        } else {
          const remaining = 3 - newFailedCount;
          setMessage(`ログインに失敗しました（残りあと ${remaining} 回）`);
        }
      } else {
        setMessage(err.message || 'エラーが発生しました');
      }
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h2>{isLogin ? 'ログイン' : '新規登録'}</h2>

      {message && (
        <div style={{ color: isLocked ? 'red' : 'black', marginBottom: '15px' }}>
          {message}
        </div>
      )}

      {/* ロック中は残り秒数をリアルタイム表示 */}
      {isLocked && (
        <div style={{ color: 'red', fontWeight: 'bold', marginBottom: '15px' }}>
          残り解除時間: {lockTimer} 秒
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '10px' }}>
          <label>メールアドレス:</label><br />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLocked}
            required
            style={{ width: '100%', padding: '8px' }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>パスワード:</label><br />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLocked}
            required
            style={{ width: '100%', padding: '8px' }}
          />
        </div>

        <button type="submit" disabled={isLocked} style={{ width: '100%', padding: '10px' }}>
          {isLocked ? `${lockTimer}秒待機中...` : (isLogin ? 'ログイン' : '登録')}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setIsLogin(!isLogin);
          setMessage('');
        }}
        disabled={isLocked}
        style={{ marginTop: '15px', background: 'none', border: 'none', color: 'blue', cursor: 'pointer' }}
      >
        {isLogin ? '新規アカウント作成はこちら' : 'ログイン画面に戻る'}
      </button>
    </div>
  );
}