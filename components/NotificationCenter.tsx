import React, { useState, useEffect } from 'react';
import { Bell, X, CheckCircle, AlertTriangle, Info, Clock, Mail, TrendingUp, MapPin } from 'lucide-react';
import { supabase } from '../supabaseClient';

interface Notification {
  id: string;
  type: 'success' | 'warning' | 'info' | 'scan';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  data?: any;
}

interface NotificationCenterProps {
  onNewScan?: (scanData: any) => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ onNewScan }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Initialize with sample notifications
    const initialNotifications: Notification[] = [
      {
        id: '1',
        type: 'success',
        title: 'स्कैन पूर्ण | Scan Complete',
        message: 'Mumbai (400001) mail successfully processed',
        timestamp: new Date(Date.now() - 300000), // 5 mins ago
        read: false
      },
      {
        id: '2',
        type: 'info',
        title: 'सिस्टम अपडेट | System Update',
        message: 'AI model accuracy improved to 97.8%',
        timestamp: new Date(Date.now() - 900000), // 15 mins ago
        read: false
      },
      {
        id: '3',
        type: 'warning',
        title: 'उच्च ट्रैफिक | High Traffic',
        message: 'Delhi sorting center experiencing high volume',
        timestamp: new Date(Date.now() - 1800000), // 30 mins ago
        read: true
      }
    ];
    setNotifications(initialNotifications);
    setUnreadCount(initialNotifications.filter(n => !n.read).length);

    // Set up real-time listener for new scans
    const subscription = supabase
      .channel('scan_notifications')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'scans' }, 
        (payload) => {
          addNotification({
            type: 'scan',
            title: 'नई स्कैन | New Scan',
            message: `Mail processed for ${payload.new.data?.address || 'unknown address'}`,
            data: payload.new
          });
          onNewScan?.(payload.new);
        }
      )
      .subscribe();

    // Simulate periodic system notifications
    const systemNotificationInterval = setInterval(() => {
      if (Math.random() > 0.7) {
        const notifications = [
          {
            type: 'info' as const,
            title: 'प्रदर्शन अपडेट | Performance Update',
            message: `Processing rate: ${(Math.random() * 100 + 400).toFixed(0)} mails/hour`
          },
          {
            type: 'success' as const,
            title: 'नया मार्ग | New Route',
            message: 'Optimized delivery route for Zone-' + Math.floor(Math.random() * 10)
          },
          {
            type: 'warning' as const,
            title: 'कैपेसिटी अलर्ट | Capacity Alert',
            message: 'Sorting center at 85% capacity'
          }
        ];
        
        const randomNotification = notifications[Math.floor(Math.random() * notifications.length)];
        addNotification(randomNotification);
      }
    }, 45000); // Every 45 seconds

    return () => {
      subscription.unsubscribe();
      clearInterval(systemNotificationInterval);
    };
  }, [onNewScan]);

  const addNotification = (notificationData: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      ...notificationData,
      id: Date.now().toString(),
      timestamp: new Date(),
      read: false
    };

    setNotifications(prev => [newNotification, ...prev.slice(0, 9)]); // Keep last 10
    setUnreadCount(prev => prev + 1);
  };

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-5 h-5 text-[#138808]" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-[#FF6600]" />;
      case 'scan': return <Mail className="w-5 h-5 text-[#000080]" />;
      default: return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);
    
    if (diffInMinutes < 1) return 'अभी | Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}म पहले | ${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}घ पहले | ${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}द पहले | ${diffInDays}d ago`;
  };

  return (
    <div className="relative">
      {/* Notification Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-white/50 transition-all duration-200 group"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-12 w-96 bg-white rounded-2xl shadow-2xl border border-orange-200 z-50 max-h-96 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-slate-800">सूचनाएं | Notifications</h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">{notifications.length} total notifications</span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
                  >
                    सभी पढ़ें | Mark all read
                  </button>
                )}
              </div>
            </div>

            {/* Notifications List */}
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-slate-500">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>कोई सूचना नहीं | No notifications</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer ${
                      !notification.read ? 'bg-orange-50/50 border-l-4 border-l-[#FF6600]' : ''
                    }`}
                    onClick={() => !notification.read && markAsRead(notification.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-1">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-slate-800 text-sm truncate">
                          {notification.title}
                        </h4>
                        <p className="text-slate-600 text-xs mt-1 leading-relaxed">
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span className="text-xs text-slate-400">
                            {formatRelativeTime(notification.timestamp)}
                          </span>
                          {!notification.read && (
                            <span className="w-2 h-2 bg-blue-500 rounded-full ml-auto"></span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
              <span className="text-xs text-slate-500">भारतीय डाक विभाग | India Post</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationCenter;