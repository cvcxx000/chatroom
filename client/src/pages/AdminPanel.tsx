import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi, type AdminUserList, type AiConfigPayload } from '../api/admin';
import { useAuth } from '../context/AuthContext';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { Spinner } from '../components/Spinner';
import { UserAvatar } from '../components/UserAvatar';
import { CountdownTimer } from '../components/CountdownTimer';
import type { AdminStats, AiConfig, SmtpConfig, TempConversation, TempMessage, User } from '../types';
import { formatBytes, formatTime, prettyError } from '../utils/format';

type Tab = 'users' | 'stats' | 'smtp' | 'temp' | 'ai';

const AI_PRESETS: Record<string, { baseUrl: string; model: string; name: string }> = {
  qwen: { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-turbo', name: '千问' },
  doubao: { baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', model: 'doubao-1-5-pro-32k', name: '豆包' },
  deepseek: { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', name: 'DeepSeek' },
  zhipu: { baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash', name: '智谱' },
  custom: { baseUrl: '', model: '', name: '自定义' },
};

export function AdminPanel() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('users');

  if (!user || !user.isAdmin) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>未授权</h1>
          <p className="muted">此页面仅限管理员访问。</p>
          <button
            className="btn btn-primary"
            onClick={() => {
              logout();
              navigate('/admin/login');
            }}
          >
            回到管理员登录
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <aside className="admin-sidebar">
        <div className="brand">
          <span className="brand-dot" />
          管理后台
        </div>
        <nav className="admin-nav">
          <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>
            用户管理
          </button>
          <button className={tab === 'stats' ? 'active' : ''} onClick={() => setTab('stats')}>
            系统统计
          </button>
          <button className={tab === 'smtp' ? 'active' : ''} onClick={() => setTab('smtp')}>
            SMTP 配置
          </button>
          <button className={tab === 'temp' ? 'active' : ''} onClick={() => setTab('temp')}>
            临时对话
          </button>
          <button className={tab === 'ai' ? 'active' : ''} onClick={() => setTab('ai')}>
            AI 配置
          </button>
        </nav>
        <div className="admin-user">
          <UserAvatar name={user.username} size={36} />
          <div className="admin-user-meta">
            <div>{user.username}</div>
            <div className="muted">管理员</div>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            退出
          </button>
        </div>
      </aside>
      <main className="admin-main">
        {tab === 'users' && <UsersTab />}
        {tab === 'stats' && <StatsTab />}
        {tab === 'smtp' && <SmtpTab />}
        {tab === 'temp' && <TempTab />}
        {tab === 'ai' && <AiConfigsTab />}
      </main>
    </div>
  );
}

function UsersTab() {
  const [q, setQ] = useState('');
  const [data, setData] = useState<AdminUserList | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState('');

  const load = useCallback(async (query = '') => {
    setLoading(true);
    setErr('');
    try {
      const r = await adminApi.listUsers({ q: query, limit: 100 });
      setData(r);
    } catch (e) {
      setErr(prettyError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load('');
  }, [load]);

  const toggleBan = async (u: User) => {
    setBusyId(u.id);
    try {
      const banned = u.isBanned ?? u.is_banned;
      if (banned) await adminApi.unbanUser(u.id);
      else await adminApi.banUser(u.id);
      await load(q);
    } catch (e) {
      setErr(prettyError(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section>
      <div className="admin-toolbar">
        <h2>用户管理</h2>
        <div className="search-box">
          <input
            placeholder="搜索用户名 / 邮箱…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load(q)}
          />
          <button className="btn btn-secondary" onClick={() => load(q)}>
            搜索
          </button>
        </div>
      </div>
      {err && <div className="inline-msg err">{err}</div>}
      {loading ? (
        <div className="empty-list">
          <Spinner />
        </div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>用户</th>
              <th>用户名</th>
              <th>邮箱</th>
              <th>状态</th>
              <th>注册时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {data?.users?.map((u) => {
              const banned = u.isBanned ?? u.is_banned;
              return (
                <tr key={u.id} className={banned ? 'row-banned' : ''}>
                  <td>
                    <UserAvatar name={u.username} size={32} src={u.avatarUrl ?? u.avatar_url ?? null} />
                  </td>
                  <td>
                    {u.displayName || u.display_name || u.username}
                    <div className="muted">@{u.username}</div>
                  </td>
                  <td>{u.email || '-'}</td>
                  <td>
                    {u.isAdmin || u.is_admin ? <Badge variant="warn">管理员</Badge> : null}
                    {banned ? <Badge variant="danger">已封禁</Badge> : <Badge variant="online">正常</Badge>}
                  </td>
                  <td>{formatTime(u.createdAt ?? u.created_at)}</td>
                  <td>
                    <button
                      className={`btn btn-sm ${banned ? 'btn-secondary' : 'btn-danger'}`}
                      onClick={() => toggleBan(u)}
                      disabled={busyId === u.id || (u.isAdmin ?? u.is_admin)}
                    >
                      {busyId === u.id ? <Spinner size={14} /> : banned ? '解封' : '封禁'}
                    </button>
                  </td>
                </tr>
              );
            })}
            {(!data?.users || data.users.length === 0) && (
              <tr>
                <td colSpan={6} className="muted">
                  没有用户
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </section>
  );
}

function StatsTab() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setStats(await adminApi.stats());
      } catch (e) {
        setErr(prettyError(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="empty-list"><Spinner /></div>;
  if (err) return <div className="inline-msg err">{err}</div>;
  if (!stats) return null;

  const cards = [
    { label: '用户总数', value: String(stats.userCount), icon: '👤' },
    { label: '消息总数', value: String(stats.messageCount), icon: '💬' },
    { label: '当前在线', value: String(stats.onlineCount), icon: '🟢' },
    { label: '存储占用', value: formatBytes(stats.storageBytes), icon: '💾' },
  ];

  return (
    <section>
      <h2>系统统计</h2>
      <div className="stat-grid">
        {cards.map((c) => (
          <div key={c.label} className="stat-card">
            <div className="stat-icon">{c.icon}</div>
            <div className="stat-value">{c.value}</div>
            <div className="stat-label">{c.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SmtpTab() {
  const [form, setForm] = useState<SmtpConfig>({
    host: '',
    port: 587,
    user: '',
    pass: '',
    from: '',
    secure: false,
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const cfg = await adminApi.getSmtp();
        setForm({ ...form, ...cfg });
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await adminApi.updateSmtp({ ...form, port: Number(form.port), secure: Boolean(form.secure) });
      setMsg({ ok: true, text: 'SMTP 配置已保存' });
    } catch (err) {
      setMsg({ ok: false, text: prettyError(err) });
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await adminApi.testSmtp(testTo || undefined);
      setMsg({ ok: true, text: r.message || '测试邮件已发送' });
    } catch (err) {
      setMsg({ ok: false, text: prettyError(err) });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="empty-list"><Spinner /></div>;

  return (
    <section>
      <h2>SMTP 配置</h2>
      <form className="form admin-form" onSubmit={save}>
        <div className="row-2">
          <label>
            主机
            <input value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} />
          </label>
          <label>
            端口
            <input
              type="number"
              value={form.port}
              onChange={(e) => setForm({ ...form, port: Number(e.target.value) })}
            />
          </label>
        </div>
        <label>
          用户名
          <input value={form.user} onChange={(e) => setForm({ ...form, user: e.target.value })} />
        </label>
        <label>
          密码 / 授权码
          <input type="password" value={form.pass} onChange={(e) => setForm({ ...form, pass: e.target.value })} />
        </label>
        <label>
          发件人地址
          <input value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={form.secure}
            onChange={(e) => setForm({ ...form, secure: e.target.checked })}
          />
          使用 SSL/TLS
        </label>
        {msg && <div className={`inline-msg ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}
        <div className="auth-actions">
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? <Spinner size={14} /> : null}
            保存
          </button>
          <div className="row-2 inline-test">
            <input
              placeholder="接收测试邮件的邮箱"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
            />
            <button type="button" className="btn btn-secondary" onClick={test} disabled={busy}>
              发送测试邮件
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}

function TempTab() {
  const [list, setList] = useState<TempConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [viewing, setViewing] = useState<TempConversation | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setList(await adminApi.listTemp());
    } catch (e) {
      setErr(prettyError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openDetail = async (t: TempConversation) => {
    try {
      const detail = await adminApi.getTemp(t.tempId || t.temp_id!);
      setViewing(detail);
    } catch (e) {
      setErr(prettyError(e));
    }
  };

  return (
    <section>
      <div className="admin-toolbar">
        <h2>活跃临时对话</h2>
        <button className="btn btn-ghost" onClick={load}>
          刷新
        </button>
      </div>
      {err && <div className="inline-msg err">{err}</div>}
      {loading ? (
        <div className="empty-list"><Spinner /></div>
      ) : list.length === 0 ? (
        <div className="empty-list">当前没有进行中的临时对话</div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>参与者</th>
              <th>创建时间</th>
              <th>过期时间</th>
              <th>授权</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {list.map((t) => (
              <tr key={t.tempId || t.temp_id}>
                <td>
                  {(t.participants || []).map((p) => p.displayName || p.display_name || p.username).join(' / ')}
                </td>
                <td>{formatTime(t.createdAt || t.created_at)}</td>
                <td>
                  {t.expiresAt || t.expires_at ? (
                    <CountdownTimer expiresAt={t.expiresAt || t.expires_at!} />
                  ) : (
                    '-'
                  )}
                </td>
                <td>{t.authorized ? <Badge variant="online">是</Badge> : <Badge>否</Badge>}</td>
                <td>
                  <button className="btn btn-secondary btn-sm" onClick={() => openDetail(t)}>
                    查看消息
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Modal
        open={Boolean(viewing)}
        title="临时对话消息"
        onClose={() => setViewing(null)}
        wide
        footer={<button className="btn btn-secondary" onClick={() => setViewing(null)}>关闭</button>}
      >
        {viewing && (
          <div className="admin-temp-view">
            <div className="muted">
              参与者：
              {(viewing.participants || [])
                .map((p) => p.displayName || p.display_name || p.username)
                .join(' / ')}
            </div>
            <div className="temp-message-list">
              {(viewing.messages || []).map((m: TempMessage) => (
                <div key={m.id} className="temp-admin-msg">
                  <div className="muted">
                    {m.sender ? m.sender.displayName || m.sender.display_name || m.sender.username : '未知'} ·{' '}
                    {formatTime(m.createdAt || m.created_at)}
                  </div>
                  <div>{m.content}</div>
                </div>
              ))}
              {(viewing.messages || []).length === 0 && <div className="muted">暂无消息</div>}
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}

interface AiFormState {
  provider: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  isActive: boolean;
}

const EMPTY_FORM: AiFormState = {
  provider: 'qwen',
  name: '',
  baseUrl: AI_PRESETS.qwen.baseUrl,
  apiKey: '',
  model: AI_PRESETS.qwen.model,
  isActive: true,
};

function maskKey(key?: string): string {
  if (!key) return '—';
  if (key.length <= 8) return '••••';
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

function AiConfigsTab() {
  const [list, setList] = useState<AiConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [editing, setEditing] = useState<AiConfig | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<AiFormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      setList(await adminApi.listAiConfigs());
    } catch (e) {
      setErr(prettyError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pickPreset = (provider: string) => {
    const p = AI_PRESETS[provider] || AI_PRESETS.custom;
    setForm((f) => ({
      ...f,
      provider,
      baseUrl: p.baseUrl || f.baseUrl,
      model: p.model || f.model,
      name: f.name || p.name,
    }));
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, name: AI_PRESETS.qwen.name });
    setOpen(true);
  };

  const openEdit = (c: AiConfig) => {
    setEditing(c);
    setForm({
      provider: c.provider,
      name: c.name,
      baseUrl: c.baseUrl,
      apiKey: '',
      model: c.model,
      isActive: c.isActive,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.baseUrl.trim() || !form.model.trim()) {
      setErr('请填写名称、Base URL 和模型');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const payload: AiConfigPayload = {
        provider: form.provider,
        name: form.name.trim(),
        baseUrl: form.baseUrl.trim(),
        model: form.model.trim(),
        isActive: form.isActive,
      };
      if (form.apiKey.trim()) payload.apiKey = form.apiKey.trim();
      if (editing) {
        await adminApi.updateAiConfig(editing.id, payload);
      } else {
        await adminApi.createAiConfig(payload);
      }
      setOpen(false);
      await load();
    } catch (e) {
      setErr(prettyError(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (c: AiConfig) => {
    try {
      await adminApi.updateAiConfig(c.id, { isActive: !c.isActive });
      await load();
    } catch (e) {
      setErr(prettyError(e));
    }
  };

  const remove = async (c: AiConfig) => {
    if (!confirm(`确定删除 AI 配置「${c.name}」？`)) return;
    try {
      await adminApi.deleteAiConfig(c.id);
      await load();
    } catch (e) {
      setErr(prettyError(e));
    }
  };

  return (
    <section>
      <div className="admin-toolbar">
        <h2>AI 配置</h2>
        <button className="btn btn-primary" onClick={openAdd}>
          + 添加配置
        </button>
      </div>
      {err && <div className="inline-msg err">{err}</div>}
      {loading ? (
        <div className="empty-list">
          <Spinner />
        </div>
      ) : list.length === 0 ? (
        <div className="empty-list">尚未配置任何 AI 提供商</div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>名称</th>
              <th>Provider</th>
              <th>模型</th>
              <th>API Key</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.provider}</td>
                <td>{c.model}</td>
                <td className="muted">{maskKey(c.apiKey)}</td>
                <td>
                  {c.isActive ? <Badge variant="online">启用</Badge> : <Badge>禁用</Badge>}
                </td>
                <td>
                  <div className="group-file-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}>
                      编辑
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => toggleActive(c)}
                    >
                      {c.isActive ? '禁用' : '启用'}
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => remove(c)}>
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Modal
        open={open}
        title={editing ? '编辑 AI 配置' : '添加 AI 配置'}
        onClose={() => setOpen(false)}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setOpen(false)}>
              取消
            </button>
            <button className="btn btn-primary" onClick={save} disabled={busy}>
              {busy ? <Spinner size={14} /> : null}
              保存
            </button>
          </>
        }
      >
        <div className="form">
          <label>
            提供商
            <select
              value={form.provider}
              onChange={(e) => pickPreset(e.target.value)}
            >
              <option value="qwen">千问 (Qwen)</option>
              <option value="doubao">豆包 (Doubao)</option>
              <option value="deepseek">DeepSeek</option>
              <option value="zhipu">智谱 (GLM)</option>
              <option value="custom">自定义</option>
            </select>
          </label>
          <label>
            名称
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label>
            Base URL
            <input value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} />
          </label>
          <label>
            API Key {editing && <span className="muted">（留空则不修改）</span>}
            <input
              type="password"
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              placeholder={editing ? '保留原有 Key' : 'sk-...'}
            />
          </label>
          <label>
            模型
            <input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            启用该配置
          </label>
        </div>
      </Modal>
    </section>
  );
}
