import { useEffect, useState } from 'react';
import { usersApi } from '../api/users';
import { friendsApi } from '../api/friends';
import { reportsApi, type ReportReason } from '../api/reports';
import { conversationsApi } from '../api/conversations';
import { conversationSettingsApi } from '../api/conversationSettings';
import type { User, UserStatus } from '../types';
import { Modal } from './Modal';
import { UserAvatar } from './UserAvatar';
import { Spinner } from './Spinner';
import { prettyError } from '../utils/format';
import '../styles/userops.css';

interface Props {
  open: boolean;
  user: User | null;
  isFriend?: boolean;
  isBlocked?: boolean;
  isSelf?: boolean;
  /** 与该用户共同所在的群聊数量 */
  commonGroups?: number;
  onClose: () => void;
  onSendMessage?: (userId: string) => void;
  onAtMention?: (user: User) => void;
  onChange?: () => void;
  /** 拉黑 / 解除拉黑后回调，用于刷新主界面黑名单状态 */
  onBlockedChange?: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  online: '在线',
  away: '离开',
  busy: '忙碌',
  offline: '离线',
};

const REPORT_OPTIONS: Array<{ value: ReportReason; label: string; emoji: string }> = [
  { value: 'harassment', label: '骚扰', emoji: '🚫' },
  { value: 'advertising', label: '广告', emoji: '📢' },
  { value: 'abuse', label: '辱骂', emoji: '🤬' },
  { value: 'other', label: '其他', emoji: '📝' },
];

function formatJoinedAt(raw?: string): string {
  if (!raw) return '未设置';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '未设置';
  return d.toLocaleDateString();
}

export function UserProfileModal({
  open,
  user,
  isFriend,
  isBlocked,
  isSelf,
  commonGroups,
  onClose,
  onSendMessage,
  onAtMention,
  onChange,
  onBlockedChange,
}: Props) {
  const [status, setStatus] = useState<UserStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // 举报
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason>('harassment');
  const [reportDetail, setReportDetail] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const [reportDone, setReportDone] = useState(false);

  // 屏蔽消息（会话免打扰）
  const [muted, setMuted] = useState(false);
  const [muteBusy, setMuteBusy] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setStatus(null);
    setErr('');
    setLoading(true);
    setReportOpen(false);
    setReportReason('harassment');
    setReportDetail('');
    setReportDone(false);
    usersApi
      .getStatus(user.id)
      .then((s) => setStatus(s))
      .catch((e) => setErr(prettyError(e)))
      .finally(() => setLoading(false));
  }, [open, user?.id]);

  if (!user) return null;

  const displayName = user.displayName || user.display_name || user.username;
  const statusVal = status?.status ?? 'offline';
  const customMsg = status?.customMessage ?? status?.custom_message;
  const joinedAt = user.createdAt ?? user.created_at;
  const lastLogin = user.lastLoginAt ?? user.last_login_at;

  const call = async (fn: () => Promise<unknown>, okText: string, after?: () => void) => {
    setBusy(true);
    setErr('');
    try {
      await fn();
      onChange?.();
      after?.();
      onClose();
      window.alert(okText);
    } catch (e) {
      setErr(prettyError(e));
    } finally {
      setBusy(false);
    }
  };

  const submitReport = async () => {
    if (!user) return;
    setReportBusy(true);
    setErr('');
    try {
      await reportsApi.reportUser(user.id, reportReason, reportDetail.trim() || undefined);
      setReportDone(true);
    } catch (e) {
      setErr(prettyError(e));
    } finally {
      setReportBusy(false);
    }
  };

  // 屏蔽 / 取消屏蔽消息：先确保存在私聊会话，再切换 muted 设置
  const toggleMute = async () => {
    if (!user || muteBusy) return;
    setMuteBusy(true);
    setErr('');
    try {
      const conv = await conversationsApi.createPrivate(user.id);
      await conversationSettingsApi.updateSetting(conv.id, { muted: !muted });
      setMuted((m) => !m);
    } catch (e) {
      setErr(prettyError(e));
    } finally {
      setMuteBusy(false);
    }
  };

  return (
    <Modal open={open} title="用户资料" onClose={onClose}>
      <div className="profile-modal">
        <div className="profile-hero">
          <UserAvatar name={displayName} src={user.avatarUrl ?? user.avatar_url ?? null} size={72} status={statusVal} />
          <div className="profile-hero-meta">
            <div className="profile-name">{displayName}</div>
            <div className="muted">@{user.username}</div>
            <div className={`profile-status status-${statusVal}`}>
              ● {STATUS_LABEL[statusVal] || '离线'}
            </div>
          </div>
        </div>

        <div className="profile-rows">
          <div className="profile-row">
            <span className="profile-row-label">用户名</span>
            <span>@{user.username}</span>
          </div>
          <div className="profile-row">
            <span className="profile-row-label">状态</span>
            <span>{loading ? '加载中…' : STATUS_LABEL[statusVal]}</span>
          </div>
          <div className="profile-row">
            <span className="profile-row-label">个性签名</span>
            <span>{customMsg || '未设置'}</span>
          </div>
          <div className="profile-row">
            <span className="profile-row-label">加入时间</span>
            <span>{formatJoinedAt(joinedAt)}</span>
          </div>
          {typeof commonGroups === 'number' && (
            <div className="profile-row">
              <span className="profile-row-label">共同群聊</span>
              <span>{commonGroups} 个</span>
            </div>
          )}
          <div className="profile-row">
            <span className="profile-row-label">最后上线</span>
            <span>{lastLogin ? new Date(lastLogin).toLocaleString() : '未设置'}</span>
          </div>
          <div className="profile-row">
            <span className="profile-row-label">邮箱</span>
            <span>{user.email || '未设置'}</span>
          </div>
        </div>

        {err && <div className="form-error">{err}</div>}

        {!isSelf && (
          <div className="profile-actions">
            {onSendMessage && (
              <button
                className="btn btn-primary"
                onClick={() => {
                  onSendMessage(user.id);
                  onClose();
                }}
              >
                💬 发消息
              </button>
            )}
            {onAtMention && (
              <button
                className="btn btn-secondary"
                onClick={() => {
                  onAtMention(user);
                  onClose();
                }}
              >
                @ 提及
              </button>
            )}
            {isFriend ? (
              <button
                className="btn btn-ghost btn-danger-outline"
                disabled={busy}
                onClick={() => call(() => friendsApi.remove(user.id), '已删除好友')}
              >
                {busy ? <Spinner size={14} /> : null} 删除好友
              </button>
            ) : (
              <button
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => call(() => friendsApi.sendRequest(user.id), '好友请求已发送')}
              >
                {busy ? <Spinner size={14} /> : null} 加好友
              </button>
            )}
            {isBlocked ? (
              <button
                className="btn btn-ghost"
                disabled={busy}
                onClick={() =>
                  call(() => usersApi.unblockUser(user.id), '已取消拉黑', () => onBlockedChange?.())
                }
              >
                取消拉黑
              </button>
            ) : (
              <button
                className="btn btn-ghost btn-danger-outline"
                disabled={busy}
                onClick={() =>
                  call(() => usersApi.blockUser(user.id), '已拉黑该用户', () => onBlockedChange?.())
                }
              >
                拉黑
              </button>
            )}
            {/* 屏蔽消息（会话免打扰，不删除好友） */}
            {isFriend && (
              <button
                className={`btn btn-ghost ${muted ? 'muted-on' : ''}`}
                disabled={muteBusy}
                onClick={() => void toggleMute()}
              >
                {muteBusy ? <Spinner size={14} /> : null}
                {muted ? '🔕 取消屏蔽消息' : '🔔 屏蔽消息'}
              </button>
            )}
            {/* 举报用户（仅非自己） */}
            <button
              className="btn btn-ghost btn-danger-outline"
              disabled={busy}
              onClick={() => setReportOpen(true)}
            >
              🚩 举报用户
            </button>
          </div>
        )}
      </div>

      {/* 举报弹窗 */}
      <Modal
        open={reportOpen}
        title="举报用户"
        onClose={() => !reportBusy && setReportOpen(false)}
      >
        {reportDone ? (
          <div className="report-done">
            <div className="report-done-icon">✅</div>
            <p>举报已提交，我们会尽快处理</p>
            <button className="btn btn-primary" onClick={() => setReportOpen(false)}>
              知道了
            </button>
          </div>
        ) : (
          <div className="report-form">
            <div className="report-reasons">
              {REPORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`report-reason-chip ${reportReason === opt.value ? 'active' : ''}`}
                  onClick={() => setReportReason(opt.value)}
                >
                  <span>{opt.emoji}</span>
                  {opt.label}
                </button>
              ))}
            </div>
            <label className="report-detail-label">详细说明（可选）</label>
            <textarea
              className="report-detail-textarea"
              placeholder="补充描述违规行为，有助于我们更快处理"
              value={reportDetail}
              maxLength={500}
              onChange={(e) => setReportDetail(e.target.value)}
            />
            {err && <div className="form-error">{err}</div>}
            <div className="report-actions">
              <button className="btn btn-ghost" onClick={() => setReportOpen(false)} disabled={reportBusy}>
                取消
              </button>
              <button className="btn btn-primary" onClick={() => void submitReport()} disabled={reportBusy}>
                {reportBusy ? <Spinner size={14} /> : null} 提交举报
              </button>
            </div>
          </div>
        )}
      </Modal>
    </Modal>
  );
}
