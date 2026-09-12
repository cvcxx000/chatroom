import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { aiApi } from '../api/ai';
import { settingsApi } from '../api/settings';
import { usersApi } from '../api/users';
import { quickRepliesApi } from '../api/quickReplies';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTheme, type ThemeMode } from '../context/ThemeContext';
import { Modal } from '../components/Modal';
import { Spinner } from '../components/Spinner';
import { UserAvatar } from '../components/UserAvatar';
import type {
  BlockedEntry,
  FontSize,
  LoginHistoryEntry,
  QuickReply,
  UserAiConfig,
  UserSettings,
} from '../types';
import '../styles/settings-extended.css';

type Section =
  | 'profile'
  | 'security'
  | 'notifications'
  | 'appearance'
  | 'privacy'
  | 'general'
  | 'ai';

const SECTIONS: { key: Section; label: string; icon: string }[] = [
  { key: 'profile', label: '个人资料', icon: '👤' },
  { key: 'security', label: '账号安全', icon: '🔒' },
  { key: 'notifications', label: '消息通知', icon: '🔔' },
  { key: 'appearance', label: '外观显示', icon: '🎨' },
  { key: 'privacy', label: '隐私安全', icon: '🛡️' },
  { key: 'general', label: '通用其他', icon: '⚙️' },
  { key: 'ai', label: 'AI 配置', icon: '🤖' },
];

const AI_PROVIDER_OPTIONS = [
  { value: 'qwen', label: '通义千问' },
  { value: 'doubao', label: '豆包' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'zhipu', label: '智谱 GLM' },
  { value: 'custom', label: '自定义' },
];

const THEME_COLORS: { value: string; label: string }[] = [
  { value: '#4f6ef7', label: '蓝' },
  { value: '#10b981', label: '绿' },
  { value: '#8b5cf6', label: '紫' },
  { value: '#f59e0b', label: '橙' },
  { value: '#ef4444', label: '红' },
];

const FONT_SIZES: { value: FontSize; label: string }[] = [
  { value: 'small', label: '小' },
  { value: 'medium', label: '中' },
  { value: 'large', label: '大' },
  { value: 'xlarge', label: '特大' },
];

const LOGIN_EXPIRY_OPTIONS = [
  { value: 24, label: '24 小时' },
  { value: 72, label: '72 小时' },
  { value: 168, label: '7 天' },
  { value: 720, label: '30 天' },
];

const NOTIFICATION_SOUNDS = [
  { value: 'default', label: '默认' },
  { value: 'dingdong', label: '叮咚' },
  { value: 'windchime', label: '风铃' },
  { value: 'bird', label: '鸟鸣' },
  { value: 'silent', label: '无声' },
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
  vibrate: false,
  auto_play_voice: true,
  auto_download_image: true,
  auto_download_file: false,
  group_mention_notify: true,
  friend_request_notify: true,
  system_announcement_notify: true,
  do_not_disturb: false,
  dnd_start: '22:00',
  dnd_end: '08:00',
  notification_sound: 'default',
  desktop_notifications: false,
  theme_color: '#4f6ef7',
  bubble_style: 'default',
  show_message_time: true,
  show_online_status: true,
  show_typing_status: true,
  read_receipts: true,
  avatar_shape: 'circle',
  compact_mode: false,
  animations_enabled: true,
  language: 'zh',
  two_factor_enabled: false,
  auto_login: false,
  login_expiry_hours: 168,
  who_can_add_me: 'everyone',
  who_can_see_online: 'everyone',
  who_can_see_profile: 'everyone',
  allow_stranger_temp_chat: true,
  allow_group_invite: true,
  e2e_encryption: false,
  screenshot_notification: false,
  anti_harassment: false,
  keyword_filter: '',
  show_ip_location: true,
  network_proxy: '',
  developer_mode: false,
  performance_monitor: false,
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

function SegGroup<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="seg-group wide">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          className={value === o.value ? 'active' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------- Performance monitor panel ----------
function PerfPanel({ visible }: { visible: boolean }) {
  const [fps, setFps] = useState(60);
  const [mem, setMem] = useState(0);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number>(performance.now());
  const framesRef = useRef(0);

  useEffect(() => {
    if (!visible) return;
    const loop = (now: number) => {
      framesRef.current += 1;
      const elapsed = now - lastRef.current;
      if (elapsed >= 1000) {
        setFps(Math.round((framesRef.current * 1000) / elapsed));
        framesRef.current = 0;
        lastRef.current = now;
        const nav = navigator as Navigator & { memory?: { usedJSHeapSize: number } };
        if (nav.memory) setMem(Math.round(nav.memory.usedJSHeapSize / 1024 / 1024));
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [visible]);

  if (!visible) return null;
  return (
    <div className="perf-panel">
      <div>FPS: {fps}</div>
      <div>内存: {mem} MB</div>
      <div>加载: {Math.round(performance.now() / 100) / 10}s</div>
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
  const [signature, setSignature] = useState('');
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // security
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdMsg, setPwdMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [savingPwd, setSavingPwd] = useState(false);

  // bind phone modal
  const [phoneModal, setPhoneModal] = useState(false);
  const [phone, setPhone] = useState('');
  const [phoneMsg, setPhoneMsg] = useState('');
  const [boundPhone, setBoundPhone] = useState<string>('');

  // login history / devices
  const [loginHistory, setLoginHistory] = useState<LoginHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // blocked list
  const [blockedList, setBlockedList] = useState<BlockedEntry[]>([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);

  // delete account modal
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteMsg, setDeleteMsg] = useState('');

  // feedback modal
  const [feedbackModal, setFeedbackModal] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState('');

  // toast-like inline message (shared)
  const [toast, setToast] = useState('');
  const showToast = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(''), 2500);
  };

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

  // quick replies
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [qrModal, setQrModal] = useState<{ open: boolean; editing: QuickReply | null }>({
    open: false,
    editing: null,
  });
  const [qrForm, setQrForm] = useState({ title: '', content: '', shortcut: '' });

  // storage estimate
  const [storageInfo, setStorageInfo] = useState<{ usage: number; quota: number } | null>(null);

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

  // ---- Apply theme color ----
  useEffect(() => {
    const c = (settings.theme_color as string) || '#4f6ef7';
    document.documentElement.style.setProperty('--primary', c);
  }, [settings.theme_color]);

  // ---- Apply animations off ----
  useEffect(() => {
    document.body.setAttribute(
      'data-animations-off',
      settings.animations_enabled === false ? 'true' : 'false',
    );
  }, [settings.animations_enabled]);

  // ---- Apply compact mode ----
  useEffect(() => {
    document.body.setAttribute('data-compact', settings.compact_mode ? 'true' : 'false');
  }, [settings.compact_mode]);

  // ---- Apply sidebar width ----
  useEffect(() => {
    const w =
      typeof settings.sidebar_width === 'number'
        ? settings.sidebar_width
        : Number(localStorage.getItem('sidebar-width') || 280);
    document.documentElement.style.setProperty('--sidebar-width', `${w}px`);
  }, [settings.sidebar_width]);

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

  const loadLoginHistory = async () => {
    setLoadingHistory(true);
    try {
      const list = (await api.get('/users/login-history')) as unknown as LoginHistoryEntry[];
      setLoginHistory(Array.isArray(list) ? list : []);
    } catch {
      setLoginHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadBlocked = async () => {
    setLoadingBlocked(true);
    try {
      const list = (await api.get('/users/blocked')) as unknown as BlockedEntry[];
      setBlockedList(Array.isArray(list) ? list : []);
    } catch {
      setBlockedList([]);
    } finally {
      setLoadingBlocked(false);
    }
  };

  const loadQuickReplies = async () => {
    try {
      const list = await quickRepliesApi.list();
      setQuickReplies(Array.isArray(list) ? list : []);
    } catch {
      setQuickReplies([]);
    }
  };

  const loadStorage = async () => {
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        setStorageInfo({ usage: est.usage || 0, quota: est.quota || 1 });
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (active === 'ai') loadProviders();
    if (active === 'security') loadLoginHistory();
    if (active === 'privacy') loadBlocked();
    if (active === 'general') {
      loadQuickReplies();
      loadStorage();
    }
  }, [active]);

  // ---- Profile handlers ----
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      await usersApi.updateProfile({ displayName, email });
      await refreshMe();
      setProfileMsg({ ok: true, text: '资料已保存' });
    } catch (err: any) {
      setProfileMsg({ ok: false, text: err?.message || '保存失败' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveSignature = async () => {
    try {
      await usersApi.updateStatus('online', signature);
      setProfileMsg({ ok: true, text: '个性签名已保存' });
    } catch (err: any) {
      setProfileMsg({ ok: false, text: err?.message || '保存失败' });
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

  // ---- Bind phone (mock) ----
  const submitPhone = () => {
    if (!/^1\d{10}$/.test(phone)) {
      setPhoneMsg('请输入正确的 11 位手机号');
      return;
    }
    setPhoneMsg('验证功能开发中，模拟绑定成功');
    setBoundPhone(phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'));
    window.setTimeout(() => {
      setPhoneModal(false);
      setPhoneMsg('');
      setPhone('');
    }, 1200);
  };

  // ---- Export personal data ----
  const exportData = () => {
    const data = {
      user: { id: user?.id, username: user?.username, displayName, email },
      settings,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chatroom-data-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('个人数据已导出');
  };

  // ---- Export chat backup (mock) ----
  const exportBackup = () => {
    const data = {
      type: 'chat-backup',
      owner: user?.username,
      exportedAt: new Date().toISOString(),
      conversations: [
        {
          id: 'demo-1',
          name: '示例会话',
          messages: [
            { content: '这是导出的示例聊天记录', at: new Date().toISOString() },
          ],
        },
      ],
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('聊天记录已导出');
  };

  // ---- Clear cache ----
  const clearCache = () => {
    const token = localStorage.getItem('token');
    localStorage.clear();
    if (token) localStorage.setItem('token', token);
    showToast('缓存已清除');
  };

  const clearLocalMessages = () => {
    if (!window.confirm('确定清除本地消息缓存？此操作不可恢复。')) return;
    const keys = Object.keys(localStorage).filter(
      (k) => k.startsWith('msg-') || k.startsWith('message-'),
    );
    keys.forEach((k) => localStorage.removeItem(k));
    showToast('本地消息缓存已清除');
  };

  // ---- Delete account (mock) ----
  const confirmDeleteAccount = () => {
    if (deleteConfirmText !== '注销') {
      setDeleteMsg('请输入「注销」二字以确认');
      return;
    }
    setDeleteMsg('账号注销申请已提交，7 天内可撤销');
    window.setTimeout(() => {
      setDeleteModal(false);
      setDeleteConfirmText('');
      setDeleteMsg('');
    }, 2000);
  };

  // ---- Unblock user ----
  const unblockUser = async (userId: string) => {
    try {
      await usersApi.unblockUser(userId);
      await loadBlocked();
      showToast('已解除拉黑');
    } catch {
      showToast('操作失败');
    }
  };

  // ---- Quick replies CRUD ----
  const openNewQr = () => {
    setQrForm({ title: '', content: '', shortcut: '' });
    setQrModal({ open: true, editing: null });
  };
  const openEditQr = (q: QuickReply) => {
    setQrForm({ title: q.title, content: q.content, shortcut: q.shortcut || '' });
    setQrModal({ open: true, editing: q });
  };
  const saveQr = async () => {
    if (!qrForm.title.trim() || !qrForm.content.trim()) return;
    try {
      if (qrModal.editing) {
        await quickRepliesApi.update(qrModal.editing.id, {
          title: qrForm.title,
          content: qrForm.content,
          shortcut: qrForm.shortcut || null,
        });
      } else {
        await quickRepliesApi.create({
          title: qrForm.title,
          content: qrForm.content,
          shortcut: qrForm.shortcut || null,
        });
      }
      setQrModal({ open: false, editing: null });
      await loadQuickReplies();
    } catch {
      showToast('保存失败');
    }
  };
  const deleteQr = async (q: QuickReply) => {
    if (!window.confirm(`删除快捷回复「${q.title}」？`)) return;
    try {
      await quickRepliesApi.remove(q.id);
      await loadQuickReplies();
    } catch {
      showToast('删除失败');
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

  // ---- Derived helpers ----
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const currentDevice = (() => {
    if (/iPhone|iPad/.test(ua)) return 'iOS 设备';
    if (/Android/.test(ua)) return 'Android 设备';
    if (/Windows/.test(ua)) return 'Windows';
    if (/Mac/.test(ua)) return 'macOS';
    if (/Linux/.test(ua)) return 'Linux';
    return '未知设备';
  })();

  const keywordCount = ((settings.keyword_filter as string) || '')
    .split(/[,，\n]/)
    .map((s) => s.trim())
    .filter(Boolean).length;

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

      {/* Mobile horizontal sub-nav */}
      <div className="settings-mobile-nav">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            className={active === s.key ? 'active' : ''}
            onClick={() => setActive(s.key)}
          >
            {s.icon} {s.label}
          </button>
        ))}
      </div>

      {/* Left menu (desktop) */}
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
        {toast && <div className="settings-banner ok">{toast}</div>}

        {/* ==================== 个人资料 ==================== */}
        {active === 'profile' && (
          <SectionCard title="个人资料" desc="修改你的头像、昵称、签名和邮箱">
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
                个性签名
                <input
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  placeholder="介绍一下自己吧"
                  maxLength={60}
                />
              </label>
              <div className="auth-actions" style={{ marginTop: 0 }}>
                <button type="button" className="btn btn-sm" onClick={handleSaveSignature}>
                  保存签名
                </button>
              </div>
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
                  {savingProfile ? '保存中…' : '保存资料'}
                </button>
              </div>
            </form>
          </SectionCard>
        )}

        {/* ==================== 账号安全 ==================== */}
        {active === 'security' && (
          <>
            <SectionCard title="修改密码" desc="定期修改密码可以提高账号安全性">
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

            <SectionCard title="手机绑定" desc="绑定手机号用于账号找回">
              <SettingRow
                label="绑定手机"
                desc={boundPhone ? `已绑定：${boundPhone}` : '未绑定'}
                control={
                  <button className="btn" onClick={() => setPhoneModal(true)}>
                    {boundPhone ? '更换' : '绑定'}
                  </button>
                }
              />
            </SectionCard>

            <SectionCard title="登录与安全" desc="两步验证、自动登录与会话有效期">
              <SettingRow
                label="两步验证"
                desc="开启后登录需要输入验证器动态码"
                control={
                  <Switch
                    checked={!!settings.two_factor_enabled}
                    onChange={(v) => patchSettings({ two_factor_enabled: v })}
                  />
                }
              />
              {settings.two_factor_enabled && (
                <div className="settings-banner">
                  请使用验证器 APP 扫描二维码
                  <div className="fake-qr" />
                </div>
              )}
              <SettingRow
                label="自动登录"
                desc="下次打开应用时自动登录"
                control={
                  <Switch
                    checked={!!settings.auto_login}
                    onChange={(v) => patchSettings({ auto_login: v })}
                  />
                }
              />
              <SettingRow
                label="登录有效期"
                desc="超过该时间需要重新登录"
                control={
                  <select
                    value={Number(settings.login_expiry_hours || 168)}
                    onChange={(e) => patchSettings({ login_expiry_hours: Number(e.target.value) })}
                  >
                    {LOGIN_EXPIRY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                }
              />
            </SectionCard>

            <SectionCard title="登录设备管理" desc={`当前设备：${currentDevice}`}>
              <div className="timeline">
                {loadingHistory ? (
                  <div className="empty-list">加载中…</div>
                ) : loginHistory.length === 0 ? (
                  <div className="empty-list">暂无历史记录</div>
                ) : (
                  loginHistory.map((h, idx) => (
                    <div key={h.id || idx} className="timeline-item">
                      <div className={`timeline-dot ${idx === 0 ? 'current' : ''}`} />
                      <div className="timeline-body">
                        <div className="timeline-title">
                          {h.deviceType || h.device_type || '未知设备'}
                          {idx === 0 && '（当前）'}
                        </div>
                        <div className="timeline-meta">
                          IP: {h.ipAddress || h.ip_address || '-'} · {h.location || '未知地点'}
                        </div>
                        <div className="timeline-meta">
                          {new Date(h.loginAt || h.login_at || '').toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </SectionCard>

            <SectionCard title="账号与数据" desc="导出、清理与注销">
              <SettingRow
                label="导出个人数据"
                desc="下载包含用户信息和设置的 JSON 文件"
                control={
                  <button className="btn" onClick={exportData}>
                    导出
                  </button>
                }
              />
              <SettingRow
                label="清除缓存"
                desc="清除本地缓存数据（保留登录态）"
                control={
                  <button className="btn" onClick={clearCache}>
                    清除
                  </button>
                }
              />
              <SettingRow
                label="隐私设置"
                desc="管理黑名单、可见性等隐私选项"
                control={
                  <button className="btn" onClick={() => setActive('privacy')}>
                    前往
                  </button>
                }
              />
              <SettingRow
                label="账号注销"
                desc="注销后 7 天内可撤销"
                control={
                  <button className="btn btn-danger-solid" onClick={() => setDeleteModal(true)}>
                    注销账号
                  </button>
                }
              />
            </SectionCard>
          </>
        )}

        {/* ==================== 消息通知 ==================== */}
        {active === 'notifications' && (
          <>
            <SectionCard title="消息提醒" desc="新消息到达时的提醒方式">
              <SettingRow
                label="新消息通知"
                desc="收到新消息时发送浏览器通知"
                control={
                  <Switch
                    checked={!!settings.notifications}
                    onChange={(v) => patchSettings({ notifications: v })}
                  />
                }
              />
              <SettingRow
                label="消息声音"
                desc="收到消息时播放提示音"
                control={
                  <Switch
                    checked={!!settings.sound}
                    onChange={(v) => patchSettings({ sound: v })}
                  />
                }
              />
              <SettingRow
                label="震动"
                desc="手机端收到消息时震动"
                control={
                  <Switch
                    checked={!!settings.vibrate}
                    onChange={(v) => patchSettings({ vibrate: v })}
                  />
                }
              />
              <SettingRow
                label="消息预览"
                desc="在通知中显示消息内容预览"
                control={
                  <Switch
                    checked={!!settings.messagePreview}
                    onChange={(v) => patchSettings({ messagePreview: v })}
                  />
                }
              />
              <SettingRow
                label="桌面通知"
                desc="浏览器全屏或最小化时弹出桌面通知"
                control={
                  <Switch
                    checked={!!settings.desktop_notifications}
                    onChange={async (v) => {
                      if (v && 'Notification' in window && Notification.permission === 'default') {
                        try {
                          await Notification.requestPermission();
                        } catch {
                          /* ignore */
                        }
                      }
                      patchSettings({ desktop_notifications: v });
                    }}
                  />
                }
              />
              <SettingRow
                label="通知铃声"
                desc="选择收到消息时的提示音"
                control={
                  <select
                    value={(settings.notification_sound as string) || 'default'}
                    onChange={(e) => patchSettings({ notification_sound: e.target.value as any })}
                  >
                    {NOTIFICATION_SOUNDS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                }
              />
            </SectionCard>

            <SectionCard title="提醒类型" desc="按类型细分提醒">
              <SettingRow
                label="群聊 @提醒"
                desc="群聊中被 @ 时提醒"
                control={
                  <Switch
                    checked={!!settings.group_mention_notify}
                    onChange={(v) => patchSettings({ group_mention_notify: v })}
                  />
                }
              />
              <SettingRow
                label="好友请求提醒"
                desc="收到好友申请时提醒"
                control={
                  <Switch
                    checked={!!settings.friend_request_notify}
                    onChange={(v) => patchSettings({ friend_request_notify: v })}
                  />
                }
              />
              <SettingRow
                label="系统公告提醒"
                desc="收到系统公告时提醒"
                control={
                  <Switch
                    checked={!!settings.system_announcement_notify}
                    onChange={(v) => patchSettings({ system_announcement_notify: v })}
                  />
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

            <SectionCard title="免打扰" desc="在指定时段内静音所有通知">
              <SettingRow
                label="免打扰总开关"
                desc="开启后在设定时段内不接收提醒"
                control={
                  <Switch
                    checked={!!settings.do_not_disturb}
                    onChange={(v) => patchSettings({ do_not_disturb: v })}
                  />
                }
              />
              {settings.do_not_disturb && (
                <div className="setting-row">
                  <div className="setting-row-text">
                    <div className="setting-row-label">免打扰时段</div>
                    <div className="setting-row-desc">
                      {settings.dnd_start} 至 {settings.dnd_end}
                    </div>
                  </div>
                  <div className="time-row">
                    <input
                      type="time"
                      value={(settings.dnd_start as string) || '22:00'}
                      onChange={(e) => patchSettings({ dnd_start: e.target.value })}
                    />
                    <span className="muted">至</span>
                    <input
                      type="time"
                      value={(settings.dnd_end as string) || '08:00'}
                      onChange={(e) => patchSettings({ dnd_end: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </SectionCard>

            <SectionCard title="输入与媒体" desc="发送与自动下载行为">
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
                label="自动播放语音"
                desc="收到语音消息时自动播放"
                control={
                  <Switch
                    checked={!!settings.auto_play_voice}
                    onChange={(v) => patchSettings({ auto_play_voice: v })}
                  />
                }
              />
              <SettingRow
                label="自动下载图片"
                desc="聊天中自动加载图片"
                control={
                  <Switch
                    checked={!!settings.auto_download_image}
                    onChange={(v) => patchSettings({ auto_download_image: v })}
                  />
                }
              />
              <SettingRow
                label="自动下载文件"
                desc="聊天中自动下载文件"
                control={
                  <Switch
                    checked={!!settings.auto_download_file}
                    onChange={(v) => patchSettings({ auto_download_file: v })}
                  />
                }
              />
            </SectionCard>
          </>
        )}

        {/* ==================== 外观显示 ==================== */}
        {active === 'appearance' && (
          <>
            <SectionCard title="主题模式" desc="选择浅色、深色或跟随系统外观">
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

            <SectionCard title="主题色" desc="选择应用主色调">
              <SettingRow
                label="主题色"
                desc="用于按钮、链接、选中态的强调色"
                control={
                  <div className="color-swatches">
                    {THEME_COLORS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        title={c.label}
                        aria-label={c.label}
                        className={`color-swatch ${settings.theme_color === c.value ? 'active' : ''}`}
                        style={{ background: c.value, color: c.value }}
                        onClick={() => patchSettings({ theme_color: c.value })}
                      />
                    ))}
                  </div>
                }
              />
            </SectionCard>

            <SectionCard title="文字与布局" desc="字号、紧凑模式与侧边栏">
              <div className="setting-row">
                <div className="setting-row-text">
                  <div className="setting-row-label">字体大小</div>
                  <div className="setting-row-desc">调整聊天与界面字体大小</div>
                </div>
                <div className="seg-group">
                  {FONT_SIZES.map((s) => (
                    <button
                      key={s.value}
                      className={(settings.fontSize || 'medium') === s.value ? 'active' : ''}
                      onClick={() => patchSettings({ fontSize: s.value })}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="setting-row">
                <div className="setting-row-text">
                  <div className="setting-row-label">侧边栏宽度</div>
                  <div className="setting-row-desc">
                    当前 {settings.sidebar_width || 280}px（240–360）
                  </div>
                </div>
                <div className="range-wrap">
                  <input
                    type="range"
                    min={240}
                    max={360}
                    step={4}
                    value={Number(settings.sidebar_width || 280)}
                    onChange={(e) => {
                      const w = Number(e.target.value);
                      localStorage.setItem('sidebar-width', String(w));
                      patchSettings({ sidebar_width: w });
                    }}
                  />
                  <span className="range-val">{settings.sidebar_width || 280}px</span>
                </div>
              </div>
              <SettingRow
                label="紧凑模式"
                desc="减小行高与间距，显示更多内容"
                control={
                  <Switch
                    checked={!!settings.compact_mode}
                    onChange={(v) => patchSettings({ compact_mode: v })}
                  />
                }
              />
              <SettingRow
                label="动画效果"
                desc="关闭后所有过渡与动画立即生效"
                control={
                  <Switch
                    checked={!!settings.animations_enabled}
                    onChange={(v) => patchSettings({ animations_enabled: v })}
                  />
                }
              />
            </SectionCard>

            <SectionCard title="消息外观" desc="气泡、头像与时间显示">
              <div className="setting-row">
                <div className="setting-row-text">
                  <div className="setting-row-label">聊天气泡样式</div>
                  <div className="setting-row-desc">选择消息气泡的圆角风格</div>
                </div>
                <div className="bubble-preview">
                  <div
                    className={`b ${settings.bubble_style || 'default'}`}
                    style={{ display: 'inline-block' }}
                  >
                    你好
                  </div>
                  <div
                    className={`b self ${settings.bubble_style || 'default'}`}
                    style={{ display: 'inline-block' }}
                  >
                    在吗
                  </div>
                </div>
              </div>
              <div className="setting-row">
                <div className="setting-row-text">
                  <div className="setting-row-label">气泡风格选择</div>
                </div>
                <SegGroup
                  value={(settings.bubble_style as string) || 'default'}
                  options={[
                    { value: 'default', label: '默认' },
                    { value: 'rounded', label: '圆角' },
                    { value: 'square', label: '方形' },
                  ]}
                  onChange={(v) => patchSettings({ bubble_style: v as any })}
                />
              </div>
              <div className="setting-row">
                <div className="setting-row-text">
                  <div className="setting-row-label">头像形状</div>
                </div>
                <div className="avatar-shape-preview">
                  {(['circle', 'square'] as const).map((s) => (
                    <div
                      key={s}
                      className={`preview-avatar ${s} ${settings.avatar_shape === s ? 'active' : ''}`}
                      onClick={() => patchSettings({ avatar_shape: s })}
                    >
                      {s === 'circle' ? '○' : '■'}
                    </div>
                  ))}
                </div>
              </div>
              <SettingRow
                label="消息时间"
                desc="在消息上方显示发送时间"
                control={
                  <Switch
                    checked={!!settings.show_message_time}
                    onChange={(v) => patchSettings({ show_message_time: v })}
                  />
                }
              />
              <SettingRow
                label="在线状态"
                desc="在会话列表与头像旁显示在线状态"
                control={
                  <Switch
                    checked={!!settings.show_online_status}
                    onChange={(v) => patchSettings({ show_online_status: v })}
                  />
                }
              />
              <SettingRow
                label="输入状态"
                desc="对方正在输入时显示「正在输入…」"
                control={
                  <Switch
                    checked={!!settings.show_typing_status}
                    onChange={(v) => patchSettings({ show_typing_status: v })}
                  />
                }
              />
              <SettingRow
                label="已读回执"
                desc="消息被对方阅读后显示已读标记（隐私分类中也可调整）"
                control={
                  <Switch
                    checked={!!settings.read_receipts}
                    onChange={(v) => patchSettings({ read_receipts: v })}
                  />
                }
              />
            </SectionCard>

            <SectionCard title="语言" desc="界面语言选择">
              <div className="setting-row">
                <div className="setting-row-text">
                  <div className="setting-row-label">语言</div>
                  <div className="setting-row-desc">切换后需刷新页面生效</div>
                </div>
                <SegGroup
                  value={(settings.language as string) || 'zh'}
                  options={[
                    { value: 'zh', label: '中文' },
                    { value: 'en', label: 'English' },
                  ]}
                  onChange={(v) => {
                    patchSettings({ language: v as any });
                    showToast('语言将在刷新后生效');
                  }}
                />
              </div>
            </SectionCard>
          </>
        )}

        {/* ==================== 隐私安全 ==================== */}
        {active === 'privacy' && (
          <>
            <SectionCard title="黑名单管理" desc="被拉黑的用户无法给你发消息">
              {loadingBlocked ? (
                <div className="empty-list">加载中…</div>
              ) : blockedList.length === 0 ? (
                <div className="empty-list">黑名单为空</div>
              ) : (
                <div className="mini-list">
                  {blockedList.map((b) => {
                    const u = b.user || b.blockedUser;
                    return (
                      <div key={b.id} className="mini-list-item">
                        <UserAvatar
                          name={u?.displayName || u?.username || '?'}
                          src={u?.avatarUrl || u?.avatar_url || null}
                          size={36}
                        />
                        <div className="meta">
                          <div className="name">{u?.displayName || u?.username || '未知用户'}</div>
                          <div className="sub">
                            拉黑于 {new Date(b.createdAt || b.created_at || '').toLocaleString()}
                          </div>
                        </div>
                        <button
                          className="btn btn-sm"
                          onClick={() =>
                            unblockUser(b.blockedUserId || b.blocked_user_id || u?.id || '')
                          }
                        >
                          解除拉黑
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>

            <SectionCard title="谁可以…" desc="控制他人与你互动的权限">
              <div className="setting-row">
                <div className="setting-row-text">
                  <div className="setting-row-label">加我为好友</div>
                </div>
                <SegGroup
                  value={(settings.who_can_add_me as string) || 'everyone'}
                  options={[
                    { value: 'everyone', label: '所有人' },
                    { value: 'friends_of_friends', label: '好友的好友' },
                    { value: 'nobody', label: '无人' },
                  ]}
                  onChange={(v) => patchSettings({ who_can_add_me: v as any })}
                />
              </div>
              <div className="setting-row">
                <div className="setting-row-text">
                  <div className="setting-row-label">看我的在线状态</div>
                </div>
                <SegGroup
                  value={(settings.who_can_see_online as string) || 'everyone'}
                  options={[
                    { value: 'everyone', label: '所有人' },
                    { value: 'friends', label: '仅好友' },
                    { value: 'nobody', label: '无人' },
                  ]}
                  onChange={(v) => patchSettings({ who_can_see_online: v as any })}
                />
              </div>
              <div className="setting-row">
                <div className="setting-row-text">
                  <div className="setting-row-label">看我的资料</div>
                </div>
                <SegGroup
                  value={(settings.who_can_see_profile as string) || 'everyone'}
                  options={[
                    { value: 'everyone', label: '所有人' },
                    { value: 'friends', label: '仅好友' },
                    { value: 'nobody', label: '无人' },
                  ]}
                  onChange={(v) => patchSettings({ who_can_see_profile: v as any })}
                />
              </div>
              <SettingRow
                label="允许陌生人临时对话"
                desc="陌生人可通过临时会话与你交流"
                control={
                  <Switch
                    checked={!!settings.allow_stranger_temp_chat}
                    onChange={(v) => patchSettings({ allow_stranger_temp_chat: v })}
                  />
                }
              />
              <SettingRow
                label="允许群聊邀请"
                desc="非好友可邀请你加入群聊"
                control={
                  <Switch
                    checked={!!settings.allow_group_invite}
                    onChange={(v) => patchSettings({ allow_group_invite: v })}
                  />
                }
              />
              <SettingRow
                label="已读回执"
                desc="与外观分类中的「已读回执」为同一开关"
                control={
                  <Switch
                    checked={!!settings.read_receipts}
                    onChange={(v) => patchSettings({ read_receipts: v })}
                  />
                }
              />
            </SectionCard>

            <SectionCard title="临时对话授权" desc="管理临时对话的访问授权">
              <div className="settings-banner">当前没有待授权的临时对话</div>
              <button
                className="btn btn-danger-solid"
                onClick={() => showToast('已清除所有临时对话授权')}
              >
                清除所有临时对话授权
              </button>
            </SectionCard>

            <SectionCard title="消息安全" desc="加密、防骚扰与过滤">
              <SettingRow
                label="端到端加密"
                desc="开启后消息在传输前加密"
                control={
                  <Switch
                    checked={!!settings.e2e_encryption}
                    onChange={(v) => patchSettings({ e2e_encryption: v })}
                  />
                }
              />
              {settings.e2e_encryption && (
                <div className="settings-banner ok">
                  端到端加密已启用，消息将在传输前加密
                </div>
              )}
              <SettingRow
                label="截图通知"
                desc="对方截图时通知我"
                control={
                  <Switch
                    checked={!!settings.screenshot_notification}
                    onChange={(v) => patchSettings({ screenshot_notification: v })}
                  />
                }
              />
              <SettingRow
                label="防骚扰模式"
                desc="自动拦截包含敏感词的消息"
                control={
                  <Switch
                    checked={!!settings.anti_harassment}
                    onChange={(v) => patchSettings({ anti_harassment: v })}
                  />
                }
              />
              <div className="setting-row">
                <div className="setting-row-text">
                  <div className="setting-row-label">关键词过滤</div>
                  <div className="setting-row-desc">已添加 {keywordCount} 个过滤关键词</div>
                </div>
                <textarea
                  className="full"
                  rows={3}
                  placeholder={'每行或用逗号分隔，例如：\n广告\n推广\n中奖'}
                  value={(settings.keyword_filter as string) || ''}
                  onChange={(e) => patchSettings({ keyword_filter: e.target.value })}
                />
              </div>
              <SettingRow
                label="显示 IP 属地"
                desc="在消息下方显示发送者 IP 属地"
                control={
                  <Switch
                    checked={settings.show_ip_location !== false}
                    onChange={(v) => patchSettings({ show_ip_location: v })}
                  />
                }
              />
            </SectionCard>

            <SectionCard title="数据清除" desc="清理本地缓存的聊天数据">
              <SettingRow
                label="清除本地消息"
                desc="删除浏览器中缓存的历史消息"
                control={
                  <button className="btn btn-danger-solid" onClick={clearLocalMessages}>
                    清除
                  </button>
                }
              />
            </SectionCard>

            <SectionCard title="关于" desc="版本信息与账号操作">
              <div className="about-row">
                <span>版本号</span>
                <span className="muted">v1.0.0</span>
              </div>
              <div className="about-row">
                <span>开源地址</span>
                <a
                  className="about-link"
                  href="https://github.com/example/chatroom"
                  target="_blank"
                  rel="noreferrer"
                >
                  github.com/example/chatroom
                </a>
              </div>
              <div className="about-row">
                <span>当前账号</span>
                <span className="muted">@{user?.username}</span>
              </div>
              <div className="about-actions">
                <button
                  className="btn"
                  onClick={() => {
                    showToast('当前已是最新版本');
                  }}
                >
                  检查更新
                </button>
                <button className="btn btn-danger" onClick={doLogout}>
                  退出登录
                </button>
              </div>
            </SectionCard>
          </>
        )}

        {/* ==================== 通用其他 ==================== */}
        {active === 'general' && (
          <>
            <SectionCard title="快捷回复" desc="管理常用短语，聊天时一键发送">
              <div className="ai-providers-toolbar">
                <button className="btn btn-primary btn-sm" onClick={openNewQr}>
                  + 添加快捷回复
                </button>
              </div>
              {quickReplies.length === 0 ? (
                <div className="empty-list">还没有快捷回复</div>
              ) : (
                <div className="mini-list">
                  {quickReplies.map((q) => (
                    <div key={q.id} className="mini-list-item">
                      <div className="meta">
                        <div className="name">
                          {q.title}
                          {q.shortcut && (
                            <span className="badge" style={{ marginLeft: 8 }}>
                              {q.shortcut}
                            </span>
                          )}
                        </div>
                        <div className="sub">{q.content}</div>
                      </div>
                      <button className="btn btn-sm" onClick={() => openEditQr(q)}>
                        编辑
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => deleteQr(q)}>
                        删除
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard title="会话管理" desc="置顶、归档与会话操作">
              <div className="settings-banner">在会话列表中长按或右键会话可置顶 / 归档</div>
              <SettingRow
                label="常用群聊置顶"
                desc="置顶后会话出现在列表顶部"
                control={<span className="muted">通过会话列表操作</span>}
              />
              <SettingRow
                label="会话归档管理"
                desc="查看与恢复已归档的会话"
                control={
                  <button
                    className="btn"
                    onClick={() => showToast('已打开归档会话管理')}
                  >
                    查看归档
                  </button>
                }
              />
              <SettingRow
                label="数据备份导出"
                desc="将聊天记录导出为 JSON 文件"
                control={
                  <button className="btn" onClick={exportBackup}>
                    导出
                  </button>
                }
              />
            </SectionCard>

            <SectionCard title="存储空间" desc="查看本地存储使用情况">
              {storageInfo ? (
                <div className="storage-meter">
                  <div className="muted" style={{ fontSize: 13 }}>
                    已使用 {(storageInfo.usage / 1024 / 1024).toFixed(2)} MB / 共{' '}
                    {(storageInfo.quota / 1024 / 1024 / 1024).toFixed(2)} GB
                  </div>
                  <div className="storage-bar">
                    <div
                      style={{
                        width: `${Math.min(
                          100,
                          (storageInfo.usage / storageInfo.quota) * 100,
                        )}%`,
                      }}
                    />
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <button className="btn" onClick={clearCache}>
                      清除缓存
                    </button>
                  </div>
                </div>
              ) : (
                <div className="muted">无法读取存储信息</div>
              )}
            </SectionCard>

            <SectionCard title="网络与开发" desc="代理与开发者选项">
              <label>
                网络代理地址
                <input
                  placeholder="http://proxy:port 或留空"
                  value={(settings.network_proxy as string) || ''}
                  onChange={(e) => patchSettings({ network_proxy: e.target.value })}
                  onBlur={() => showToast('代理设置将在重启后生效')}
                />
              </label>
              <SettingRow
                label="开发者模式"
                desc="开启后显示开发者信息与性能面板"
                control={
                  <Switch
                    checked={!!settings.developer_mode}
                    onChange={(v) => patchSettings({ developer_mode: v })}
                  />
                }
              />
              {settings.developer_mode && (
                <div className="settings-banner">
                  开发者模式已开启：API 请求日志、性能面板已解锁
                </div>
              )}
              <SettingRow
                label="性能监控"
                desc="在页面右下角显示 FPS / 内存面板"
                control={
                  <Switch
                    checked={!!settings.performance_monitor}
                    onChange={(v) => patchSettings({ performance_monitor: v })}
                  />
                }
              />
            </SectionCard>

            <SectionCard title="帮助与反馈" desc="常见问题与意见反馈">
              <div className="faq-item">
                <div className="faq-q">如何修改密码？</div>
                <div className="faq-a">进入「账号安全」分类，填写旧密码与新密码即可。</div>
              </div>
              <div className="faq-item">
                <div className="faq-q">消息会丢失吗？</div>
                <div className="faq-a">消息存储在服务端，重新登录后会自动同步。</div>
              </div>
              <div className="faq-item">
                <div className="faq-q">如何拉黑用户？</div>
                <div className="faq-a">在隐私安全分类的「黑名单管理」中查看与解除拉黑。</div>
              </div>
              <div className="faq-item">
                <div className="faq-q">如何切换主题？</div>
                <div className="faq-a">在外观显示分类中选择浅色 / 深色 / 跟随系统。</div>
              </div>
              <div style={{ marginTop: 12 }}>
                <button className="btn" onClick={() => setFeedbackModal(true)}>
                  提交反馈
                </button>
              </div>
            </SectionCard>

            <SectionCard title="关于" desc="检查应用更新">
              <div className="about-row">
                <span>当前版本</span>
                <span className="muted">v1.0.0</span>
              </div>
              <div className="about-actions">
                <button className="btn" onClick={() => showToast('当前已是最新版本')}>
                  检查更新
                </button>
              </div>
            </SectionCard>
          </>
        )}

        {/* ==================== AI 配置 ==================== */}
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
      </main>

      {/* ---- Phone bind modal ---- */}
      <Modal
        open={phoneModal}
        title="绑定手机号"
        onClose={() => setPhoneModal(false)}
        footer={
          <>
            <button className="btn" onClick={() => setPhoneModal(false)}>
              取消
            </button>
            <button className="btn btn-primary" onClick={submitPhone}>
              提交
            </button>
          </>
        }
      >
        <div className="form">
          <label>
            手机号
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="11 位手机号"
              maxLength={11}
            />
          </label>
          {phoneMsg && <div className="inline-msg ok">{phoneMsg}</div>}
        </div>
      </Modal>

      {/* ---- Delete account modal ---- */}
      <Modal
        open={deleteModal}
        title="注销账号"
        onClose={() => setDeleteModal(false)}
        footer={
          <>
            <button className="btn" onClick={() => setDeleteModal(false)}>
              取消
            </button>
            <button className="btn btn-danger-solid" onClick={confirmDeleteAccount}>
              确认注销
            </button>
          </>
        }
      >
        <div className="form">
          <div className="settings-banner warn">
            注销后 7 天内可撤销，超过 7 天数据将被永久删除。
          </div>
          <label>
            请输入「注销」二字以确认
            <input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="注销"
            />
          </label>
          {deleteMsg && <div className="inline-msg ok">{deleteMsg}</div>}
        </div>
      </Modal>

      {/* ---- Feedback modal ---- */}
      <Modal
        open={feedbackModal}
        title="提交反馈"
        onClose={() => setFeedbackModal(false)}
        footer={
          <>
            <button className="btn" onClick={() => setFeedbackModal(false)}>
              取消
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                if (!feedbackText.trim()) return;
                setFeedbackMsg('反馈已提交，感谢您的建议！');
                setFeedbackText('');
                window.setTimeout(() => {
                  setFeedbackModal(false);
                  setFeedbackMsg('');
                }, 1200);
              }}
            >
              提交
            </button>
          </>
        }
      >
        <div className="form">
          <label>
            反馈内容
            <textarea
              className="full"
              rows={5}
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="遇到的问题或建议…"
            />
          </label>
          {feedbackMsg && <div className="inline-msg ok">{feedbackMsg}</div>}
        </div>
      </Modal>

      {/* ---- Quick reply modal ---- */}
      <Modal
        open={qrModal.open}
        title={qrModal.editing ? '编辑快捷回复' : '添加快捷回复'}
        onClose={() => setQrModal({ open: false, editing: null })}
        footer={
          <>
            <button className="btn" onClick={() => setQrModal({ open: false, editing: null })}>
              取消
            </button>
            <button className="btn btn-primary" onClick={saveQr}>
              保存
            </button>
          </>
        }
      >
        <div className="form">
          <label>
            标题
            <input
              value={qrForm.title}
              onChange={(e) => setQrForm({ ...qrForm, title: e.target.value })}
              placeholder="例如：常用问候"
            />
          </label>
          <label>
            内容
            <textarea
              className="full"
              rows={3}
              value={qrForm.content}
              onChange={(e) => setQrForm({ ...qrForm, content: e.target.value })}
              placeholder="输入快捷回复内容"
            />
          </label>
          <label>
            快捷键（可选）
            <input
              value={qrForm.shortcut}
              onChange={(e) => setQrForm({ ...qrForm, shortcut: e.target.value })}
              placeholder="/hi"
            />
          </label>
        </div>
      </Modal>

      {/* Floating perf panel */}
      <PerfPanel visible={!!settings.performance_monitor} />
    </div>
  );
}
