import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Spinner } from '../components/Spinner';
import { prettyError } from '../utils/format';

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    confirm: '',
    displayName: '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (form.password.length < 6) {
      setErr('密码至少 6 位');
      return;
    }
    if (form.password !== form.confirm) {
      setErr('两次密码不一致');
      return;
    }
    setBusy(true);
    try {
      await register({
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
        displayName: form.displayName.trim() || form.username.trim(),
      });
      navigate('/', { replace: true });
    } catch (e2) {
      setErr(prettyError(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <h1>注册新账号</h1>
        <div className="form">
          <label>
            用户名
            <input value={form.username} onChange={set('username')} required minLength={2} />
          </label>
          <label>
            邮箱
            <input type="email" value={form.email} onChange={set('email')} required />
          </label>
          <label>
            昵称
            <input value={form.displayName} onChange={set('displayName')} placeholder="可选" />
          </label>
          <label>
            密码
            <input type="password" value={form.password} onChange={set('password')} required minLength={6} />
          </label>
          <label>
            确认密码
            <input type="password" value={form.confirm} onChange={set('confirm')} required />
          </label>
          {err && <div className="form-error">{err}</div>}
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? <Spinner size={14} /> : null}
            注册
          </button>
          <div className="auth-links">
            已有账号？<Link to="/login">去登录</Link>
          </div>
        </div>
      </form>
    </div>
  );
}
