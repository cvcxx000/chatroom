import { useEffect, useState } from 'react';
import { usersApi } from '../api/users';
import { friendsApi } from '../api/friends';
import type { User, UserStatus } from '../types';
import { Modal } from './Modal';
import { UserAvatar } from './UserAvatar';
import { Spinner } from './Spinner';
import { prettyError } from '../utils/format';

interface Props {
  open: boolean;
  user: User | null;
  isFriend?: boolean;
  isBlocked?: boolean;
  isSelf?: boolean;
  onClose: () => void;
  onSendMessage?: (userId: string) => void;
  onAtMention?: (user: User) => void;
  onChange?: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  online: '在线',
  away: '离开',
  busy: '忙碌',
  offline: '离线',
};

export function UserProfileModal({
  open,
  user,
  isFriend,
  isBlocked,
  isSelf,
  onClose,
  onSendMessage,
  onAtMention,
  onChange,
}: Props) {
  const [status, setStatus] = useState<UserStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open || !user) return;
    setStatus(null);
    setErr('');
    setLoading(true);
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

  const call = async (fn: () => Promise<unknown>, okText: string) => {
    setBusy(true);
    setErr('');
    try {
      await fn();
      onChange?.();
      onClose();
      window.alert(okText);
    } catch (e) {
      setErr(prettyError(e));
    } finally {
      setBusy(false);
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
          {customMsg && (
            <div className="profile-row">
              <span className="profile-row-label">个性签名</span>
              <span>{customMsg}</span>
            </div>
          )}
          {user.lastLoginAt && (
            <div className="profile-row">
              <span className="profile-row-label">最后上线</span>
              <span>{new Date(user.lastLoginAt).toLocaleString()}</span>
            </div>
          )}
          {user.email && (
            <div className="profile-row">
              <span className="profile-row-label">邮箱</span>
              <span>{user.email}</span>
            </div>
          )}
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
                onClick={() => call(() => usersApi.unblockUser(user.id), '已取消拉黑')}
              >
                取消拉黑
              </button>
            ) : (
              <button
                className="btn btn-ghost btn-danger-outline"
                disabled={busy}
                onClick={() => call(() => usersApi.blockUser(user.id), '已拉黑该用户')}
              >
                拉黑
              </button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
