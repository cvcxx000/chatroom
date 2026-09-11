interface Props {
  children: React.ReactNode;
  variant?: 'default' | 'temp' | 'online' | 'warn' | 'danger';
  className?: string;
}

export function Badge({ children, variant = 'default', className = '' }: Props) {
  return <span className={`badge badge-${variant} ${className}`}>{children}</span>;
}
