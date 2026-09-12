import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { shareApi } from '../api/share';
import { getToken } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Spinner } from '../components/Spinner';
import type { ShareInfo } from '../types';
import { prettyError } from '../utils/format';

const TYPE_LABEL: Record<ShareInfo['type'], string> = {
  private: '私聊',
  group: '群聊',
  ai: 'AI 对话',
};

export function ShareJoin() {
  const { token = '' } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [info, setInfo] = useState<ShareInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      setLoading(true);
      setErr('');
      try {
        const s = await shareApi.getInfo(token);
        setInfo(s);
      } catch (e) {
        setErr(prettyError(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const join = async () => {
    if (!token) return;
    if (!getToken()) {
      navigate(`/login?redirect=${encodeURIComponent(`/share/${token}`)}`);
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const r = await shareApi.join(token, info?.requiresPassword ? password : undefined);
      navigate(`/?open=${encodeURIComponent(r.conversationId)}`, { replace: true });
    } catch (e) {
      setErr(prettyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>加入共享会话</h1>
        {loading ? (
          <div className="empty-list">
            <Spinner />
          </div>
        ) : err && !info ? (
          <>
            <div className="inline-msg err">{err}</div>
            <button className="btn btn-primary btn-block" onClick={() => navigate('/login')}>
              去登录
            </button>
          </>
        ) : info ? (
          <div className="form">
            <div className="share-info">
              <div className="share-info-icon">💬</div>
              <div className="share-info-name">{info.name || '共享会话'}</div>
              <div className="muted">类型：{TYPE_LABEL[info.type]}</div>
              <div className="muted">
                {info.expiresAt ? `有效期至 ${new Date(info.expiresAt).toLocaleString()}` : ''}
              </div>
            </div>
            {info.requiresPassword && (
              <label>
                访问密码
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入共享密码"
                />
              </label>
            )}
            {!user && <div className="inline-msg err">加入会话需要先登录账号</div>}
            {err && <div className="form-error">{err}</div>}
            <button className="btn btn-primary btn-block" onClick={join} disabled={busy}>
              {busy ? <Spinner size={14} /> : null}
              {user ? '加入会话' : '登录并加入'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
