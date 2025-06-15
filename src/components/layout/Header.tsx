
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const Header = () => {
  const location = useLocation();
  const { user, logout } = useAuth();

  // Updated navigation items - removed KPiR from menu
  const getNavItems = () => {
    const baseItems = [];

    // Dokumenty - dla wszystkich zalogowanych użytkowników
    baseItems.push({ name: 'Dokumenty', path: '/dokumenty' });

    // Pozostałe pozycje dla wszystkich zalogowanych użytkowników
    baseItems.push(
      { name: 'Raporty', path: '/reports' },
      { name: 'Ustawienia', path: '/settings' }
    );

    // Administracja dla prowincjała i admina
    if (user?.role === 'prowincjal' || user?.role === 'admin') {
      baseItems.push({ name: 'Administracja', path: '/administracja' });
    }

    return baseItems;
  };

  const navItems = getNavItems();

  // Zwracanie inicjału imienia użytkownika
  const getInitial = () => {
    if (user?.name) {
      return user.name.charAt(0).toUpperCase();
    }
    if (user?.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return '?';
  };

  return (
    <header className="symfonia-window">
      {/* Title bar */}
      <div className="symfonia-titlebar mb-1">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <span className="text-white font-bold text-sm">
              Finanse OMI - System Raportowania
            </span>
          </div>
          {user && (
            <div className="flex items-center text-white text-xs">
              <span className="mr-4">Użytkownik: {user.name || user.email}</span>
            </div>
          )}
        </div>
      </div>

      {/* Menu bar */}
      {user && (
        <div className="symfonia-menubar">
          <div className="flex justify-between items-center">
            <nav className="flex">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`symfonia-menu-item ${
                    location.pathname === item.path ? 'font-bold' : ''
                  }`}
                >
                  {item.name}
                </Link>
              ))}
            </nav>
            
            {/* User menu */}
            <div className="flex items-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="symfonia-button text-xs">
                    {getInitial()} ▼
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="symfonia-window no-modern-style">
                  <DropdownMenuLabel className="symfonia-label">Moje konto</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => logout()} className="symfonia-menu-item">
                    Wyloguj
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
