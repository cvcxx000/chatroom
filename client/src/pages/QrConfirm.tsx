import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { qrApi } from '../api/qr';
import { useAuth } from '../context/AuthContext';
import { Spinner } from '../components/Spinner';
import { prettyError } from '../utils/format';

export function QrConfirm() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qs = new URLSearchParams(location.search);
  const token = qs.get('token') || '';

  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading');
  const [err, setErr] = useState('');
  const ranRef = useRef(false);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErr('缺少扫码 token');
      return;
    }
    if (!user) return; // not logged in: show login prompt
    if (ranRef.current) return;
    ranRef.current = true;
    (async () => {
      try {
        await qrApi.scan(token);
        await qrApi.confirm(token);
        setStatus('done');
      } catch (e) {
        setStatus('error');
        setErr(prettyError(e));
      }
    })();
  }, [token, user]);

  if (!user) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>扫码确认登录</h1>
          <p className="muted">请先登录你的账号，再确认本次电脑端登录。</p>
          <Link
            className="btn btn-primary btn-block"
            to={`/login?redirect=${encodeURIComponent(`/qr-confirm?token=${token}`)}`}
          >
            去登录
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>扫码确认</h1>
        {status === 'loading' ? (
          <div className="empty-list">
            <Spinner />
            <div>正在确认登录…</div>
          </div>
        ) : status === 'done' ? (
          <>
            <div className="inline-msg ok">已确认登录，请回到电脑端查看</div>
            <button className="btn btn-secondary btn-block" onClick={() => navigate('/')}>
              回到聊天
            </button>
          </>
        ) : (
          <>
            <div className="inline-msg err">{err || '确认失败，二维码可能已过期'}</div>
            <button className="btn btn-secondary btn-block" onClick={() => navigate('/')}>
              返回
            </button>
          </>
        )}
      </div>
    </div>
  );
}
