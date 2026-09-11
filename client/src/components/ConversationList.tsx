import type { Conversation } from '../types';
import { ConversationItem } from './ConversationItem';
import { Spinner } from './Spinner';

interface Props {
  conversations: Conversation[];
  loading?: boolean;
  activeId?: string | null;
  onSelect: (c: Conversation) => void;
}

export function ConversationList({ conversations, loading, activeId, onSelect }: Props) {
  if (loading) {
    return (
      <div className="empty-list">
        <Spinner />
      </div>
    );
  }
  if (conversations.length === 0) {
    return <div className="empty-list">还没有会话，去添加朋友或创建群聊吧</div>;
  }
  return (
    <div className="conv-list">
      {conversations.map((c) => (
        <ConversationItem
          key={c.id}
          conversation={c}
          active={c.id === activeId}
          onClick={() => onSelect(c)}
        />
      ))}
    </div>
  );
}
