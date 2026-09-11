import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setupApi } from '../api/setup';
import { Spinner } from '../components/Spinner';
import { prettyError } from '../utils/format';

interface DbForm {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

interface AdminForm {
  username: string;
  email: string;
  password: string;
  confirm: string;
}

interface SmtpForm {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  secure: boolean;
}

export function SetupWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [db, setDb] = useState<DbForm>({
    host: 'localhost',
    port: 5432,
    database: 'chatroom',
    username: 'postgres',
    password: '',
  });
  const [admin, setAdmin] = useState<AdminForm>({
    username: 'admin',
    email: '',
    password: '',
    confirm: '',
  });
  const [smtp, setSmtp] = useState<SmtpForm>({
    host: '',
    port: 587,
    user: '',
    pass: '',
    from: '',
    secure: false,
  });
  const [testLoading, setTestLoading] = useState(false);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const testDb = async () => {
    setErr('');
    setTestMsg(null);
    setTestLoading(true);
    try {
      const r = await setupApi.testDb({ ...db, port: Number(db.port) });
      setTestMsg({ ok: true, text: r.message || '数据库连接成功' });
    } catch (e) {
      setTestMsg({ ok: false, text: prettyError(e) });
    } finally {
      setTestLoading(false);
    }
  };

  const nextFromStep1 = () => {
    setErr('');
    if (!db.host || !db.database || !db.username) {
      setErr('请填写完整的数据库连接信息');
      return;
    }
    setStep(2);
  };

  const nextFromStep2 = () => {
    setErr('');
    if (!admin.username || !admin.email || !admin.password) {
      setErr('请填写完整的管理员账号信息');
      return;
    }
    if (admin.password.length < 6) {
      setErr('密码至少 6 位');
      return;
    }
    if (admin.password !== admin.confirm) {
      setErr('两次密码不一致');
      return;
    }
    setStep(3);
  };

  const finish = async (skipSmtp: boolean) => {
    setErr('');
    setBusy(true);
    try {
      await setupApi.init({
        dbConfig: { ...db, port: Number(db.port) },
        admin: {
          username: admin.username,
          email: admin.email,
          password: admin.password,
          displayName: admin.username,
        },
        smtp: skipSmtp
          ? undefined
          : smtp.host
            ? { ...smtp, port: Number(smtp.port), secure: Boolean(smtp.secure) }
            : undefined,
      });
      navigate('/login?setup=1', { replace: true });
    } catch (e) {
      setErr(prettyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card setup-card">
        <h1>初始化聊天文件室</h1>
        <p className="muted">首次使用，请按向导完成系统初始化</p>

        <div className="steps">
          {[1, 2, 3].map((n) => (
            <div key={n} className={`step ${step === n ? 'active' : ''} ${step > n ? 'done' : ''}`}>
              <span className="step-dot">{step > n ? '✓' : n}</span>
              <span className="step-label">
                {n === 1 ? '数据库' : n === 2 ? '管理员' : 'SMTP'}
              </span>
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="form">
            <label>
              主机
              <input
                value={db.host}
                onChange={(e) => setDb({ ...db, host: e.target.value })}
              />
            </label>
            <div className="row-2">
              <label>
                端口
                <input
                  type="number"
                  value={db.port}
                  onChange={(e) => setDb({ ...db, port: Number(e.target.value) })}
                />
              </label>
              <label>
                数据库名
                <input
                  value={db.database}
                  onChange={(e) => setDb({ ...db, database: e.target.value })}
                />
              </label>
            </div>
            <label>
              用户名
              <input
                value={db.username}
                onChange={(e) => setDb({ ...db, username: e.target.value })}
              />
            </label>
            <label>
              密码
              <input
                type="password"
                value={db.password}
                onChange={(e) => setDb({ ...db, password: e.target.value })}
              />
            </label>
            <div className="row-2">
              <button type="button" className="btn btn-secondary" onClick={testDb} disabled={testLoading}>
                {testLoading ? <Spinner size={14} /> : null}
                测试连接
              </button>
              {testMsg && (
                <div className={`inline-msg ${testMsg.ok ? 'ok' : 'err'}`}>{testMsg.text}</div>
              )}
            </div>
            {err && <div className="form-error">{err}</div>}
            <div className="auth-actions">
              <button className="btn btn-primary" onClick={nextFromStep1}>
                下一步
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="form">
            <label>
              管理员用户名
              <input
                value={admin.username}
                onChange={(e) => setAdmin({ ...admin, username: e.target.value })}
              />
            </label>
            <label>
              邮箱
              <input
                type="email"
                value={admin.email}
                onChange={(e) => setAdmin({ ...admin, email: e.target.value })}
              />
            </label>
            <label>
              密码
              <input
                type="password"
                value={admin.password}
                onChange={(e) => setAdmin({ ...admin, password: e.target.value })}
              />
            </label>
            <label>
              确认密码
              <input
                type="password"
                value={admin.confirm}
                onChange={(e) => setAdmin({ ...admin, confirm: e.target.value })}
              />
            </label>
            {err && <div className="form-error">{err}</div>}
            <div className="auth-actions">
              <button className="btn btn-ghost" onClick={() => setStep(1)}>
                上一步
              </button>
              <button className="btn btn-primary" onClick={nextFromStep2}>
                下一步
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="form">
            <p className="muted">SMTP 用于发送验证邮件与通知，可留空跳过。</p>
            <div className="row-2">
              <label>
                主机
                <input
                  value={smtp.host}
                  onChange={(e) => setSmtp({ ...smtp, host: e.target.value })}
                />
              </label>
              <label>
                端口
                <input
                  type="number"
                  value={smtp.port}
                  onChange={(e) => setSmtp({ ...smtp, port: Number(e.target.value) })}
                />
              </label>
            </div>
            <label>
              用户名
              <input
                value={smtp.user}
                onChange={(e) => setSmtp({ ...smtp, user: e.target.value })}
              />
            </label>
            <label>
              密码 / 授权码
              <input
                type="password"
                value={smtp.pass}
                onChange={(e) => setSmtp({ ...smtp, pass: e.target.value })}
              />
            </label>
            <label>
              发件人地址
              <input
                value={smtp.from}
                onChange={(e) => setSmtp({ ...smtp, from: e.target.value })}
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={smtp.secure}
                onChange={(e) => setSmtp({ ...smtp, secure: e.target.checked })}
              />
              使用 SSL/TLS 安全连接
            </label>
            {err && <div className="form-error">{err}</div>}
            <div className="auth-actions">
              <button className="btn btn-ghost" onClick={() => setStep(2)}>
                上一步
              </button>
              <button className="btn btn-secondary" onClick={() => finish(true)} disabled={busy}>
                {busy ? <Spinner size={14} /> : null}
                跳过
              </button>
              <button className="btn btn-primary" onClick={() => finish(false)} disabled={busy}>
                {busy ? <Spinner size={14} /> : null}
                完成初始化
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
