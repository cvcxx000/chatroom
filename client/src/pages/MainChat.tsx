import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { aiApi } from '../api/ai';
import { conversationsApi } from '../api/conversations';
import { filesApi } from '../api/files';
import { friendsApi } from '../api/friends';
import { messagesApi } from '../api/messages';
import { qrApi } from '../api/qr';
import { shareApi } from '../api/share';
import { tempApi } from '../api/temp';
import { terminalApi } from '../api/terminal';
import { usersApi } from '../api/users';
import { ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Badge } from '../components/Badge';
import { ConversationList } from '../components/ConversationList';
import { FriendListItem } from '../components/FriendList';
import { FriendRequestItem } from '../components/FriendRequestItem';
import { GroupFileList } from '../components/GroupFileList';
import { MessageActions, type ActionMenuItem } from '../components/MessageActions';
import { MessageBubble } from '../components/MessageBubble';
import { MessageInput, type ReplyContext } from '../components/MessageInput';
import { MessageSearch } from '../components/MessageSearch';
import { Modal } from '../components/Modal';
import { ReactionPicker } from '../components/ReactionPicker';
import { ScrollToBottomButton } from '../components/ScrollToBottomButton';
import { Spinner } from '../components/Spinner';
import { TypingIndicator } from '../components/TypingIndicator';
import { TerminalPanel } from '../components/TerminalPanel';
import { UserAvatar } from '../components/UserAvatar';
import { GroupInfoPanel } from '../components/GroupInfoPanel';
import { UserProfileModal } from '../components/UserProfileModal';
import { ConversationMenu } from '../components/ConversationMenu';
import { ConversationSearch } from '../components/ConversationSearch';
import { conversationSettingsApi } from '../api/conversationSettings';
import { quickRepliesApi } from '../api/quickReplies';
import type {
  AiProvider,
  Conversation,
  ConversationSettings,
  Friend,
  FriendRequest,
  GroupFile,
  Message,
  MessageReplyRef,
  MessageReaction,
  QuickReply,
  SharedLink,
  TempMessage,
  User,
} from '../types';
import { formatBytes, formatDateSeparator, formatTime, isSameDay, prettyError } from '../utils/format';
import '../styles/userops.css';

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
    // 新能力字段归一化
    reactions: (raw.reactions ?? raw.reactions ?? null) as MessageReaction[] | null,
    replyTo: (raw.replyTo ?? raw.reply_to ?? null) as MessageReplyRef | null,
    isEdited: raw.isEdited ?? raw.is_edited ?? false,
    isPinned: raw.isPinned ?? raw.is_pinned ?? false,
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

  // ---------- virtual terminal ----------
  const [terminalContainerId, setTerminalContainerId] = useState<string | null>(null);
  const [terminalStarting, setTerminalStarting] = useState(false);
  const [terminalError, setTerminalError] = useState('');
  const [viewMode, setViewMode] = useState<'chat' | 'terminal'>('chat');

  // ---------- toast ----------
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  // ---------- 消息操作：回复 / 编辑 / 菜单 / 反应 / 搜索 / 转发 / 置顶 ----------
  const [replyMsg, setReplyMsg] = useState<Message | null>(null);
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [actionsMenu, setActionsMenu] = useState<{ x: number; y: number; message: Message } | null>(
    null,
  );
  const [reactionFor, setReactionFor] = useState<Message | null>(null);
  const [forwardingMsg, setForwardingMsg] = useState<Message | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [msgSearchResults, setMsgSearchResults] = useState<Message[]>([]);
  const [searching, setSearching] = useState(false);
  // 滚动到底部
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const nearBottomRef = useRef(true);
  const searchDebounceRef = useRef<number | null>(null);

  // ---------- 会话管理 / 搜索 / 右键菜单 ----------
  const [convQuery, setConvQuery] = useState('');
  const [convSettingsMap, setConvSettingsMap] = useState<Record<string, ConversationSettings>>({});
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; conv: Conversation } | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  // ---------- 用户资料卡 ----------
  const [profileUser, setProfileUser] = useState<User | null>(null);
  // 已拉黑用户 id 集合（用于 UserProfileModal 展示拉黑/取消拉黑按钮）
  const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(new Set());

  // ---------- 快捷回复 ----------
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);

  // ---------- 拖拽上传 ----------
  const [dragging, setDragging] = useState(false);
  const dragDepthRef = useRef(0);

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

  // 拉取黑名单列表，维护 blockedUserIds
  const loadBlocked = useCallback(async () => {
    try {
      const list = await usersApi.getBlockedList();
      setBlockedUserIds(new Set((list || []).map((u) => u.id)));
    } catch {
      /* ignore（接口暂未上线时不影响其它功能） */
    }
  }, []);

  const showToast = useCallback((text: string) => {
    setToast(text);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3000);
  }, []);

  // ---------- conversation settings (pin / mute / archive) ----------
  const loadConversationSettings = useCallback(async (list: Conversation[]) => {
    const entries = await Promise.all(
      list.map(async (c) => {
        try {
          const s = await conversationSettingsApi.getSettings(c.id);
          return [c.id, s] as const;
        } catch {
          return null;
        }
      }),
    );
    const map: Record<string, ConversationSettings> = {};
    for (const e of entries) if (e) map[e[0]] = e[1];
    setConvSettingsMap(map);
  }, []);

  const loadQuickReplies = useCallback(async () => {
    try {
      setQuickReplies(await quickRepliesApi.list());
    } catch {
      /* ignore */
    }
  }, []);

  // refresh a single conversation's settings locally
  const applySetting = useCallback(
    async (convId: string, patch: Partial<Pick<ConversationSettings, 'pinned' | 'muted' | 'archived'>>) => {
      const prev = convSettingsMap[convId] || { conversationId: convId };
      setConvSettingsMap((m) => ({ ...m, [convId]: { ...m[convId], ...patch } }));
      try {
        await conversationSettingsApi.updateSetting(convId, patch);
      } catch (e) {
        setConvSettingsMap((m) => ({ ...m, [convId]: prev }));
        showToast(prettyError(e));
      }
    },
    [convSettingsMap, showToast],
  );

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
    loadBlocked();
    loadQuickReplies();
  }, [myId, loadConversations, loadFriends, loadBlocked, loadQuickReplies]);

  // 会话列表加载完成后，拉取每个会话的置顶/免打扰/归档设置
  useEffect(() => {
    if (conversations.length) void loadConversationSettings(conversations);
  }, [conversations, loadConversationSettings]);

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
      setViewMode('chat');
      setActiveConv(c);
      setActiveTemp(null);
      setRightPanel(c.type === 'group' ? 'info' : null);
      setGeneratedLink(null);
      setMessages([]);
      setLoadingMessages(true);
      // 移动端：先切换到全屏聊天视图。无论后续 socket / 网络请求是否异常，
      // 都要保证 UI 已经进入聊天界面，避免“点击会话没反应”。
      setShowChat(true);
      try {
        socket.joinConversation(c.id);
      } catch {
        /* socket 未就绪时忽略，不阻塞界面切换 */
      }
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

  // ---------- auto scroll：仅当用户在底部时才跟随新消息 ----------
  useEffect(() => {
    if (nearBottomRef.current) {
      msgEndRef.current?.scrollIntoView({ behavior: 'auto' });
    } else {
      // 用户在历史位置：累计未读数
      setUnreadCount((n) => n + 1);
    }
  }, [messages, activeConv?.id, activeTemp?.tempId]);

  // 切换会话时重置滚动位置与未读计数
  useEffect(() => {
    nearBottomRef.current = true;
    setShowScrollBtn(false);
    setUnreadCount(0);
    setReplyMsg(null);
    setEditingMsg(null);
  }, [activeConv?.id, activeTemp?.tempId]);

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
            // 携带回复引用（后端若不支持会忽略该字段）
            ...(replyMsg ? ({ replyToId: replyMsg.id } as Record<string, string>) : {}),
          } as Parameters<typeof conversationsApi.sendMessage>[1]);
          // 乐观更新：立即把自己发的消息渲染出来，不等 WS 回显
          appendToActive(activeConv.id, {
            ...sent,
            sender: {
              id: myId,
              username: user?.username,
              displayName: user?.displayName ?? user?.display_name,
            },
          });
          setReplyMsg(null);
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
    [activeConv, activeTemp, socket, appendToActive, myId, user, replyMsg],
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

  // ---------- 消息操作：更新本地消息 ----------
  const patchLocalMessage = useCallback((id: string, patch: Partial<Message>) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }, []);

  const removeLocalMessage = useCallback((id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  // ---------- 消息操作菜单 ----------
  const buildActionItems = useCallback(
    (m: Message): ActionMenuItem[] => {
      const mine = (m.senderId || m.sender_id) === myId;
      const ageMs = Date.now() - new Date(m.createdAt).getTime();
      const canEdit = mine && ageMs <= 5 * 60 * 1000; // 5 分钟内可编辑
      const canDelete = mine && ageMs <= 2 * 60 * 1000; // 2 分钟内可撤回
      const pinned = m.isPinned ?? false;
      return [
        { key: 'copy', label: '复制', icon: '📋' },
        { key: 'reply', label: '回复', icon: '↩️' },
        { key: 'forward', label: '转发', icon: '↪️' },
        ...(canEdit ? [{ key: 'edit', label: '编辑', icon: '✏️' }] : []),
        ...(canDelete ? [{ key: 'delete', label: '撤回', icon: '🗑️', danger: true }] : []),
        { key: 'react', label: '添加反应', icon: '😀' },
        { key: pinned ? 'unpin' : 'pin', label: pinned ? '取消置顶' : '置顶', icon: '📌' },
      ];
    },
    [myId],
  );

  const openActionsMenu = useCallback(
    (e: React.MouseEvent | React.TouchEvent, message: Message) => {
      // 右键 / 长按定位
      let x: number;
      let y: number;
      if ('clientX' in e) {
        x = e.clientX;
        y = e.clientY;
      } else {
        const t = e.touches[0];
        x = t?.clientX ?? window.innerWidth / 2;
        y = t?.clientY ?? window.innerHeight / 2;
      }
      setActionsMenu({ x, y, message });
    },
    [],
  );

  const copyMessage = useCallback(
    async (m: Message) => {
      try {
        await navigator.clipboard.writeText(m.content || '');
        showToast('已复制');
      } catch {
        window.prompt('复制内容', m.content || '');
      }
    },
    [showToast],
  );

  const startReply = useCallback((m: Message) => {
    setReplyMsg(m);
    setEditingMsg(null);
  }, []);

  const startEdit = useCallback(
    (m: Message) => {
      setEditingMsg(m);
      setReplyMsg(null);
    },
    [],
  );

  const finishEdit = useCallback(
    async (content: string) => {
      if (!editingMsg || !activeConv) return;
      try {
        const updated = await messagesApi.edit(editingMsg.id, content);
        patchLocalMessage(editingMsg.id, normalizeMessage(updated));
        showToast('消息已更新');
      } catch (e) {
        alert(prettyError(e));
      } finally {
        setEditingMsg(null);
      }
    },
    [editingMsg, activeConv, patchLocalMessage, showToast],
  );

  const confirmDelete = useCallback(
    async (m: Message) => {
      if (!window.confirm('确定撤回这条消息吗？')) return;
      try {
        await messagesApi.remove(m.id, true);
        removeLocalMessage(m.id);
        showToast('已撤回');
      } catch (e) {
        alert(prettyError(e));
      }
    },
    [removeLocalMessage, showToast],
  );

  const toggleReaction = useCallback(
    async (m: Message, emoji: string) => {
      try {
        const updated = await messagesApi.addReaction(m.id, emoji);
        patchLocalMessage(m.id, normalizeMessage(updated));
      } catch (e) {
        alert(prettyError(e));
      }
    },
    [patchLocalMessage],
  );

  const togglePin = useCallback(
    async (m: Message) => {
      if (!activeConv) return;
      try {
        if (m.isPinned) {
          await messagesApi.unpin(activeConv.id, m.id);
          patchLocalMessage(m.id, { isPinned: false });
          showToast('已取消置顶');
        } else {
          await messagesApi.pin(activeConv.id, m.id);
          patchLocalMessage(m.id, { isPinned: true });
          showToast('已置顶');
        }
      } catch (e) {
        alert(prettyError(e));
      }
    },
    [activeConv, patchLocalMessage, showToast],
  );

  const handleActionSelect = useCallback(
    (key: string, m: Message) => {
      switch (key) {
        case 'copy':
          void copyMessage(m);
          break;
        case 'reply':
          startReply(m);
          break;
        case 'forward':
          setForwardingMsg(m);
          break;
        case 'edit':
          startEdit(m);
          break;
        case 'delete':
          void confirmDelete(m);
          break;
        case 'react':
          setReactionFor(m);
          break;
        case 'pin':
        case 'unpin':
          void togglePin(m);
          break;
      }
    },
    [copyMessage, startReply, startEdit, confirmDelete, togglePin],
  );

  // ---------- 消息搜索（防抖） ----------
  const runSearch = useCallback(
    async (q: string) => {
      if (!activeConv) return;
      const kw = q.trim();
      if (!kw) {
        setMsgSearchResults([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      try {
        const list = await messagesApi.search(activeConv.id, kw);
        setMsgSearchResults((list || []).map(normalizeMessage));
      } catch {
        setMsgSearchResults([]);
      } finally {
        setSearching(false);
      }
    },
    [activeConv],
  );

  const onSearchQueryChange = useCallback(
    (q: string) => {
      setSearchQuery(q);
      if (searchDebounceRef.current) window.clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = window.setTimeout(() => void runSearch(q), 300);
    },
    [runSearch],
  );

  // 跳转到搜索命中的消息
  const jumpToMessage = useCallback((m: Message) => {
    setSearchOpen(false);
    window.setTimeout(() => {
      const el = document.querySelector(`[data-mid="${m.id}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('msg-jump-highlight');
        window.setTimeout(() => el.classList.remove('msg-jump-highlight'), 2000);
      }
    }, 50);
  }, []);

  // ---------- 消息列表滚动：判断是否接近底部 ----------
  const handleListScroll = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const dist = list.scrollHeight - list.scrollTop - list.clientHeight;
    const near = dist < 80;
    nearBottomRef.current = near;
    setShowScrollBtn(!near);
    if (near) setUnreadCount(0);
  }, []);

  const scrollToBottom = useCallback(() => {
    const list = listRef.current;
    if (list) {
      list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
    } else {
      msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    nearBottomRef.current = true;
    setShowScrollBtn(false);
    setUnreadCount(0);
  }, []);

  // ---------- 转发 ----------
  const doForward = useCallback(
    async (targetConvId: string) => {
      if (!forwardingMsg) return;
      try {
        await messagesApi.forward(forwardingMsg.id, targetConvId);
        showToast('已转发');
      } catch (e) {
        alert(prettyError(e));
      } finally {
        setForwardingMsg(null);
      }
    },
    [forwardingMsg, showToast],
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

  // ---------- virtual terminal ----------
  const openTerminal = async () => {
    if (terminalContainerId) {
      setViewMode('terminal');
      return;
    }
    setTerminalStarting(true);
    setTerminalError('');
    try {
      const r = await terminalApi.startTerminal();
      setTerminalContainerId(r.containerId);
      setViewMode('terminal');
    } catch (e) {
      const err = e as ApiError;
      if (err?.code === 'DOCKER_UNAVAILABLE' || err?.status === 503) {
        setTerminalError('虚拟终端功能需要服务器安装 Docker，请联系管理员');
      } else {
        setTerminalError(prettyError(e));
      }
      setViewMode('terminal');
    } finally {
      setTerminalStarting(false);
    }
  };

  const closeTerminal = useCallback(async () => {
    const id = terminalContainerId;
    setTerminalContainerId(null);
    setTerminalError('');
    setViewMode('chat');
    if (id) {
      try {
        await terminalApi.stopTerminal(id);
      } catch {
        /* ignore */
      }
    }
  }, [terminalContainerId]);

  // ---------- render helpers ----------
  const otherUserOf = (c: Conversation): User | undefined => {
    if (c.otherUser) return c.otherUser;
    const m = c.members?.find((mm) => {
      const uid = mm.userId ?? mm.user_id;
      return uid && uid !== myId;
    });
    if (!m) return undefined;
    return (
      m.user || ({
        id: m.userId ?? m.user_id,
        username: m.username ?? '',
        displayName: m.displayName ?? m.display_name ?? null,
        avatarUrl: m.avatarUrl ?? m.avatar_url ?? null,
      } as User)
    );
  };

  const typingNames = useMemo(() => {
    if (!activeConv) return [];
    const set = typingMap[activeConv.id] || new Set<string>();
    return Array.from(set).map((uid) => {
      const m = activeConv.members?.find((mm) => (mm.userId ?? mm.user_id) === uid);
      const u = m?.user || (m ? { displayName: m.displayName, display_name: m.display_name, username: m.username } : null);
      return u?.displayName || u?.display_name || u?.username || '对方';
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

  // 群成员（用于 @提及选择器）
  const mentionMembers = useMemo(() => {
    if (!activeConv || activeConv.type !== 'group') return [];
    return (activeConv.members || []).map((mm) => {
      const uid = mm.userId ?? mm.user_id ?? '';
      const u = mm.user;
      return {
        id: uid,
        name: u?.displayName || u?.display_name || u?.username || '',
        username: u?.username || '',
        avatar: u?.avatarUrl ?? u?.avatar_url ?? null,
      };
    });
  }, [activeConv]);

  // 回复上下文（传给 MessageInput 顶部预览条）
  const replyContext: ReplyContext | null = replyMsg
    ? {
        senderName:
          replyMsg.sender?.displayName ||
          replyMsg.sender?.display_name ||
          replyMsg.sender?.username,
        preview: (replyMsg.content || '').slice(0, 80),
      }
    : null;

  // 过滤 + 排序后的会话列表：置顶在前，按搜索过滤，归档默认隐藏
  const visibleConversations = useMemo(() => {
    const q = convQuery.trim().toLowerCase();
    const filtered = conversations.filter((c) => {
      const s = convSettingsMap[c.id];
      if (s?.archived && !showArchived) return false;
      if (!q) return true;
      const name =
        c.type === 'group'
          ? c.name || ''
          : otherUserOf(c)?.displayName || otherUserOf(c)?.display_name || otherUserOf(c)?.username || '';
      const lastText = (c.lastMessage ?? c.last_message)?.content || '';
      return name.toLowerCase().includes(q) || lastText.toLowerCase().includes(q);
    });
    filtered.sort((a, b) => {
      const pa = convSettingsMap[a.id]?.pinned ? 1 : 0;
      const pb = convSettingsMap[b.id]?.pinned ? 1 : 0;
      if (pa !== pb) return pb - pa;
      const ta = (a.lastMessage ?? a.last_message)?.createdAt || a.createdAt || a.created_at || '';
      const tb = (b.lastMessage ?? b.last_message)?.createdAt || b.createdAt || b.created_at || '';
      return String(tb).localeCompare(String(ta));
    });
    return filtered;
  }, [conversations, convSettingsMap, convQuery, showArchived]);

  // 会话右键菜单定位
  const onConvContextMenu = useCallback(
    (e: React.MouseEvent, conv: Conversation) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, conv });
    },
    [],
  );

  const handleConvAction = useCallback(
    async (action: 'pin' | 'mute' | 'archive' | 'read' | 'unread' | 'clear' | 'delete') => {
      const conv = contextMenu?.conv;
      if (!conv) return;
      const s = convSettingsMap[conv.id] || {};
      switch (action) {
        case 'pin':
          await applySetting(conv.id, { pinned: !s.pinned });
          break;
        case 'mute':
          await applySetting(conv.id, { muted: !s.muted });
          break;
        case 'archive':
          await applySetting(conv.id, { archived: !s.archived });
          break;
        case 'read':
          try {
            await conversationsApi.markRead(conv.id);
            setConversations((prev) => prev.map((c) => (c.id === conv.id ? { ...c, unreadCount: 0, unread_count: 0 } : c)));
            showToast('已标记为已读');
          } catch (e) {
            showToast(prettyError(e));
          }
          break;
        case 'unread':
          try {
            await conversationsApi.markUnread(conv.id);
            showToast('已标记为未读');
          } catch (e) {
            showToast(prettyError(e));
          }
          break;
        case 'clear':
          if (window.confirm('确定清空与该会话的聊天记录？')) {
            try {
              await conversationsApi.clearHistory(conv.id);
              if (activeConv?.id === conv.id) setMessages([]);
              showToast('已清空聊天记录');
            } catch (e) {
              showToast(prettyError(e));
            }
          }
          break;
        case 'delete':
          if (window.confirm('确定删除该会话？此操作不可恢复。')) {
            try {
              await conversationsApi.deleteConversation(conv.id);
              setConversations((prev) => prev.filter((c) => c.id !== conv.id));
              if (activeConv?.id === conv.id) {
                setActiveConv(null);
                setMessages([]);
              }
              showToast('会话已删除');
            } catch (e) {
              showToast(prettyError(e));
            }
          }
          break;
      }
    },
    [contextMenu, convSettingsMap, applySetting, activeConv, showToast],
  );

  // 打开用户资料卡
  const openProfile = useCallback(
    (u: User) => {
      if (u.id === myId) return;
      setProfileUser(u);
    },
    [myId],
  );

  const isFriendOf = useCallback(
    (uid: string) =>
      friends.some((f) => (f.friendId || f.friend_id) === uid || (f.userId || f.user_id) === uid),
    [friends],
  );

  // 与当前资料用户共同所在的群聊数量（遍历群会话，检查该用户是否在群成员中）
  const commonGroups = useMemo(() => {
    if (!profileUser) return 0;
    const uid = profileUser.id;
    return conversations.filter((c) => {
      if (c.type !== 'group') return false;
      return (c.members || []).some((m) => {
        const memberId = m.userId ?? m.user_id ?? m.user?.id;
        return memberId === uid;
      });
    }).length;
  }, [conversations, profileUser]);

  // 拖拽上传
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!activeConv) return;
    if (e.dataTransfer.types.includes('Files')) {
      dragDepthRef.current += 1;
      setDragging(true);
    }
  };
  const onDragLeave = () => {
    dragDepthRef.current -= 1;
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0;
      setDragging(false);
    }
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepthRef.current = 0;
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files || []);
    if (!activeConv || dropped.length === 0) return;
    for (const f of dropped) {
      const isImage = f.type.startsWith('image/');
      sendAttachment(f, isImage);
    }
  };

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
            title="设置"
            onClick={() => navigate('/settings')}
          >
            ⚙️
          </button>
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
            <ConversationSearch value={convQuery} onChange={setConvQuery} />
            {Object.values(convSettingsMap).some((s) => s?.archived) && (
              <button
                className="btn btn-ghost btn-sm conv-archive-toggle"
                onClick={() => setShowArchived((v) => !v)}
              >
                {showArchived ? '📥 隐藏归档' : '🗂️ 查看归档'}
              </button>
            )}
            <div className="sidebar-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => setCreateGroupOpen(true)}>
                + 新建群聊
              </button>
              <button className="btn btn-secondary btn-sm" onClick={openAiModal}>
                🤖 + AI 对话
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => void openTerminal()}
                disabled={terminalStarting}
              >
                {terminalStarting ? <Spinner size={14} /> : null}
                💻 终端
              </button>
            </div>
            <ConversationList
              conversations={visibleConversations}
              loading={loadingConvs}
              activeId={activeConv?.id || null}
              onSelect={openConversation}
              settingsMap={convSettingsMap}
              onContextMenu={onConvContextMenu}
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
                const u = f.user || f.friend || (f as unknown as User);
                if (!u) return null;
                return (
                  <FriendListItem
                    key={f.id || f.userId || f.friendId || u.id}
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
                  setViewMode('chat');
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
      <main
        className={`chat-main ${activeTemp ? 'temp-theme' : ''} ${viewMode === 'terminal' ? 'terminal-theme' : ''}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {dragging && !activeTemp && (
          <div className="drop-overlay">
            <div className="drop-overlay-inner">📤 松开以上传文件</div>
          </div>
        )}
        {viewMode === 'terminal' && terminalContainerId ? (
          <TerminalPanel
            containerId={terminalContainerId}
            onClose={() => void closeTerminal()}
            onError={(msg) => showToast(msg)}
          />
        ) : viewMode === 'terminal' && terminalError ? (
          <div className="empty-chat">
            <div className="terminal-unavailable-card">
              <div className="terminal-unavailable-icon">💻</div>
              <div className="terminal-unavailable-title">虚拟终端暂不可用</div>
              <div className="muted">{terminalError}</div>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setTerminalError('');
                  setViewMode('chat');
                }}
              >
                返回聊天
              </button>
            </div>
          </div>
        ) : !activeConv && !activeTemp ? (
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
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setSearchOpen(true);
                        setSearchQuery('');
                        setMsgSearchResults([]);
                      }}
                      title="搜索消息"
                    >
                      🔍
                    </button>
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

            <div className="chat-scroll-wrap">
              <div className="message-list" ref={listRef} onScroll={handleListScroll}>
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
                  groupedMessages.map((g, i) => {
                    if (g.type === 'day') {
                      return (
                        <div key={`d-${i}`} className="date-sep">
                          {g.date}
                        </div>
                      );
                    }
                    const m = g.message as Message;
                    return (
                      <div key={m.id} className="msg-wrapper" data-mid={m.id}>
                        <MessageBubble
                          kind="message"
                          message={m}
                          isMine={(m.senderId || m.sender_id) === myId}
                          createdAt={m.createdAt}
                          showSender={activeConv?.type === 'group'}
                          isAi={
                            m.isAi ||
                            m.sender?.username === 'ai_assistant' ||
                            activeConv?.type === 'ai'
                          }
                          senderName={
                            m.sender?.displayName || m.sender?.display_name || m.sender?.username
                          }
                          senderAvatar={m.sender?.avatarUrl ?? m.sender?.avatar_url ?? null}
                          reactions={m.reactions ?? null}
                          replyTo={m.replyTo ?? null}
                          isEdited={m.isEdited ?? false}
                          isPinned={m.isPinned ?? false}
                          onActions={(e) => openActionsMenu(e, m)}
                          onReactClick={(emoji) => void toggleReaction(m, emoji)}
                          onAvatarClick={(u) => {
                            if (u.id && u.id !== myId && u.username !== 'ai_assistant') openProfile(u);
                          }}
                        />
                      </div>
                    );
                  })
                )}
                <TypingIndicator names={typingNames} />
                <div ref={msgEndRef} />
              </div>
              <ScrollToBottomButton
                visible={showScrollBtn}
                unreadCount={unreadCount}
                onClick={scrollToBottom}
              />
              <MessageSearch
                open={searchOpen}
                query={searchQuery}
                onQueryChange={onSearchQueryChange}
                results={msgSearchResults}
                searching={searching}
                onJump={jumpToMessage}
                onClose={() => setSearchOpen(false)}
              />
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
                  replyTo={replyContext}
                  onCancelReply={() => {
                    setReplyMsg(null);
                    setEditingMsg(null);
                  }}
                  editContent={editingMsg ? editingMsg.content : null}
                  onFinishEdit={(c) => void finishEdit(c)}
                  members={mentionMembers}
                  enableMention={activeConv?.type === 'group'}
                  enterToSend
                  quickReplies={quickReplies}
                  onVoicePlaceholder={() => showToast('语音功能开发中（按住说话）')}
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
            activeConv.type === 'group' ? (
              <>
                <div className="share-block">
                  <button className="btn btn-primary btn-block" onClick={openShareModal}>
                    🔗 生成共享链接
                  </button>
                </div>
                <GroupInfoPanel
                  conversation={activeConv}
                  friends={friends}
                  messages={messages}
                  files={files}
                  myId={myId}
                  onChanged={() => void openConversation(activeConv)}
                  onLeave={() => {
                    setRightPanel(null);
                    setActiveConv(null);
                    setMessages([]);
                    void loadConversations();
                    showToast('已退出群聊');
                  }}
                  onOpenUserProfile={openProfile}
                  onDownloadFile={(name, url) => {
                    if (url) window.open(url, '_blank');
                  }}
                  onPreviewImage={(src) => {
                    window.open(src, '_blank');
                  }}
                />
              </>
            ) : (
              <div className="right-panel-body">
                <div className="share-block">
                  <button className="btn btn-primary btn-block" onClick={openShareModal}>
                    🔗 生成共享链接
                  </button>
                </div>
                <div className="members-block">
                  <div className="section-title">对方</div>
                  {(() => {
                    const u = otherUserOf(activeConv);
                    return u ? (
                      <div className="member-row" onClick={() => openProfile(u)}>
                        <UserAvatar name={u.username} size={32} src={u.avatarUrl ?? u.avatar_url ?? null} />
                        <div>
                          <div>{u.displayName || u.display_name || u.username}</div>
                          <div className="muted">@{u.username}</div>
                        </div>
                      </div>
                    ) : null;
                  })()}
                </div>
              </div>
            )
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

      {/* MESSAGE ACTIONS CONTEXT MENU */}
      {actionsMenu && (
        <MessageActions
          x={actionsMenu.x}
          y={actionsMenu.y}
          items={buildActionItems(actionsMenu.message)}
          onSelect={(key) => handleActionSelect(key, actionsMenu.message)}
          onClose={() => setActionsMenu(null)}
        />
      )}

      {/* REACTION PICKER FLOATING */}
      {reactionFor && (
        <div className="reaction-float-wrap">
          <div className="reaction-float-mask" onClick={() => setReactionFor(null)} />
          <ReactionPicker
            onSelect={(emoji) => {
              void toggleReaction(reactionFor, emoji);
              setReactionFor(null);
            }}
            onClose={() => setReactionFor(null)}
          />
        </div>
      )}

      {/* FORWARD MODAL */}
      <Modal
        open={!!forwardingMsg}
        title="转发到"
        onClose={() => setForwardingMsg(null)}
        footer={
          <button className="btn btn-ghost" onClick={() => setForwardingMsg(null)}>
            取消
          </button>
        }
      >
        <div className="form">
          <div className="muted">选择一个会话转发这条消息：</div>
          {conversations.length === 0 && <div className="empty-list">暂无可转发的会话</div>}
          {conversations
            .filter((c) => c.id !== activeConv?.id)
            .map((c) => {
              const name =
                c.type === 'group'
                  ? c.name || '群聊'
                  : otherUserOf(c)?.displayName ||
                    otherUserOf(c)?.display_name ||
                    otherUserOf(c)?.username ||
                    '私聊';
              return (
                <div key={c.id} className="forward-row">
                  <UserAvatar
                    name={otherUserOf(c)?.username || '?'}
                    size={32}
                    src={
                      c.type === 'group'
                        ? null
                        : otherUserOf(c)?.avatarUrl ?? otherUserOf(c)?.avatar_url ?? null
                    }
                  />
                  <span className="forward-name">{name}</span>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => void doForward(c.id)}
                  >
                    转发
                  </button>
                </div>
              );
            })}
        </div>
      </Modal>

      {/* 会话右键菜单 */}
      {contextMenu && (
        <ConversationMenu
          x={contextMenu.x}
          y={contextMenu.y}
          settings={convSettingsMap[contextMenu.conv.id]}
          onClose={() => setContextMenu(null)}
          onPin={() => void handleConvAction('pin')}
          onMute={() => void handleConvAction('mute')}
          onArchive={() => void handleConvAction('archive')}
          onMarkRead={() => void handleConvAction('read')}
          onMarkUnread={() => void handleConvAction('unread')}
          onClear={() => void handleConvAction('clear')}
          onDelete={() => void handleConvAction('delete')}
        />
      )}

      {/* 用户资料卡 */}
      <UserProfileModal
        open={!!profileUser}
        user={profileUser}
        isFriend={profileUser ? isFriendOf(profileUser.id) : false}
        isBlocked={profileUser ? blockedUserIds.has(profileUser.id) : false}
        isSelf={profileUser ? profileUser.id === myId : false}
        commonGroups={commonGroups}
        onClose={() => setProfileUser(null)}
        onSendMessage={(uid) => void openPrivateChat(uid)}
        onAtMention={() => showToast('已 @ 该用户')}
        onChange={() => void loadFriends()}
        onBlockedChange={() => void loadBlocked()}
      />
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
