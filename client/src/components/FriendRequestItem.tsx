import type { FriendRequest } from '../types';
import { FriendListItem } from './FriendList';
import { Spinner } from './Spinner';

interface Props {
  request: FriendRequest;
  busy?: boolean;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}

export function FriendRequestItem({ request, busy, onAccept, onReject }: Props) {
  const u = request.user;
  const name = u?.displayName || u?.display_name || u?.username || '未知用户';
  return (
    <FriendListItem
      name={name}
      avatar={u?.avatarUrl ?? u?.avatar_url ?? null}
      subtitle={u?.email || `@${u?.username || ''}`}
      buttons={
        busy ? (
          <Spinner size={16} />
        ) : (
          <>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => onAccept(request.id)}
              disabled={busy}
            >
              接受
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => onReject(request.id)}
              disabled={busy}
            >
              拒绝
            </button>
          </>
        )
      }
    />
  );
}
