import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { qrApi } from '../api/qr';
import { useAuth } from '../context/AuthContext';
import { Spinner } from '../components/Spinner';
import { prettyError } from '../utils/format';

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const qs = new URLSearchParams(location.search);

  // 安全校验：登录后回跳只允许站内相对路径，防止开放重定向（open redirect）钓鱼。
  // 必须以单个 "/" 开头，且拒绝 "//evil.com" 协议相对 URL 与绝对 URL。
  const rawRedirect = qs.get('redirect') || '/';
  const redirect =
    rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/';
  const [mode, setMode] = useState<'account' | 'qr'>('account');
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
      await login(username.trim(), password);
      navigate(redirect, { replace: true });
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
        <div className="auth-tabs">
          <button
            type="button"
            className={mode === 'account' ? 'active' : ''}
            onClick={() => setMode('account')}
          >
            账号登录
          </button>
          <button
            type="button"
            className={mode === 'qr' ? 'active' : ''}
            onClick={() => setMode('qr')}
          >
            扫码登录
          </button>
        </div>
        {mode === 'account' ? (
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
        ) : (
          <QrLoginPanel redirect={redirect} />
        )}
      </form>
    </div>
  );
}

function QrLoginPanel({ redirect }: { redirect: string }) {
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();

  const [qrSrc, setQrSrc] = useState('');
  const [status, setStatus] = useState<'loading' | 'pending' | 'scanned' | 'confirmed' | 'expired' | 'error'>('loading');
  const [err, setErr] = useState('');
  const tokenRef = useRef<string>('');
  const pollRef = useRef<number | null>(null);
  const stoppedRef = useRef(false);

  const clearPoll = () => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const start = async () => {
    stoppedRef.current = false;
    clearPoll();
    setErr('');
    setQrSrc('');
    setStatus('loading');
    try {
      const sess = await qrApi.create();
      tokenRef.current = sess.token;
      const content = `${window.location.origin}/qr-confirm?token=${sess.token}`;
      const dataUrl = await QRCode.toDataURL(content, { width: 240, margin: 2 });
      setQrSrc(dataUrl);
      setStatus(sess.status === 'confirmed' ? 'confirmed' : sess.status === 'expired' ? 'expired' : 'pending');
    } catch (e) {
      setStatus('error');
      setErr(prettyError(e));
      return;
    }
    pollRef.current = window.setInterval(async () => {
      if (stoppedRef.current) return;
      try {
        const s = await qrApi.getStatus(tokenRef.current);
        setStatus(s.status === 'confirmed' ? 'confirmed' : s.status === 'expired' ? 'expired' : s.status);
        if (s.status === 'confirmed') {
          clearPoll();
          const r = await qrApi.login(tokenRef.current);
          await loginWithToken(r.token, r.user);
          navigate(redirect, { replace: true });
        } else if (s.status === 'expired') {
          clearPoll();
        }
      } catch {
        /* keep polling */
      }
    }, 2000);
  };

  useEffect(() => {
    void start();
    return () => {
      stoppedRef.current = true;
      clearPoll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="qr-login">
      {status === 'loading' && (
        <div className="qr-placeholder">
          <Spinner />
        </div>
      )}
      {(status === 'pending' || status === 'scanned') && qrSrc && (
        <>
          <div className="qr-image-wrap">
            <img src={qrSrc} alt="登录二维码" className="qr-image" />
          </div>
          <div className="muted qr-hint">
            {status === 'pending' ? '使用手机端「扫一扫」扫码确认登录' : '已扫码，请在手机上确认'}
          </div>
        </>
      )}
      {status === 'expired' && (
        <>
          <div className="qr-placeholder expired">二维码已过期</div>
          <button className="btn btn-primary btn-block" onClick={start}>
            刷新二维码
          </button>
        </>
      )}
      {status === 'confirmed' && (
        <div className="qr-placeholder">
          <Spinner />
          <div>登录成功，正在跳转…</div>
        </div>
      )}
      {status === 'error' && (
        <>
          <div className="inline-msg err">{err || '二维码加载失败'}</div>
          <button className="btn btn-primary btn-block" onClick={start}>
            重试
          </button>
        </>
      )}
    </div>
  );
}
