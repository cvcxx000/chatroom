import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Spinner } from '../components/Spinner';
import { prettyError } from '../utils/format';

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const qs = new URLSearchParams(location.search);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState(qs.get('setup') ? '初始化完成，请登录' : qs.get('expired') ? '登录已过期，请重新登录' : '');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setNotice('');
    setBusy(true);
    try {
      const u = await login(username.trim(), password);
      navigate(u.isAdmin ? '/' : '/', { replace: true });
    } catch (e2) {
      setErr(prettyError(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <h1>登录聊天文件室</h1>
        {notice && <div className="inline-msg ok">{notice}</div>}
        {qs.get('banned') && <div className="inline-msg err">账号已被封禁</div>}
        <div className="form">
          <label>
            用户名
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              required
            />
          </label>
          <label>
            密码
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {err && <div className="form-error">{err}</div>}
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? <Spinner size={14} /> : null}
            登录
          </button>
          <div className="auth-links">
            <Link to="/register">注册账号</Link>
            <Link to="/admin/login">管理员登录</Link>
          </div>
        </div>
      </form>
    </div>
  );
}
