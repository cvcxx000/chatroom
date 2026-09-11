import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Spinner } from '../components/Spinner';
import { prettyError } from '../utils/format';

export function AdminLogin() {
  const { adminLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const qs = new URLSearchParams(location.search);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await adminLogin(username.trim(), password);
      navigate('/admin', { replace: true });
    } catch (e2) {
      setErr(prettyError(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card admin-login-card" onSubmit={submit}>
        <h1>管理员登录</h1>
        <p className="muted">仅限管理员账号</p>
        {qs.get('banned') && <div className="inline-msg err">账号已被封禁</div>}
        <div className="form">
          <label>
            管理员用户名
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required />
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
            进入管理后台
          </button>
          <div className="auth-links">
            <Link to="/login">普通用户登录</Link>
          </div>
        </div>
      </form>
    </div>
  );
}
