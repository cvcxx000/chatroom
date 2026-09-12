import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { aiApi } from '../api/ai';
import { settingsApi } from '../api/settings';
import { usersApi } from '../api/users';
import { useAuth } from '../context/AuthContext';
import { useTheme, type ThemeMode } from '../context/ThemeContext';
import { Modal } from '../components/Modal';
import { Spinner } from '../components/Spinner';
import { UserAvatar } from '../components/UserAvatar';
import type { FontSize, UserAiConfig, UserSettings } from '../types';

type Section =
  | 'profile'
  | 'security'
  | 'ai'
  | 'theme'
  | 'notifications'
  | 'general'
  | 'about';

const SECTIONS: { key: Section; label: string; icon: string }[] = [
  { key: 'profile', label: '个人资料', icon: '👤' },
  { key: 'security', label: '账号安全', icon: '🔒' },
  { key: 'ai', label: 'AI 配置', icon: '🤖' },
  { key: 'theme', label: '主题外观', icon: '🎨' },
  { key: 'notifications', label: '通知设置', icon: '🔔' },
  { key: 'general', label: '通用设置', icon: '⚙️' },
  { key: 'about', label: '关于', icon: 'ℹ️' },
];

const AI_PROVIDER_OPTIONS = [
  { value: 'qwen', label: '通义千问' },
  { value: 'doubao', label: '豆包' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'zhipu', label: '智谱 GLM' },
  { value: 'custom', label: '自定义' },
];

const DEFAULT_SETTINGS: UserSettings = {
  theme: 'system',
  fontSize: 'medium',
  notifications: true,
  sound: true,
  tempReminder: true,
  enterToSend: true,
  messagePreview: true,
  autoDownload: false,
};

// ---------- Small building blocks ----------
function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      className={`switch ${checked ? 'on' : ''}`}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      <span className="switch-knob" />
    </button>
  );
}

function SettingRow({
  label,
  desc,
  control,
}: {
  label: string;
  desc?: string;
  control: React.ReactNode;
}) {
  return (
    <div className="setting-row">
      <div className="setting-row-text">
        <div className="setting-row-label">{label}</div>
        {desc && <div className="setting-row-desc">{desc}</div>}
      </div>
      <div className="setting-row-control">{control}</div>
    </div>
  );
}

function SectionCard({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="settings-section">
      <h2>{title}</h2>
      {desc && <p className="muted">{desc}</p>}
      <div className="settings-card">{children}</div>
    </div>
  );
}

// ---------- Main page ----------
export function Settings() {
  const navigate = useNavigate();
  const { user, logout, refreshMe } = useAuth();
  const { theme, setTheme } = useTheme();

  const [active, setActive] = useState<Section>('profile');
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  // profile
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // security
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdMsg, setPwdMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [savingPwd, setSavingPwd] = useState(false);

  // AI providers
  const [providers, setProviders] = useState<UserAiConfig[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [providerModal, setProviderModal] = useState<{ open: boolean; editing: UserAiConfig | null }>({
    open: false,
    editing: null,
  });
  const [provForm, setProvForm] = useState({
    name: '',
    provider: 'custom',
    baseUrl: '',
    apiKey: '',
    model: '',
  });

  // about
  const [updateMsg, setUpdateMsg] = useState('');

  // ---- Load settings once ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await settingsApi.getSettings();
        if (!cancelled && s) setSettings({ ...DEFAULT_SETTINGS, ...s });
      } catch {
        // keep defaults
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- Hydrate profile fields ----
  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || user.username || '');
      setEmail(user.email || '');
    }
  }, [user]);

  // ---- Apply font size globally ----
  useEffect(() => {
    const size = settings.fontSize || 'medium';
    document.documentElement.setAttribute('data-font-size', size);
  }, [settings.fontSize]);

  const patchSettings = async (patch: Partial<UserSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    try {
      await settingsApi.updateSettings(patch);
    } catch {
      // keep local state; backend may not exist yet
    }
  };

  const loadProviders = async () => {
    setLoadingProviders(true);
    try {
      const list = await aiApi.listUserProviders();
      setProviders(Array.isArray(list) ? list : []);
    } catch {
      setProviders([]);
    } finally {
      setLoadingProviders(false);
    }
  };

  useEffect(() => {
    if (active === 'ai') loadProviders();
  }, [active]);

  // ---- Profile handlers ----
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      const updated = await usersApi.updateProfile({ displayName, email });
      await refreshMe();
      setProfileMsg({ ok: true, text: '资料已保存' });
      void updated;
    } catch (err: any) {
      setProfileMsg({ ok: false, text: err?.message || '保存失败' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await usersApi.uploadAvatar(file);
      await refreshMe();
      setProfileMsg({ ok: true, text: '头像已更新' });
    } catch (err: any) {
      setProfileMsg({ ok: false, text: err?.message || '上传失败' });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // ---- Password handler ----
  const handleChangePwd = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMsg(null);
    if (!oldPwd || !newPwd) {
      setPwdMsg({ ok: false, text: '请填写旧密码和新密码' });
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdMsg({ ok: false, text: '两次输入的新密码不一致' });
      return;
    }
    if (newPwd.length < 6) {
      setPwdMsg({ ok: false, text: '新密码至少 6 位' });
      return;
    }
    setSavingPwd(true);
    try {
      await usersApi.changePassword({ oldPassword: oldPwd, newPassword: newPwd });
      setPwdMsg({ ok: true, text: '密码已修改' });
      setOldPwd('');
      setNewPwd('');
      setConfirmPwd('');
    } catch (err: any) {
      setPwdMsg({ ok: false, text: err?.message || '修改失败' });
    } finally {
      setSavingPwd(false);
    }
  };

  // ---- AI provider handlers ----
  const openNewProvider = () => {
    setProvForm({ name: '', provider: 'custom', baseUrl: '', apiKey: '', model: '' });
    setProviderModal({ open: true, editing: null });
  };
  const openEditProvider = (p: UserAiConfig) => {
    setProvForm({
      name: p.name || '',
      provider: p.provider || 'custom',
      baseUrl: p.baseUrl || p.base_url || '',
      apiKey: '',
      model: p.model || '',
    });
    setProviderModal({ open: true, editing: p });
  };
  const saveProvider = async () => {
    if (!provForm.name.trim() || !provForm.baseUrl.trim() || !provForm.model.trim()) {
      return;
    }
    const payload = {
      name: provForm.name.trim(),
      provider: provForm.provider,
      baseUrl: provForm.baseUrl.trim(),
      model: provForm.model.trim(),
      ...(provForm.apiKey ? { apiKey: provForm.apiKey } : {}),
    };
    try {
      if (providerModal.editing) {
        await aiApi.updateUserProvider(providerModal.editing.id, payload);
      } else {
        await aiApi.createUserProvider(payload);
      }
      setProviderModal({ open: false, editing: null });
      await loadProviders();
    } catch (err: any) {
      alert(err?.message || '保存失败');
    }
  };
  const deleteProvider = async (p: UserAiConfig) => {
    if (!window.confirm(`确定删除 AI 配置「${p.name}」？`)) return;
    try {
      await aiApi.deleteUserProvider(p.id);
      await loadProviders();
    } catch (err: any) {
      alert(err?.message || '删除失败');
    }
  };

  const doLogout = () => {
    logout();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="settings-page">
        <div className="full-loading">
          <Spinner size={28} />
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      {/* Mobile top bar */}
      <div className="settings-topbar">
        <button className="icon-btn settings-back" onClick={() => navigate(-1)} aria-label="返回">
          ←
        </button>
        <span className="settings-topbar-title">设置</span>
      </div>

      {/* Left menu */}
      <aside className="settings-nav">
        <div className="settings-nav-title">设置</div>
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            className={active === s.key ? 'active' : ''}
            onClick={() => setActive(s.key)}
          >
            <span className="settings-nav-icon">{s.icon}</span>
            <span>{s.label}</span>
          </button>
        ))}
      </aside>

      {/* Right content */}
      <main className="settings-content">
        {active === 'profile' && (
          <SectionCard title="个人资料" desc="修改你的头像、昵称和邮箱">
            <form className="form" onSubmit={handleSaveProfile}>
              <div className="profile-avatar-row">
                <UserAvatar
                  name={user?.displayName || user?.username || '?'}
                  src={user?.avatarUrl ?? user?.avatar_url ?? null}
                  size={64}
                />
                <div>
                  <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
                    上传头像
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={handleAvatarPick}
                  />
                  <div className="muted" style={{ marginTop: 6 }}>
                    JPG / PNG，最大 5MB
                  </div>
                </div>
              </div>
              <label>
                昵称
                <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </label>
              <label>
                邮箱
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </label>
              {profileMsg && (
                <div className={`inline-msg ${profileMsg.ok ? 'ok' : 'err'}`}>{profileMsg.text}</div>
              )}
              <div className="auth-actions">
                <button className="btn btn-primary" disabled={savingProfile}>
                  {savingProfile ? '保存中…' : '保存'}
                </button>
              </div>
            </form>
          </SectionCard>
        )}

        {active === 'security' && (
          <SectionCard title="账号安全" desc="定期修改密码可以提高账号安全性">
            <form className="form" onSubmit={handleChangePwd}>
              <label>
                旧密码
                <input
                  type="password"
                  value={oldPwd}
                  onChange={(e) => setOldPwd(e.target.value)}
                  autoComplete="current-password"
                />
              </label>
              <label>
                新密码
                <input
                  type="password"
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  autoComplete="new-password"
                />
              </label>
              <label>
                确认新密码
                <input
                  type="password"
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                  autoComplete="new-password"
                />
              </label>
              {pwdMsg && (
                <div className={`inline-msg ${pwdMsg.ok ? 'ok' : 'err'}`}>{pwdMsg.text}</div>
              )}
              <div className="auth-actions">
                <button className="btn btn-primary" disabled={savingPwd}>
                  {savingPwd ? '提交中…' : '修改密码'}
                </button>
              </div>
            </form>
          </SectionCard>
        )}

        {active === 'ai' && (
          <SectionCard title="AI 配置" desc="添加你自己的 AI 服务商，用于 AI 对话">
            <div className="ai-providers-toolbar">
              <button className="btn btn-primary btn-sm" onClick={openNewProvider}>
                + 添加服务商
              </button>
            </div>
            {loadingProviders ? (
              <div className="empty-list">加载中…</div>
            ) : providers.length === 0 ? (
              <div className="empty-list">还没有配置 AI 服务商，点击上方按钮添加</div>
            ) : (
              <div className="ai-provider-list">
                {providers.map((p) => (
                  <div key={p.id} className="ai-provider-item">
                    <div className="ai-provider-meta">
                      <div className="ai-provider-name">
                        {p.name}
                        <span className="badge">{p.provider}</span>
                      </div>
                      <div className="muted">{p.baseUrl || p.base_url}</div>
                      <div className="muted">模型：{p.model}</div>
                    </div>
                    <div className="ai-provider-actions">
                      <button className="btn btn-sm" onClick={() => openEditProvider(p)}>
                        编辑
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => deleteProvider(p)}>
                        删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {providerModal.open && (
              <Modal
                open={true}
                title={providerModal.editing ? '编辑 AI 服务商' : '添加 AI 服务商'}
                onClose={() => setProviderModal({ open: false, editing: null })}
                footer={
                  <>
                    <button
                      className="btn"
                      onClick={() => setProviderModal({ open: false, editing: null })}
                    >
                      取消
                    </button>
                    <button className="btn btn-primary" onClick={saveProvider}>
                      保存
                    </button>
                  </>
                }
              >
                <div className="form">
                  <label>
                    名称
                    <input
                      value={provForm.name}
                      onChange={(e) => setProvForm({ ...provForm, name: e.target.value })}
                      placeholder="例如：我的豆包"
                    />
                  </label>
                  <label>
                    服务商
                    <select
                      value={provForm.provider}
                      onChange={(e) => setProvForm({ ...provForm, provider: e.target.value })}
                    >
                      {AI_PROVIDER_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Base URL
                    <input
                      value={provForm.baseUrl}
                      onChange={(e) => setProvForm({ ...provForm, baseUrl: e.target.value })}
                      placeholder="https://api.example.com/v1"
                    />
                  </label>
                  <label>
                    API Key
                    <input
                      type="password"
                      value={provForm.apiKey}
                      onChange={(e) => setProvForm({ ...provForm, apiKey: e.target.value })}
                      placeholder={providerModal.editing ? '留空则不修改' : 'sk-...'}
                      autoComplete="off"
                    />
                  </label>
                  <label>
                    模型名
                    <input
                      value={provForm.model}
                      onChange={(e) => setProvForm({ ...provForm, model: e.target.value })}
                      placeholder="例如：doubao-pro-32k"
                    />
                  </label>
                </div>
              </Modal>
            )}
          </SectionCard>
        )}

        {active === 'theme' && (
          <SectionCard title="主题外观" desc="选择浅色、深色或跟随系统外观">
            <div className="theme-options">
              {(['light', 'dark', 'system'] as ThemeMode[]).map((m) => (
                <label key={m} className={`theme-card ${theme === m ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="theme"
                    checked={theme === m}
                    onChange={() => setTheme(m)}
                  />
                  <div className={`theme-preview preview-${m}`}>
                    <div className="theme-preview-window">
                      <div className="theme-preview-side" />
                      <div className="theme-preview-main" />
                    </div>
                  </div>
                  <div className="theme-card-label">
                    {m === 'light' ? '浅色' : m === 'dark' ? '深色' : '跟随系统'}
                  </div>
                </label>
              ))}
            </div>
          </SectionCard>
        )}

        {active === 'notifications' && (
          <SectionCard title="通知设置" desc="管理消息提醒方式">
            <SettingRow
              label="消息通知"
              desc="收到新消息时发送浏览器通知"
              control={
                <Switch
                  checked={!!settings.notifications}
                  onChange={(v) => patchSettings({ notifications: v })}
                />
              }
            />
            <SettingRow
              label="提示音"
              desc="收到消息时播放提示音"
              control={
                <Switch checked={!!settings.sound} onChange={(v) => patchSettings({ sound: v })} />
              }
            />
            <SettingRow
              label="临时对话提醒"
              desc="临时会话即将过期前提醒我"
              control={
                <Switch
                  checked={!!settings.tempReminder}
                  onChange={(v) => patchSettings({ tempReminder: v })}
                />
              }
            />
          </SectionCard>
        )}

        {active === 'general' && (
          <SectionCard title="通用设置" desc="调整输入与浏览体验">
            <div className="setting-row">
              <div className="setting-row-text">
                <div className="setting-row-label">字体大小</div>
                <div className="setting-row-desc">调整聊天与界面字体大小</div>
              </div>
              <div className="seg-group">
                {(['small', 'medium', 'large'] as FontSize[]).map((s) => (
                  <button
                    key={s}
                    className={(settings.fontSize || 'medium') === s ? 'active' : ''}
                    onClick={() => patchSettings({ fontSize: s })}
                  >
                    {s === 'small' ? '小' : s === 'medium' ? '中' : '大'}
                  </button>
                ))}
              </div>
            </div>
            <SettingRow
              label="Enter 发送消息"
              desc="按下回车键直接发送消息"
              control={
                <Switch
                  checked={!!settings.enterToSend}
                  onChange={(v) => patchSettings({ enterToSend: v })}
                />
              }
            />
            <SettingRow
              label="消息预览"
              desc="在会话列表中显示最后一条消息预览"
              control={
                <Switch
                  checked={!!settings.messagePreview}
                  onChange={(v) => patchSettings({ messagePreview: v })}
                />
              }
            />
            <SettingRow
              label="自动下载媒体"
              desc="自动加载聊天中的图片和文件"
              control={
                <Switch
                  checked={!!settings.autoDownload}
                  onChange={(v) => patchSettings({ autoDownload: v })}
                />
              }
            />
          </SectionCard>
        )}

        {active === 'about' && (
          <SectionCard title="关于" desc="版本信息与账号操作">
            <div className="about-row">
              <span>版本号</span>
              <span className="muted">v1.0.0</span>
            </div>
            <div className="about-row">
              <span>当前账号</span>
              <span className="muted">@{user?.username}</span>
            </div>
            <div className="about-actions">
              <button
                className="btn"
                onClick={() => {
                  setUpdateMsg('当前已是最新版本');
                  window.setTimeout(() => setUpdateMsg(''), 2500);
                }}
              >
                检查更新
              </button>
              {updateMsg && <span className="muted">{updateMsg}</span>}
              <button className="btn btn-danger" onClick={doLogout}>
                退出登录
              </button>
            </div>
          </SectionCard>
        )}
      </main>
    </div>
  );
}
