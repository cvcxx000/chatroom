import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { aiApi } from '../api/ai';
import { conversationsApi } from '../api/conversations';
import { filesApi } from '../api/files';
import { friendsApi } from '../api/friends';
import { qrApi } from '../api/qr';
import { shareApi } from '../api/share';
import { tempApi } from '../api/temp';
import { usersApi } from '../api/users';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Badge } from '../components/Badge';
import { ConversationList } from '../components/ConversationList';
import { FriendListItem } from '../components/FriendList';
import { FriendRequestItem } from '../components/FriendRequestItem';
import { GroupFileList } from '../components/GroupFileList';
import { MessageBubble } from '../components/MessageBubble';
import { MessageInput } from '../components/MessageInput';
import { Modal } from '../components/Modal';
import { Spinner } from '../components/Spinner';
import { TypingIndicator } from '../components/TypingIndicator';
import { UserAvatar } from '../components/UserAvatar';
import type {
  AiProvider,
  Conversation,
  Friend,
  FriendRequest,
  GroupFile,
  Message,
  SharedLink,
  TempMessage,
  User,
} from '../types';
import { formatBytes, formatDateSeparator, formatTime, isSameDay, prettyError } from '../utils/format';

type SidebarTab = 'chats' | 'friends' | 'temp';

/**
 * 服务端（pglite 直查）返回的消息行是 snake_case，前端类型/渲染用 camelCase。
 * 这里统一归一化，避免 createdAt / senderId / messageType 为 undefined。
 */
function normalizeMessage(raw: any): Message {
  if (!raw) return raw as Message;
  return {
    ...raw,
    id: raw.id,
    conversationId: raw.conversationId ?? raw.conversation_id,
    senderId: raw.senderId ?? raw.sender_id,
    sender: raw.sender,
    content: raw.content ?? '',
    messageType: raw.messageType ?? raw.message_type ?? 'text',
    fileUrl: raw.fileUrl ?? raw.file_url ?? null,
    fileName: raw.fileName ?? raw.file_name ?? null,
    fileSize: raw.fileSize ?? raw.file_size ?? null,
    createdAt: raw.createdAt ?? raw.created_at,
    isAi: raw.isAi ?? raw.is_ai,
  };
}

interface ActiveTemp {
  tempId: string;
  otherUser: User;
  messages: TempMessage[];
}

export function MainChat() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const socket = useSocket();

  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('chats');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [typingMap, setTypingMap] = useState<Record<string, Set<string>>>({});
  const [rightPanel, setRightPanel] = useState<'info' | 'files' | null>(null);
  const [files, setFiles] = useState<GroupFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [searchUser, setSearchUser] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [addingFriend, setAddingFriend] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupMembers, setGroupMembers] = useState<string[]>([]);

  const [activeTemp, setActiveTemp] = useState<ActiveTemp | null>(null);
  const [tempList, setTempList] = useState<ActiveTemp[]>([]);

  // ---------- mobile ----------
  const [isMobile, setIsMobile] = useState<boolean>(() => window.innerWidth < 768);
  const [showChat, setShowChat] = useState(false);

  // ---------- share link ----------
  const [shareOpen, setShareOpen] = useState(false);
  const [shareExpires, setShareExpires] = useState<number>(24);
  const [sharePassword, setSharePassword] = useState('');
  const [generatedLink, setGeneratedLink] = useState<SharedLink | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareErr, setShareErr] = useState('');

  // ---------- scan (mobile-side simulate) ----------
  const [scanOpen, setScanOpen] = useState(false);
  const [scanTokenInput, setScanTokenInput] = useState('');
  const [scanState, setScanState] = useState<'idle' | 'scanned' | 'done' | 'error'>('idle');
  const [scanMsg, setScanMsg] = useState('');

  // ---------- AI conversation ----------
  const [aiOpen, setAiOpen] = useState(false);
  const [aiProviders, setAiProviders] = useState<AiProvider[]>([]);
  const [aiSelected, setAiSelected] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState('');

  // ---------- toast ----------
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const [searchParams] = useSearchParams();

  const msgEndRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const activeConvIdRef = useRef<string | null>(null);

  const myId = user?.id;

  // keep active conversation id in a ref for WS handlers
  useEffect(() => {
    activeConvIdRef.current = activeConv?.id ?? null;
  }, [activeConv]);

  // ---------- loaders ----------
  const loadConversations = useCallback(async () => {
    setLoadingConvs(true);
    try {
      const list = await conversationsApi.list();
      setConversations(list);
    } catch {
      /* ignore */
    } finally {
      setLoadingConvs(false);
    }
  }, []);

  const loadFriends = useCallback(async () => {
    try {
      const [f, r] = await Promise.all([friendsApi.list(), friendsApi.requests()]);
      setFriends(f);
      setRequests(r);
    } catch {
      /* ignore */
    }
  }, []);

  const showToast = useCallback((text: string) => {
    setToast(text);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3000);
  }, []);

  // ---------- mobile breakpoint ----------
  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setShowChat(true);
    };
    window.addEventListener('resize', onResize);
    onResize();
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!myId) return;
    loadConversations();
    loadFriends();
  }, [myId, loadConversations, loadFriends]);

  // ---------- auto-open conversation from ?open= (e.g. after joining a share link) ----------
  useEffect(() => {
    const openId = searchParams.get('open');
    if (!openId || !conversations.length || activeConv) return;
    const target = conversations.find((c) => c.id === openId);
    if (target) void openConversation(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, conversations]);

  // ---------- WS: new_message ----------
  useEffect(() => {
    if (!myId) return;
    const offNew = socket.on('new_message', (p: any) => {
      const msg: Message = normalizeMessage(p.message);
      const convId: string = p.conversationId || msg.conversationId || msg.conversation_id;
      // 始终更新会话列表的最后一条预览
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, lastMessage: msg } : c)),
      );
      // 只有消息属于当前打开的会话时才追加进消息列表，避免串台
      if (convId && convId !== activeConvIdRef.current) return;
      setMessages((prev) => {
        // dedupe by id（乐观插入与 WS 回显可能同一条）
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });
    const offTyping = socket.on('user_typing', (p: any) => {
      const convId: string = p.conversationId;
      const uid: string = p.userId;
      const isTyping: boolean = p.isTyping;
      setTypingMap((prev) => {
        const set = new Set(prev[convId] || []);
        if (isTyping) set.add(uid);
        else set.delete(uid);
        return { ...prev, [convId]: set };
      });
    });
    const offFriendReq = socket.on('friend_request', (p: any) => {
      loadFriends();
      const name =
        p?.fromUser?.displayName || p?.fromUser?.display_name || p?.fromUser?.username;
      if (name) showToast(`${name} 发来好友请求`);
    });
    const offFriendAccept = socket.on('friend_accepted', () => {
      loadFriends();
    });
    const offAiStream = socket.on('ai_stream', (p: any) => {
      const { conversationId, messageId, delta, done } = p;
      if (conversationId && conversationId !== activeConvIdRef.current) return;
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === messageId);
        if (idx === -1) {
          const placeholder: Message = {
            id: messageId,
            conversationId,
            content: delta || '',
            messageType: 'text',
            createdAt: new Date().toISOString(),
            isAi: true,
            sender: { id: 'ai', username: 'ai_assistant' } as User,
          };
          return [...prev, placeholder];
        }
        const next = [...prev];
        next[idx] = { ...next[idx], content: (next[idx].content || '') + (delta || '') };
        if (done) next[idx] = { ...next[idx], isAi: next[idx].isAi ?? true };
        return next;
      });
    });
    const offBanned = socket.on('user_banned', () => {
      logout();
      navigate('/login?banned=1');
    });
    const offTempMsg = socket.on('temp_message', (p: any) => {
      const msg: TempMessage = {
        ...p.message,
        expiresAt: p.expiresAt,
      };
      setTempList((prev) => {
        return prev.map((t) =>
          t.tempId === p.tempId ? { ...t, messages: [...t.messages, msg] } : t,
        );
      });
      setActiveTemp((prev) =>
        prev && prev.tempId === p.tempId ? { ...prev, messages: [...prev.messages, msg] } : prev,
      );
    });
    const offTempExpired = socket.on('temp_expired', (p: any) => {
      setTempList((prev) => prev.filter((t) => t.tempId !== p.tempId));
      setActiveTemp((prev) => (prev && prev.tempId === p.tempId ? null : prev));
    });
    return () => {
      offNew();
      offTyping();
      offFriendReq();
      offFriendAccept();
      offAiStream();
      offBanned();
      offTempMsg();
      offTempExpired();
    };
  }, [myId, socket, loadFriends, logout, navigate, showToast]);

  // ---------- open conversation ----------
  const openConversation = useCallback(
    async (c: Conversation) => {
      setActiveConv(c);
      setActiveTemp(null);
      setRightPanel(c.type === 'group' ? 'info' : null);
      setGeneratedLink(null);
      setShowChat(true);
      setMessages([]);
      setLoadingMessages(true);
      socket.joinConversation(c.id);
      try {
        const msgs = await conversationsApi.messages(c.id, { limit: 100 });
        // 服务端返回 newest-first（DESC），这里翻转为 oldest -> newest，
        // 并归一化 snake_case 字段，保证 createdAt / senderId 可用。
        setMessages(msgs.map(normalizeMessage).reverse());
      } catch {
        /* ignore */
      } finally {
        setLoadingMessages(false);
      }
      if (c.type === 'group') {
        setLoadingFiles(true);
        try {
          setFiles(await filesApi.list(c.id));
        } catch {
          setFiles([]);
        } finally {
          setLoadingFiles(false);
        }
      }
    },
    [socket],
  );

  // ---------- auto scroll ----------
  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeConv?.id, activeTemp?.tempId]);

  // ---------- append a message to the currently open conversation (optimistic) ----------
  const appendToActive = useCallback(
    (convId: string, raw: any) => {
      const msg = normalizeMessage(raw);
      // 仅当用户仍停留在该会话时才写入消息列表
      if (activeConvIdRef.current !== convId) return;
      setMessages((prev) =>
        prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
      );
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, lastMessage: msg } : c)),
      );
    },
    [],
  );

  // ---------- sending text message ----------
  const sendText = useCallback(
    async (text: string) => {
      if (activeConv) {
        try {
          const sent = await conversationsApi.sendMessage(activeConv.id, {
            content: text,
            messageType: 'text',
          });
          // 乐观更新：立即把自己发的消息渲染出来，不等 WS 回显
          appendToActive(activeConv.id, {
            ...sent,
            sender: {
              id: myId,
              username: user?.username,
              displayName: user?.displayName ?? user?.display_name,
            },
          });
        } catch (e) {
          alert(prettyError(e));
        }
      } else if (activeTemp) {
        // Prefer WS path, fall back to REST.
        const sent = socket.sendTempMessage(activeTemp.tempId, text);
        if (!sent) {
          try {
            await tempApi.send(activeTemp.tempId, text);
          } catch (e) {
            alert(prettyError(e));
          }
        }
      }
    },
    [activeConv, activeTemp, socket, appendToActive, myId, user],
  );

  const sendAttachment = useCallback(
    async (file: File, asImage: boolean) => {
      if (!activeConv) return;
      const fd = new FormData();
      fd.append('file', file);
      try {
        const upload = await fetch(`/api/conversations/${activeConv.id}/files`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('chatroom_token') || ''}` },
          body: fd,
        });
        if (!upload.ok) throw new Error('上传失败');
        const body = await upload.json();
        const data = body?.data ?? body;
        const sent = await conversationsApi.sendMessage(activeConv.id, {
          content: asImage ? file.name : '',
          messageType: asImage ? 'image' : 'file',
          fileUrl: data.fileUrl ?? data.file_url,
          fileName: data.fileName ?? data.file_name ?? file.name,
          fileSize: data.fileSize ?? data.file_size ?? file.size,
        });
        // 乐观更新附件消息
        appendToActive(activeConv.id, {
          ...sent,
          sender: {
            id: myId,
            username: user?.username,
            displayName: user?.displayName ?? user?.display_name,
          },
        });
      } catch (e) {
        alert(prettyError(e));
      }
    },
    [activeConv, appendToActive, myId, user],
  );

  // ---------- friends ----------
  const searchUsers = async (q: string) => {
    setSearchUser(q);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      setSearchResults(await usersApi.search(q));
    } catch {
      setSearchResults([]);
    }
  };

  const sendFriendReq = async (uid: string) => {
    try {
      await friendsApi.sendRequest(uid);
      alert('好友请求已发送');
    } catch (e) {
      alert(prettyError(e));
    }
  };

  const acceptRequest = async (id: string) => {
    try {
      await friendsApi.accept(id);
      await loadFriends();
    } catch (e) {
      alert(prettyError(e));
    }
  };
  const rejectRequest = async (id: string) => {
    try {
      await friendsApi.reject(id);
      await loadFriends();
    } catch (e) {
      alert(prettyError(e));
    }
  };

  const openPrivateChat = async (friendUserId: string) => {
    try {
      const conv = await conversationsApi.createPrivate(friendUserId);
      await loadConversations();
      await openConversation(conv);
      setSidebarTab('chats');
    } catch (e) {
      alert(prettyError(e));
    }
  };

  const startTemp = async (friend: User) => {
    try {
      const r = await tempApi.start(friend.id);
      const existing = tempList.find((t) => t.tempId === r.tempId);
      if (existing) {
        setActiveTemp(existing);
        setActiveConv(null);
        return;
      }
      const conv: ActiveTemp = {
        tempId: r.tempId,
        otherUser: friend,
        messages: [],
      };
      setTempList((prev) => [...prev, conv]);
      setActiveTemp(conv);
      setActiveConv(null);
      socket.tempJoin(r.tempId);
    } catch (e) {
      alert(prettyError(e));
    }
  };

  // ---------- create group ----------
  const createGroup = async () => {
    if (!groupName.trim() || groupMembers.length === 0) {
      alert('请填写群名并至少选择一位成员');
      return;
    }
    try {
      const conv = await conversationsApi.createGroup({ name: groupName.trim(), memberIds: groupMembers });
      setCreateGroupOpen(false);
      setGroupName('');
      setGroupMembers([]);
      await loadConversations();
      await openConversation(conv);
    } catch (e) {
      alert(prettyError(e));
    }
  };

  // ---------- share link ----------
  const openShareModal = () => {
    setGeneratedLink(null);
    setSharePassword('');
    setShareExpires(24);
    setShareErr('');
    setShareOpen(true);
  };

  const generateShare = async () => {
    if (!activeConv) return;
    setShareBusy(true);
    setShareErr('');
    try {
      const link = await shareApi.generate(
        activeConv.id,
        shareExpires,
        sharePassword.trim() || undefined,
      );
      setGeneratedLink(link);
    } catch (e) {
      setShareErr(prettyError(e));
    } finally {
      setShareBusy(false);
    }
  };

  const copyLink = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast('链接已复制');
    } catch {
      window.prompt('复制链接', text);
    }
  };

  // ---------- scan (mobile side simulation) ----------
  const doScan = async () => {
    const t = scanTokenInput.trim();
    if (!t) return;
    setScanMsg('');
    try {
      await qrApi.scan(t);
      setScanState('scanned');
      setScanMsg('已扫码，请确认登录');
    } catch (e) {
      setScanState('error');
      setScanMsg(prettyError(e));
    }
  };

  const doConfirmScan = async () => {
    const t = scanTokenInput.trim();
    setScanMsg('');
    try {
      await qrApi.confirm(t);
      setScanState('done');
      setScanMsg('已确认登录');
    } catch (e) {
      setScanState('error');
      setScanMsg(prettyError(e));
    }
  };

  // ---------- AI conversation ----------
  const openAiModal = async () => {
    setAiOpen(true);
    setAiErr('');
    setAiSelected('');
    try {
      const list = await aiApi.listProviders();
      setAiProviders(list);
    } catch (e) {
      setAiProviders([]);
      setAiErr(prettyError(e));
    }
  };

  const startAiConversation = async () => {
    if (!aiSelected) return;
    setAiBusy(true);
    setAiErr('');
    try {
      const conv = await aiApi.createConversation(aiSelected);
      setAiOpen(false);
      await loadConversations();
      await openConversation(conv);
      setSidebarTab('chats');
    } catch (e) {
      setAiErr(prettyError(e));
    } finally {
      setAiBusy(false);
    }
  };

  // ---------- render helpers ----------
  const otherUserOf = (c: Conversation): User | undefined => {
    if (c.otherUser) return c.otherUser;
    const m = c.members?.find((mm) => {
      const uid = mm.userId ?? mm.user_id;
      return uid && uid !== myId;
    });
    return m?.user;
  };

  const typingNames = useMemo(() => {
    if (!activeConv) return [];
    const set = typingMap[activeConv.id] || new Set<string>();
    return Array.from(set).map((uid) => {
      const m = activeConv.members?.find((mm) => (mm.userId ?? mm.user_id) === uid);
      return m?.user?.displayName || m?.user?.display_name || m?.user?.username || '对方';
    });
  }, [activeConv, typingMap]);

  const convTitle = activeConv
    ? activeConv.type === 'group'
      ? activeConv.name || '群聊'
      : activeConv.type === 'ai'
        ? activeConv.name || 'AI 助手'
        : otherUserOf(activeConv)?.displayName ||
          otherUserOf(activeConv)?.display_name ||
          otherUserOf(activeConv)?.username ||
          '私聊'
    : activeTemp
      ? `${activeTemp.otherUser.displayName || activeTemp.otherUser.username}（临时）`
      : '选择一个会话';

  const groupedMessages = useMemo(() => {
    const out: Array<{ type: 'day' | 'msg'; date?: string; message?: Message }> = [];
    let last: Message | null = null;
    for (const m of messages) {
      if (!last || !isSameDay(last.createdAt, m.createdAt)) {
        out.push({ type: 'day', date: formatDateSeparator(m.createdAt) });
      }
      out.push({ type: 'msg', message: m });
      last = m;
    }
    return out;
  }, [messages]);

  if (!user) return null;

  return (
    <div className={`chat-app ${activeTemp ? 'temp-active' : ''} ${isMobile && showChat ? 'chat-view' : ''}`}>
      {/* TOAST */}
      {toast && <div className="toast">{toast}</div>}
      {/* LEFT SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-profile">
          <UserAvatar name={user.displayName || user.username} src={user.avatarUrl ?? user.avatar_url ?? null} size={40} />
          <div className="sidebar-profile-meta">
            <div className="sidebar-profile-name">{user.displayName || user.username}</div>
            <div className="muted">@{user.username}</div>
          </div>
          <button
            className="icon-btn"
            title="扫一扫"
            onClick={() => {
              setScanOpen(true);
              setScanTokenInput('');
              setScanState('idle');
              setScanMsg('');
            }}
          >
            📷
          </button>
          <button
            className="icon-btn"
            title="退出登录"
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            ⎋
          </button>
        </div>

        <div className="sidebar-tabs">
          <button className={sidebarTab === 'chats' ? 'active' : ''} onClick={() => setSidebarTab('chats')}>
            会话
          </button>
          <button className={sidebarTab === 'friends' ? 'active' : ''} onClick={() => setSidebarTab('friends')}>
            好友{requests.length > 0 ? <Badge variant="warn">{requests.length}</Badge> : null}
          </button>
          <button className={`${sidebarTab === 'temp' ? 'active' : ''} temp-tab`} onClick={() => setSidebarTab('temp')}>
            临时
            {tempList.length > 0 ? <Badge variant="temp">{tempList.length}</Badge> : null}
          </button>
        </div>

        {sidebarTab === 'chats' && (
          <>
            <div className="sidebar-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => setCreateGroupOpen(true)}>
                + 新建群聊
              </button>
              <button className="btn btn-secondary btn-sm" onClick={openAiModal}>
                🤖 + AI 对话
              </button>
            </div>
            <ConversationList
              conversations={conversations}
              loading={loadingConvs}
              activeId={activeConv?.id || null}
              onSelect={openConversation}
            />
          </>
        )}

        {sidebarTab === 'friends' && (
          <div className="sidebar-scroll">
            <div className="friend-toolbar">
              <button className="btn btn-ghost btn-sm" onClick={() => void loadFriends()}>
                🔄 刷新
              </button>
            </div>
            <div className="friend-search">
              <input
                placeholder="按用户名搜索添加好友"
                value={searchUser}
                onChange={(e) => searchUsers(e.target.value)}
              />
            </div>
            {searchResults.length > 0 && (
              <div className="friend-section">
                <div className="section-title">搜索结果</div>
                {searchResults.map((u) => {
                  const alreadyFriend = friends.some(
                    (f) => (f.friendId || f.friend_id) === u.id || (f.userId || f.user_id) === u.id,
                  );
                  return (
                    <FriendListItem
                      key={u.id}
                      name={u.displayName || u.display_name || u.username}
                      avatar={u.avatarUrl ?? u.avatar_url ?? null}
                      subtitle={`@${u.username}`}
                      buttons={
                        alreadyFriend ? (
                          <Badge>已是好友</Badge>
                        ) : (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => sendFriendReq(u.id)}
                            disabled={addingFriend}
                          >
                            加好友
                          </button>
                        )
                      }
                    />
                  );
                })}
              </div>
            )}

            {requests.length > 0 && (
              <div className="friend-section">
                <div className="section-title">新的好友请求</div>
                {requests.map((r) => (
                  <FriendRequestItem
                    key={r.id}
                    request={r}
                    onAccept={acceptRequest}
                    onReject={rejectRequest}
                  />
                ))}
              </div>
            )}

            <div className="friend-section">
              <div className="section-title">我的好友 ({friends.length})</div>
              {friends.length === 0 && <div className="empty-list">还没有好友</div>}
              {friends.map((f) => {
                const u = f.user || f.friend;
                if (!u) return null;
                return (
                  <FriendListItem
                    key={f.id || f.userId || f.friendId}
                    name={u.displayName || u.display_name || u.username}
                    avatar={u.avatarUrl ?? u.avatar_url ?? null}
                    subtitle={`@${u.username}`}
                    buttons={
                      <>
                        <button className="btn btn-ghost btn-sm" onClick={() => openPrivateChat(u.id)}>
                          发消息
                        </button>
                        <button className="btn btn-ghost btn-sm temp-mini" onClick={() => startTemp(u)}>
                          🔥 临时
                        </button>
                      </>
                    }
                  />
                );
              })}
            </div>
          </div>
        )}

        {sidebarTab === 'temp' && (
          <div className="sidebar-scroll">
            <div className="section-title">临时对话（2 分钟后自动销毁）</div>
            {tempList.length === 0 && (
              <div className="empty-list">
                还没有临时对话。在好友列表点击「🔥 临时」即可发起。
              </div>
            )}
            {tempList.map((t) => (
              <button
                key={t.tempId}
                className={`conv-item temp-item ${activeTemp?.tempId === t.tempId ? 'active' : ''}`}
                onClick={() => {
                  setActiveTemp(t);
                  setActiveConv(null);
                  socket.tempJoin(t.tempId);
                }}
              >
                <UserAvatar name={t.otherUser.username} size={44} />
                <div className="conv-item-body">
                  <div className="conv-item-line">
                    <span className="conv-item-name">
                      🔒 {t.otherUser.displayName || t.otherUser.username}
                    </span>
                    <Badge variant="temp">临时对话</Badge>
                  </div>
                  <div className="conv-item-line">
                    <span className="conv-item-preview">
                      {t.messages[t.messages.length - 1]?.content || '加密临时聊天'}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </aside>

      {/* MIDDLE COLUMN */}
      <main className={`chat-main ${activeTemp ? 'temp-theme' : ''}`}>
        {!activeConv && !activeTemp ? (
          <div className="empty-chat">
            <div className="empty-chat-title">聊天文件室</div>
            <div className="muted">从左侧选择一个会话开始聊天</div>
          </div>
        ) : (
          <>
            <header className="chat-header">
              {activeTemp ? (
                <>
                  <UserAvatar name={activeTemp.otherUser.username} size={36} />
                  <div className="chat-header-meta">
                    <div className="chat-header-name">
                      🔒 {activeTemp.otherUser.displayName || activeTemp.otherUser.username}
                      <Badge variant="temp">临时对话</Badge>
                    </div>
                    <div className="muted">消息将在 2 分钟后自动销毁</div>
                  </div>
                </>
              ) : activeConv ? (
                <>
                  {isMobile && (
                    <button className="icon-btn chat-back" onClick={() => setShowChat(false)} aria-label="返回">
                      ←
                    </button>
                  )}
                  {activeConv.type === 'ai' ? (
                    <div className="ai-avatar">🤖</div>
                  ) : (
                    <UserAvatar
                      name={activeConv.type === 'group' ? activeConv.name : otherUserOf(activeConv)?.username}
                      src={
                        activeConv.type === 'group'
                          ? null
                          : otherUserOf(activeConv)?.avatarUrl ?? otherUserOf(activeConv)?.avatar_url ?? null
                      }
                      size={36}
                    />
                  )}
                  <div className="chat-header-meta">
                    <div className="chat-header-name">
                      {convTitle}
                      {activeConv.type === 'group' && (
                        <Badge>{activeConv.members?.length ?? 0} 人</Badge>
                      )}
                      {activeConv.type === 'ai' && <Badge variant="warn">AI</Badge>}
                    </div>
                    <div className="muted">
                      {activeConv.type === 'group'
                        ? '群聊'
                        : activeConv.type === 'ai'
                          ? 'AI 助手'
                          : `@${otherUserOf(activeConv)?.username || ''}`}
                    </div>
                  </div>
                  <div className="chat-header-actions">
                    {activeConv.type === 'group' && (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setRightPanel(rightPanel === 'files' ? null : 'files')}
                      >
                        📁 群文件
                      </button>
                    )}
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setRightPanel(rightPanel === 'info' ? null : 'info')}
                    >
                      ℹ️ 资料
                    </button>
                  </div>
                </>
              ) : null}
            </header>

            <div className="message-list" ref={listRef}>
              {loadingMessages ? (
                <div className="empty-list">
                  <Spinner />
                </div>
              ) : activeTemp ? (
                <>
                  {activeTemp.messages.map((m) => {
                    const mine = (m.senderId || m.sender_id) === myId;
                    return (
                      <MessageBubble
                        key={m.id}
                        kind="temp"
                        message={m}
                        isMine={mine}
                        createdAt={m.createdAt || m.created_at || ''}
                        isTemp
                        expiresAt={m.expiresAt || m.expires_at}
                        senderName={m.sender?.displayName || m.sender?.display_name || m.sender?.username}
                      />
                    );
                  })}
                  {activeTemp.messages.length === 0 && (
                    <div className="empty-list">还没有消息，发送一条吧（2 分钟后自动销毁）</div>
                  )}
                </>
              ) : (
                groupedMessages.map((g, i) =>
                  g.type === 'day' ? (
                    <div key={`d-${i}`} className="date-sep">
                      {g.date}
                    </div>
                  ) : (
                    <MessageBubble
                      key={(g.message as Message).id}
                      kind="message"
                      message={g.message!}
                      isMine={(g.message!.senderId || g.message!.sender_id) === myId}
                      createdAt={g.message!.createdAt}
                      showSender={activeConv?.type === 'group'}
                      isAi={
                        g.message!.isAi ||
                        g.message!.sender?.username === 'ai_assistant' ||
                        activeConv?.type === 'ai'
                      }
                      senderName={
                        g.message!.sender?.displayName ||
                        g.message!.sender?.display_name ||
                        g.message!.sender?.username
                      }
                      senderAvatar={g.message!.sender?.avatarUrl ?? g.message!.sender?.avatar_url ?? null}
                    />
                  ),
                )
              )}
              <TypingIndicator names={typingNames} />
              <div ref={msgEndRef} />
            </div>

            <div className="chat-footer">
              {activeTemp ? (
                <MessageInput
                  onSendText={sendText}
                  placeholder="发送临时消息（2 分钟后自动销毁）…"
                  disabled={false}
                />
              ) : (
                <MessageInput
                  onSendText={sendText}
                  onSendImage={(f) => sendAttachment(f, true)}
                  onSendFile={(f) => sendAttachment(f, false)}
                  placeholder="输入消息，Enter 发送，Shift+Enter 换行…"
                  onTyping={(t) => activeConv && socket.sendTyping(activeConv.id, t)}
                />
              )}
            </div>
          </>
        )}
      </main>

      {/* RIGHT PANEL */}
      {rightPanel && activeConv && !activeTemp && (
        <aside className="right-panel">
          <div className="right-panel-header">
            <h3>{rightPanel === 'files' ? '群文件' : '会话资料'}</h3>
            <button className="icon-btn" onClick={() => setRightPanel(null)}>
              ×
            </button>
          </div>
          {rightPanel === 'info' && (
            <div className="right-panel-body">
              <div className="share-block">
                <button className="btn btn-primary btn-block" onClick={openShareModal}>
                  🔗 生成共享链接
                </button>
              </div>
              <div className="members-block">
                <div className="section-title">
                  成员 ({activeConv.members?.length ?? 0})
                </div>
                {(activeConv.members || []).map((m) => {
                  const u = m.user;
                  if (!u) return null;
                  return (
                    <div key={m.userId ?? m.user_id} className="member-row">
                      <UserAvatar name={u.username} size={32} src={u.avatarUrl ?? u.avatar_url ?? null} />
                      <div>
                        <div>{u.displayName || u.display_name || u.username}</div>
                        <div className="muted">@{u.username}{m.role === 'admin' ? ' · 管理员' : ''}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {rightPanel === 'files' && (
            <div className="right-panel-body">
              <FileUpload
                conversationId={activeConv.id}
                onUploaded={(f) => setFiles((prev) => [f, ...prev])}
              />
              <GroupFileList
                files={files}
                loading={loadingFiles}
                onDownload={(f) => filesApi.openAuthenticated(f, f.fileName)}
                onDelete={async (f) => {
                  if (!confirm('确定删除该文件？')) return;
                  try {
                    await filesApi.remove(f.id);
                    setFiles((prev) => prev.filter((x) => x.id !== f.id));
                  } catch (e) {
                    alert(prettyError(e));
                  }
                }}
                canDelete
              />
            </div>
          )}
        </aside>
      )}

      {/* CREATE GROUP MODAL */}
      <Modal
        open={createGroupOpen}
        title="新建群聊"
        onClose={() => setCreateGroupOpen(false)}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setCreateGroupOpen(false)}>
              取消
            </button>
            <button className="btn btn-primary" onClick={createGroup}>
              创建
            </button>
          </>
        }
      >
        <div className="form">
          <label>
            群名称
            <input value={groupName} onChange={(e) => setGroupName(e.target.value)} />
          </label>
          <div className="section-title">选择成员</div>
          {friends.map((f) => {
            const u = f.user || f.friend;
            if (!u) return null;
            const checked = groupMembers.includes(u.id);
            return (
              <label key={u.id} className="checkbox member-check">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) =>
                    setGroupMembers((prev) =>
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
      </Modal>

      {/* SHARE LINK MODAL */}
      <Modal
        open={shareOpen}
        title="生成共享链接"
        onClose={() => setShareOpen(false)}
        footer={
          generatedLink ? (
            <button className="btn btn-primary" onClick={() => setShareOpen(false)}>
              完成
            </button>
          ) : (
            <>
              <button className="btn btn-ghost" onClick={() => setShareOpen(false)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={generateShare} disabled={shareBusy}>
                {shareBusy ? <Spinner size={14} /> : null}
                生成
              </button>
            </>
          )
        }
      >
        {generatedLink ? (
          <div className="form">
            <div className="inline-msg ok">共享链接已生成</div>
            <label>
              链接
              <input readOnly value={generatedLink.url} onFocus={(e) => e.target.select()} />
            </label>
            <button className="btn btn-secondary" onClick={() => void copyLink(generatedLink.url)}>
              复制链接
            </button>
            <div className="muted">
              {generatedLink.expiresAt
                ? `有效期至 ${new Date(generatedLink.expiresAt).toLocaleString()}`
                : ''}
              {generatedLink.hasPassword ? ' · 已设置访问密码' : ''}
            </div>
          </div>
        ) : (
          <div className="form">
            <label>
              有效期
              <select
                value={shareExpires}
                onChange={(e) => setShareExpires(Number(e.target.value))}
              >
                <option value={24}>24 小时</option>
                <option value={72}>72 小时</option>
                <option value={168}>7 天</option>
              </select>
            </label>
            <label>
              访问密码（可选）
              <input
                type="password"
                value={sharePassword}
                onChange={(e) => setSharePassword(e.target.value)}
                placeholder="留空则无需密码"
              />
            </label>
            {shareErr && <div className="form-error">{shareErr}</div>}
          </div>
        )}
      </Modal>

      {/* SCAN MODAL (mobile-side simulate) */}
      <Modal
        open={scanOpen}
        title="扫一扫"
        onClose={() => setScanOpen(false)}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setScanOpen(false)}>
              关闭
            </button>
            {scanState === 'idle' && (
              <button className="btn btn-primary" onClick={doScan} disabled={!scanTokenInput.trim()}>
                扫码
              </button>
            )}
            {scanState === 'scanned' && (
              <button className="btn btn-primary" onClick={doConfirmScan}>
                确认登录
              </button>
            )}
          </>
        }
      >
        <div className="form">
          <label>
            输入二维码中的 token
            <input
              value={scanTokenInput}
              onChange={(e) => setScanTokenInput(e.target.value)}
              placeholder="粘贴扫码得到的 token"
              disabled={scanState === 'scanned' || scanState === 'done'}
            />
          </label>
          {scanMsg && <div className={scanState === 'error' ? 'form-error' : 'inline-msg ok'}>{scanMsg}</div>}
          {scanState === 'done' && <div className="inline-msg ok">已确认，电脑端将自动登录</div>}
        </div>
      </Modal>

      {/* AI CONVERSATION MODAL */}
      <Modal
        open={aiOpen}
        title="新建 AI 对话"
        onClose={() => setAiOpen(false)}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setAiOpen(false)}>
              取消
            </button>
            <button className="btn btn-primary" onClick={startAiConversation} disabled={!aiSelected || aiBusy}>
              {aiBusy ? <Spinner size={14} /> : null}
              开始对话
            </button>
          </>
        }
      >
        <div className="form">
          {aiProviders.length === 0 && !aiErr && <div className="empty-list">正在加载可用模型…</div>}
          {aiProviders.length === 0 && aiErr && (
            <div className="inline-msg err">管理员未配置 AI 或加载失败</div>
          )}
          {aiProviders.length > 0 && (
            <>
              <div className="section-title">选择 AI 提供商</div>
              {aiProviders.map((p) => (
                <label key={p.id} className="radio-row">
                  <input
                    type="radio"
                    name="ai-provider"
                    checked={aiSelected === p.id}
                    onChange={() => setAiSelected(p.id)}
                  />
                  <span>
                    {p.name} <span className="muted">· {p.provider} / {p.model}</span>
                  </span>
                </label>
              ))}
            </>
          )}
          {aiErr && <div className="form-error">{aiErr}</div>}
        </div>
      </Modal>
    </div>
  );
}

function FileUpload({
  conversationId,
  onUploaded,
}: {
  conversationId: string;
  onUploaded: (f: GroupFile) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const pick = async (file: File) => {
    setBusy(true);
    setErr('');
    try {
      const f = await filesApi.upload(conversationId, file);
      onUploaded(f);
    } catch (e) {
      setErr(prettyError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="group-file-upload">
      <input
        id="group-file-input"
        type="file"
        style={{ display: 'none' }}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) await pick(f);
          e.target.value = '';
        }}
      />
      <button
        className="btn btn-primary btn-sm"
        onClick={() => document.getElementById('group-file-input')?.click()}
        disabled={busy}
      >
        {busy ? <Spinner size={14} /> : null}
        上传文件
      </button>
      {err && <div className="form-error">{err}</div>}
    </div>
  );
}
