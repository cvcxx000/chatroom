import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { Conversation, Friend, GroupAnnouncement, GroupFile, GroupQrCode, Message, User } from '../types';
import { conversationsApi } from '../api/conversations';
import { UserAvatar } from './UserAvatar';
import { Modal } from './Modal';
import { Spinner } from './Spinner';
import { MediaGallery } from './MediaGallery';
import { prettyError } from '../utils/format';

interface Props {
  conversation: Conversation;
  friends: Friend[];
  messages: Message[];
  files: GroupFile[];
  myId?: string;
  onChanged: () => void;
  onLeave: () => void;
  onOpenUserProfile: (user: User) => void;
  onDownloadFile?: (fileName: string | null, url: string | null) => void;
  onPreviewImage?: (src: string) => void;
}

export function GroupInfoPanel({
  conversation,
  friends,
  messages,
  files,
  myId,
  onChanged,
  onLeave,
  onOpenUserProfile,
  onDownloadFile,
  onPreviewImage,
}: Props) {
  const members = conversation.members || [];
  const me = members.find((m) => (m.userId ?? m.user_id) === myId);
  const isOwner = (conversation.createdBy ?? conversation.created_by) === myId;
  const isAdmin = isOwner || me?.role === 'admin';

  const [tab, setTab] = useState<'members' | 'media'>('members');
  const [announcement, setAnnouncement] = useState<string>('');
  const [loadingAnn, setLoadingAnn] = useState(false);
  const [editingAnn, setEditingAnn] = useState(false);
  const [annDraft, setAnnDraft] = useState('');
  const [savingAnn, setSavingAnn] = useState(false);

  const [groupName, setGroupName] = useState(conversation.name || '');
  const [savingName, setSavingName] = useState(false);

  const [myNick, setMyNick] = useState('');
  const [nickOpen, setNickOpen] = useState(false);
  const [nickDraft, setNickDraft] = useState('');
  const [savingNick, setSavingNick] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);

  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState('');
  const [transferring, setTransferring] = useState(false);

  const [qrOpen, setQrOpen] = useState(false);
  const [qrData, setQrData] = useState<string>('');
  const [qrLoading, setQrLoading] = useState(false);
  const [qrErr, setQrErr] = useState('');

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLoadingAnn(true);
    conversationsApi
      .getAnnouncement(conversation.id)
      .then((a: GroupAnnouncement) => {
        const text = a.announcement ?? a.announcementText ?? a.content ?? '';
        setAnnouncement(text || '');
        setAnnDraft(text || '');
      })
      .catch(() => setAnnouncement(''))
      .finally(() => setLoadingAnn(false));
  }, [conversation.id]);

  const saveAnnouncement = async () => {
    setSavingAnn(true);
    try {
      const a = await conversationsApi.setAnnouncement(conversation.id, annDraft);
      setAnnouncement(a.announcement ?? a.announcementText ?? a.content ?? annDraft);
      setEditingAnn(false);
    } catch (e) {
      window.alert(prettyError(e));
    } finally {
      setSavingAnn(false);
    }
  };

  const saveName = async () => {
    const name = groupName.trim();
    if (!name || name === conversation.name) return;
    setSavingName(true);
    try {
      await conversationsApi.rename(conversation.id, name);
      onChanged();
    } catch (e) {
      window.alert(prettyError(e));
    } finally {
      setSavingName(false);
    }
  };

  const saveNick = async () => {
    setSavingNick(true);
    try {
      await conversationsApi.setNickname(conversation.id, nickDraft.trim());
      setMyNick(nickDraft.trim());
      setNickOpen(false);
    } catch (e) {
      window.alert(prettyError(e));
    } finally {
      setSavingNick(false);
    }
  };

  const addMembers = async () => {
    if (picked.length === 0) return;
    setAdding(true);
    try {
      await conversationsApi.addMembers(conversation.id, picked);
      setAddOpen(false);
      setPicked([]);
      onChanged();
    } catch (e) {
      window.alert(prettyError(e));
    } finally {
      setAdding(false);
    }
  };

  const kickMember = async (uid: string, name: string) => {
    if (!window.confirm(`确定将 ${name} 移出群聊？`)) return;
    try {
      await conversationsApi.removeMember(conversation.id, uid);
      onChanged();
    } catch (e) {
      window.alert(prettyError(e));
    }
  };

  const doTransfer = async () => {
    if (!transferTarget) return;
    setTransferring(true);
    try {
      await conversationsApi.transferOwner(conversation.id, transferTarget);
      setTransferOpen(false);
      onChanged();
    } catch (e) {
      window.alert(prettyError(e));
    } finally {
      setTransferring(false);
    }
  };

  const doLeave = async () => {
    if (!window.confirm('确定退出该群聊？')) return;
    setBusy(true);
    try {
      await conversationsApi.leaveGroup(conversation.id);
      onLeave();
    } catch (e) {
      window.alert(prettyError(e));
    } finally {
      setBusy(false);
    }
  };

  const openQr = async () => {
    setQrOpen(true);
    setQrErr('');
    setQrData('');
    setQrLoading(true);
    try {
      const q: GroupQrCode = await conversationsApi.getQrCode(conversation.id);
      const text = q.url || `${window.location.origin}/join?token=${q.token}`;
      setQrData(await QRCode.toDataURL(text, { width: 220, margin: 2 }));
    } catch (e) {
      setQrErr(prettyError(e));
    } finally {
      setQrLoading(false);
    }
  };

  // friends not already in the group
  const memberIds = new Set(members.map((m) => m.userId ?? m.user_id));
  const addableFriends = friends.filter((f) => {
    const u = f.user || f.friend;
    return u && !memberIds.has(u.id);
  });

  return (
    <div className="right-panel-body group-panel">
      <div className="share-block">
        <button className="btn btn-primary btn-block" onClick={openQr}>
          🔳 群二维码
        </button>
      </div>

      {/* group name */}
      <div className="gp-section">
        <div className="section-title">群名称</div>
        <div className="gp-name-row">
          <input
            className="gp-name-input"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            onBlur={saveName}
            disabled={!isOwner || savingName}
          />
          {savingName && <Spinner size={14} />}
        </div>
      </div>

      {/* announcement */}
      <div className="gp-section">
        <div className="section-title">群公告</div>
        {loadingAnn ? (
          <div className="muted">加载中…</div>
        ) : editingAnn && isAdmin ? (
          <div className="gp-ann-edit">
            <textarea
              className="gp-ann-textarea"
              rows={4}
              value={annDraft}
              onChange={(e) => setAnnDraft(e.target.value)}
            />
            <div className="gp-row-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => setEditingAnn(false)}>
                取消
              </button>
              <button className="btn btn-primary btn-sm" onClick={saveAnnouncement} disabled={savingAnn}>
                {savingAnn ? <Spinner size={14} /> : null} 保存
              </button>
            </div>
          </div>
        ) : (
          <div className="gp-announcement">
            <div className="gp-ann-text">{announcement || '暂无群公告'}</div>
            {isAdmin && (
              <button className="btn btn-ghost btn-sm" onClick={() => setEditingAnn(true)}>
                ✏️ 编辑公告
              </button>
            )}
          </div>
        )}
      </div>

      {/* my nickname */}
      <div className="gp-section">
        <div className="section-title">我在本群的昵称</div>
        <button className="btn btn-secondary btn-block" onClick={() => setNickOpen(true)}>
          {myNick ? `群昵称：${myNick}` : '设置群昵称'}
        </button>
      </div>

      {/* tabs */}
      <div className="gp-tabs">
        <button className={tab === 'members' ? 'active' : ''} onClick={() => setTab('members')}>
          成员 ({members.length})
        </button>
        <button className={tab === 'media' ? 'active' : ''} onClick={() => setTab('media')}>
          媒体文件
        </button>
      </div>

      {tab === 'members' && (
        <div className="members-block">
          {isAdmin && (
            <button className="btn btn-secondary btn-block gp-add-btn" onClick={() => setAddOpen(true)}>
              ＋ 添加成员
            </button>
          )}
          {members.map((m) => {
            const uid = m.userId ?? m.user_id;
            const u: User = m.user || {
              id: uid || '',
              username: m.username || '',
              displayName: m.displayName ?? m.display_name,
              avatarUrl: m.avatarUrl ?? m.avatar_url,
            };
            const isMe = uid === myId;
            const mIsOwner = (conversation.createdBy ?? conversation.created_by) === uid;
            return (
              <div key={uid} className="member-row" onClick={() => !isMe && onOpenUserProfile(u)}>
                <UserAvatar name={u.username} size={32} src={u.avatarUrl ?? u.avatar_url ?? null} />
                <div className="member-row-meta">
                  <div className="member-row-name">
                    {u.displayName || u.display_name || u.username}
                    {mIsOwner && <span className="role-tag owner">群主</span>}
                    {!mIsOwner && m.role === 'admin' && <span className="role-tag">管理员</span>}
                  </div>
                  <div className="muted">@{u.username}</div>
                </div>
                {isAdmin && !isMe && !mIsOwner && (
                  <button
                    className="icon-btn member-kick"
                    title="移出群聊"
                    onClick={(e) => {
                      e.stopPropagation();
                      kickMember(uid || '', u.displayName || u.username);
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'media' && (
        <MediaGallery
          messages={messages}
          files={files}
          onPreviewImage={onPreviewImage}
          onDownloadFile={onDownloadFile}
        />
      )}

      {/* owner actions */}
      {isOwner && (
        <div className="gp-section">
          <button className="btn btn-secondary btn-block" onClick={() => setTransferOpen(true)}>
            👑 转让群主
          </button>
        </div>
      )}

      <div className="gp-section">
        <button className="btn btn-danger btn-block" onClick={doLeave} disabled={busy}>
          {busy ? <Spinner size={14} /> : null} 退出群聊
        </button>
      </div>

      {/* add members modal */}
      <Modal
        open={addOpen}
        title="添加成员"
        onClose={() => setAddOpen(false)}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setAddOpen(false)}>
              取消
            </button>
            <button className="btn btn-primary" onClick={addMembers} disabled={adding || picked.length === 0}>
              {adding ? <Spinner size={14} /> : null} 添加 ({picked.length})
            </button>
          </>
        }
      >
        {addableFriends.length === 0 ? (
          <div className="empty-list">没有可添加的好友</div>
        ) : (
          <div className="form">
            {addableFriends.map((f) => {
              const u = f.user || f.friend;
              if (!u) return null;
              const checked = picked.includes(u.id);
              return (
                <label key={u.id} className="checkbox member-check">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) =>
                      setPicked((prev) =>
                        e.target.checked ? [...prev, u.id] : prev.filter((x) => x !== u.id),
                      )
                    }
                  />
                  <UserAvatar name={u.username} size={28} src={u.avatarUrl ?? u.avatar_url ?? null} />
                  <span>{u.displayName || u.display_name || u.username}</span>
                </label>
              );
            })}
          </div>
        )}
      </Modal>

      {/* nickname modal */}
      <Modal
        open={nickOpen}
        title="设置群昵称"
        onClose={() => setNickOpen(false)}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setNickOpen(false)}>
              取消
            </button>
            <button className="btn btn-primary" onClick={saveNick} disabled={savingNick}>
              {savingNick ? <Spinner size={14} /> : null} 保存
            </button>
          </>
        }
      >
        <div className="form">
          <label>
            群昵称（留空清除）
            <input value={nickDraft} onChange={(e) => setNickDraft(e.target.value)} placeholder="仅本群可见" />
          </label>
        </div>
      </Modal>

      {/* transfer modal */}
      <Modal
        open={transferOpen}
        title="转让群主"
        onClose={() => setTransferOpen(false)}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setTransferOpen(false)}>
              取消
            </button>
            <button className="btn btn-primary" onClick={doTransfer} disabled={transferring || !transferTarget}>
              {transferring ? <Spinner size={14} /> : null} 确认转让
            </button>
          </>
        }
      >
        <div className="form">
          <div className="muted">转让后你将变为普通成员，群主不可恢复。</div>
          {members
            .filter((m) => (m.userId ?? m.user_id) !== myId)
            .map((m) => {
              const uid = m.userId ?? m.user_id;
              const u = m.user || { id: uid, username: m.username, displayName: m.displayName ?? m.display_name, display_name: m.display_name };
              return (
                <label key={uid} className="radio-row">
                  <input
                    type="radio"
                    name="transfer-target"
                    checked={transferTarget === uid}
                    onChange={() => setTransferTarget(uid || '')}
                  />
                  <span>{u.displayName || u.display_name || u.username}</span>
                </label>
              );
            })}
        </div>
      </Modal>

      {/* qrcode modal */}
      <Modal open={qrOpen} title="群邀请二维码" onClose={() => setQrOpen(false)}>
        <div className="qr-modal-body">
          {qrLoading && <Spinner />}
          {qrErr && <div className="form-error">{qrErr}</div>}
          {qrData && (
            <>
              <img src={qrData} alt="群二维码" className="qr-image" />
              <div className="muted">扫码加入本群</div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
