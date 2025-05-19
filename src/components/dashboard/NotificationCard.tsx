
import React from 'react';
import { cn } from '@/lib/utils';

interface Notification {
  id: string;
  title: string;
  message: string;
  date: string;
  priority: 'low' | 'medium' | 'high';
  read: boolean;
  action?: {
    label: string;
    link: string;
  };
}

interface NotificationCardProps {
  notification: Notification;
  className?: string;
  onMarkAsRead?: (id: string) => void;
}

const NotificationCard: React.FC<NotificationCardProps> = ({
  notification,
  className,
  onMarkAsRead,
}) => {
  const priorityClasses = {
    high: 'border-l-4 border-red-500 bg-red-50',
    medium: 'border-l-4 border-yellow-500 bg-yellow-50',
    low: 'border-l-4 border-blue-500 bg-blue-50',
  };

  return (
    <div
      className={cn(
        'p-4 rounded-md mb-2',
        priorityClasses[notification.priority],
        notification.read ? 'opacity-75' : '',
        className
      )}
    >
      <div className="flex justify-between">
        <h4 className="font-medium text-omi-gray-800">{notification.title}</h4>
        <span className="text-xs text-omi-gray-500">{notification.date}</span>
      </div>
      <p className="text-sm text-omi-gray-600 mt-1">{notification.message}</p>
      <div className="flex justify-between items-center mt-2">
        {notification.action && (
          <a
            href={notification.action.link}
            className="text-sm text-omi-500 hover:underline"
          >
            {notification.action.label}
          </a>
        )}
        {!notification.read && onMarkAsRead && (
          <button
            onClick={() => onMarkAsRead(notification.id)}
            className="text-xs text-omi-gray-500 hover:text-omi-600"
          >
            Oznacz jako przeczytane
          </button>
        )}
      </div>
    </div>
  );
};

export default NotificationCard;
