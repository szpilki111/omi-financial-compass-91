import React, { useState } from 'react';
import { Menu, X, ChevronDown, LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { user, logout } = useAuth();

  // Określamy dostępne elementy menu bazując na roli użytkownika
  const menuItems = React.useMemo(() => {
    const items = [
      { name: 'Strona główna', href: '/dashboard' },
      { name: 'Księga KPiR', href: '/kpir' },
      { name: 'Raporty', href: '/raporty' },
      { name: 'Wizualizacja danych', href: '/wizualizacja' },
      { name: 'Baza wiedzy', href: '/baza-wiedzy' },
    ];
    
    // Tylko admin i prowincjał widzą sekcję administracji
    if (user && (user.role === 'admin' || user.role === 'prowincjal')) {
      items.push({ name: 'Administracja', href: '/admin' });
    }
    
    return items;
  }, [user]);

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  const toggleUserMenu = () => setUserMenuOpen(!userMenuOpen);

  const handleLogout = () => {
    logout();
  };

  return (
    <header className="bg-white shadow-sm border-b border-omi-gray-200">
      <div className="mx-auto px-4">
        <div className="flex justify-between h-16">
          {/* Logo and mobile menu button */}
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <span className="text-omi-500 font-bold text-2xl">OMI Finanse</span>
            </div>
            <div className="hidden md:ml-6 md:flex md:space-x-4 items-center">
              {menuItems.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className="px-3 py-2 text-omi-gray-700 hover:text-omi-500 hover:bg-omi-100 rounded-md text-sm font-medium"
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </div>

          {/* User dropdown and logout button */}
          <div className="flex items-center">
            {user && (
              <div className="relative ml-3 hidden md:block">
                <div>
                  <button
                    onClick={toggleUserMenu}
                    className="flex items-center text-sm rounded-full focus:outline-none"
                    id="user-menu-button"
                    aria-expanded={userMenuOpen}
                    aria-haspopup="true"
                  >
                    <span className="mr-2 text-omi-gray-700">{user.name}</span>
                    <span className="text-xs text-omi-gray-500 mr-2">{user.location}</span>
                    <ChevronDown className="h-4 w-4 text-omi-gray-500" />
                  </button>
                </div>
                {userMenuOpen && (
                  <div
                    className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 py-1"
                    role="menu"
                    aria-orientation="vertical"
                    aria-labelledby="user-menu-button"
                  >
                    <div className="block px-4 py-2 text-xs text-omi-gray-500">
                      Zalogowano jako: {user.role}
                    </div>
                    <Link
                      to="/profil"
                      className="block px-4 py-2 text-sm text-omi-gray-700 hover:bg-omi-100"
                      role="menuitem"
                    >
                      Profil
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 text-sm text-omi-gray-700 hover:bg-omi-100"
                      role="menuitem"
                    >
                      Wyloguj
                    </button>
                  </div>
                )}
              </div>
            )}

            {user && (
              <div className="hidden md:ml-4 md:flex">
                <button
                  onClick={handleLogout}
                  className="flex items-center px-3 py-2 text-omi-gray-700 hover:text-omi-500 hover:bg-omi-100 rounded-md text-sm font-medium"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Wyloguj
                </button>
              </div>
            )}

            {/* Mobile menu button */}
            <div className="flex md:hidden">
              <button
                onClick={toggleMenu}
                className="inline-flex items-center justify-center p-2 rounded-md text-omi-gray-700 hover:text-omi-500 hover:bg-omi-100 focus:outline-none"
              >
                {isMenuOpen ? (
                  <X className="block h-6 w-6" />
                ) : (
                  <Menu className="block h-6 w-6" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {menuItems.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className="block px-3 py-2 rounded-md text-base font-medium text-omi-gray-700 hover:text-omi-500 hover:bg-omi-100"
                onClick={toggleMenu}
              >
                {item.name}
              </Link>
            ))}
            {user && (
              <div className="border-t border-omi-gray-200 mt-2 pt-2">
                <div className="px-3 py-1 text-xs text-omi-gray-500">
                  Zalogowano jako: {user.role}
                </div>
                <div className="px-3 py-1 text-xs text-omi-gray-500 mb-2">
                  {user.location}
                </div>
                <Link
                  to="/profil"
                  className="block px-3 py-2 rounded-md text-base font-medium text-omi-gray-700 hover:text-omi-500 hover:bg-omi-100"
                >
                  Profil
                </Link>
                <button
                  onClick={handleLogout}
                  className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-omi-gray-700 hover:text-omi-500 hover:bg-omi-100"
                >
                  <div className="flex items-center">
                    <LogOut className="h-4 w-4 mr-2" />
                    Wyloguj
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
