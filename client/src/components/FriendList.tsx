import { UserAvatar } from './UserAvatar';

interface Props {
  name: string;
  avatar?: string | null;
  subtitle?: string;
  right?: React.ReactNode;
  onClick?: () => void;
  buttons?: React.ReactNode;
}

export function FriendListItem({ name, avatar, subtitle, right, onClick, buttons }: Props) {
  return (
    <div className={`friend-item ${onClick ? 'clickable' : ''}`} onClick={onClick}>
      <UserAvatar name={name} src={avatar} size={40} />
      <div className="friend-item-body">
        <div className="friend-item-name">{name}</div>
        {subtitle && <div className="friend-item-sub">{subtitle}</div>}
      </div>
      {right && <div className="friend-item-right">{right}</div>}
      {buttons && <div className="friend-item-actions">{buttons}</div>}
    </div>
  );
}
