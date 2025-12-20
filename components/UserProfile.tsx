import React, { useState } from 'react';
import { User, Settings, LogOut, Shield, Mail, Bell, Globe } from 'lucide-react';

interface UserProfileProps {
  onAction?: (action: string) => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ onAction }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const userInfo = {
    name: 'राज कुमार | Raj Kumar',
    role: 'डाक अधिकारी | Postal Officer',
    department: 'भारतीय डाक विभाग',
    id: 'IP2024001',
    location: 'मुंबई मुख्य डाक घर'
  };

  const menuItems = [
    { 
      icon: <User className="w-4 h-4" />, 
      label: 'प्रोफाइल | Profile',
      action: 'profile'
    },
    { 
      icon: <Settings className="w-4 h-4" />, 
      label: 'सेटिंग्स | Settings',
      action: 'settings'
    },
    { 
      icon: <Bell className="w-4 h-4" />, 
      label: 'अलर्ट प्राथमिकताएं | Alert Preferences',
      action: 'notifications'
    },
    { 
      icon: <Globe className="w-4 h-4" />, 
      label: 'भाषा | Language',
      action: 'language'
    },
    { 
      icon: <LogOut className="w-4 h-4" />, 
      label: 'लॉग आउट | Logout',
      action: 'logout',
      danger: true
    }
  ];

  const handleAction = (action: string) => {
    setIsOpen(false);
    onAction?.(action);
    
    // Handle basic actions
    switch (action) {
      case 'logout':
        console.log('Logout requested');
        break;
      case 'settings':
        console.log('Settings opened');
        break;
      default:
        console.log(`Action: ${action}`);
    }
  };

  return (
    <div className="relative">
      {/* User Avatar Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 p-2 rounded-xl text-slate-600 hover:text-slate-800 hover:bg-orange-50 transition-all duration-200 group"
      >
        <div className="h-9 w-9 rounded-full bg-blue-100 border-2 border-blue-300 flex items-center justify-center text-blue-700 font-semibold shadow-sm">
          <User className="w-5 h-5" />
        </div>
        <div className="hidden md:block text-left">
          <div className="text-sm font-semibold text-slate-700">Raj Kumar</div>
          <div className="text-xs text-orange-600">Postal Officer</div>
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-12 w-72 bg-white rounded-2xl shadow-xl border border-orange-200 z-50 overflow-hidden">
            {/* User Info Header */}
            <div className="p-4 bg-blue-50 border-b border-blue-200">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-blue-200 border-2 border-blue-400 flex items-center justify-center text-blue-800 font-bold shadow-md">
                  <User className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-slate-800 text-sm">{userInfo.name}</h3>
                  <p className="text-xs text-blue-700 font-medium">{userInfo.role}</p>
                  <p className="text-xs text-slate-600">{userInfo.department}</p>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 bg-blue-200 rounded-full">
                  <Shield className="w-3 h-3 text-blue-800" />
                  <span className="text-xs font-bold text-blue-800">{userInfo.id}</span>
                </div>
              </div>
              <div className="mt-2 text-xs text-slate-600 flex items-center gap-1">
                <Mail className="w-3 h-3" />
                {userInfo.location}
              </div>
            </div>

            {/* Menu Items */}
            <div className="py-2">
              {menuItems.map((item, index) => (
                <button
                  key={index}
                  onClick={() => handleAction(item.action)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors ${
                    item.danger 
                      ? 'text-red-600 hover:bg-red-50 border-t border-slate-100 mt-2 pt-3' 
                      : 'text-slate-700'
                  }`}
                >
                  <div className={`p-1.5 rounded-lg ${
                    item.danger 
                      ? 'bg-red-100 text-red-600' 
                      : 'bg-blue-100 text-blue-600'
                  }`}>
                    {item.icon}
                  </div>
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              ))}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 text-center">
              <span className="text-xs text-slate-500">India Post Digital Portal</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default UserProfile;