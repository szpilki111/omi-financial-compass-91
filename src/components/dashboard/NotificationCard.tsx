
import React from 'react';
import { cn } from '@/lib/utils';
import { Clock, AlertCircle, Info, CheckCircle } from 'lucide-react';

interface Notification {
  id: string;
  title: string;
  message: string;
  date: string;
  priority: 'low' | 'medium' | 'high';
  read: boolean;
  action_label?: string;
  action_link?: string;
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
  const getPriorityConfig = () => {
    switch (notification.priority) {
      case 'high':
        return {
          icon: <AlertCircle className="h-4 w-4" />,
          borderColor: 'border-l-red-500',
          bgColor: 'bg-red-50',
          iconColor: 'text-red-500'
        };
      case 'medium':
        return {
          icon: <Clock className="h-4 w-4" />,
          borderColor: 'border-l-yellow-500',
          bgColor: 'bg-yellow-50',
          iconColor: 'text-yellow-600'
        };
      default:
        return {
          icon: <Info className="h-4 w-4" />,
          borderColor: 'border-l-blue-500',
          bgColor: 'bg-blue-50',
          iconColor: 'text-blue-500'
        };
    }
  };

  const config = getPriorityConfig();

  return (
    <div
      className={cn(
        'bg-white rounded-lg shadow-sm border-l-4 p-4 transition-all duration-200',
        config.borderColor,
        notification.read ? 'opacity-75' : '',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn('mt-0.5', config.iconColor)}>
          {config.icon}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start mb-1">
            <h4 className="font-medium text-gray-900 text-sm truncate">
              {notification.title}
            </h4>
            <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
              {notification.date}
            </span>
          </div>
          
          <p className="text-sm text-gray-600 mb-3 leading-relaxed">
            {notification.message}
          </p>
          
          <div className="flex justify-between items-center">
            {notification.action_label && notification.action_link && (
              <a
                href={notification.action_link}
                className="text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium"
              >
                {notification.action_label}
              </a>
            )}
            
            {!notification.read && onMarkAsRead && (
              <button
                onClick={() => onMarkAsRead(notification.id)}
                className="text-xs text-gray-500 hover:text-gray-700 ml-auto flex items-center gap-1"
              >
                <CheckCircle className="h-3 w-3" />
                Oznacz jako przeczytane
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationCard;
