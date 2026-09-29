import type { ReactNode } from 'react';

// An empty screen says what will appear here and how to get it there.
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <h2 className="empty-state__title">{title}</h2>
      <p className="empty-state__body">{children}</p>
      {action}
    </div>
  );
}
