import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useStyleSettings } from "@/hooks/useStyleSettings";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ErrorReportButton } from "@/components/ErrorReportButton";

const Header = () => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { isWindows98Style } = useStyleSettings();

  const getNavItems = () => {
    const baseItems = [];

    baseItems.push({
      name: "Dokumenty",
      path: "/dokumenty",
      icon: "/88a736db-1198-4c92-b31a-d8b7c4c8adb7.png",
    });

    baseItems.push(
      {
        name: "Raporty",
        path: "/reports",
        icon: "/021f933f-b354-4042-b593-acbe82f67257.png",
      },
      {
        name: "Budżet",
        path: "/budzet",
        icon: "/021f933f-b354-4042-b593-acbe82f67257.png",
      },
      {
        name: "Baza wiedzy",
        path: "/baza-wiedzy",
        icon: "/021f933f-b354-4042-b593-acbe82f67257.png",
      },
      {
        name: "Ustawienia",
        path: "/settings",
        icon: "/ef42a7e5-53d2-4c0a-8208-6e4863ef2f82.png",
      },
    );

    if (user?.role === "prowincjal" || user?.role === "admin") {
      baseItems.push({
        name: "Administracja",
        path: "/administracja",
        icon: "/ef42a7e5-53d2-4c0a-8208-6e4863ef2f82.png",
      });
    }

    return baseItems;
  };

  const navItems = getNavItems();

  const getInitial = () => {
    if (user?.name) {
      return user.name.charAt(0).toUpperCase();
    }
    if (user?.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return "?";
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between">
          <div className="flex items-center">
            <Link to="/dashboard" className="flex-shrink-0 flex items-center cursor-pointer">
              <img className="h-8 w-auto" src="/favicon.ico" alt="Logo OMI" />
              <span className="ml-2 text-lg font-semibold text-omi-500">Finanse OMI</span>
            </Link>

            {user && (
              <nav className="hidden md:ml-6 md:flex md:space-x-4">
                {navItems.map((item) => (
                  <Link
                    key={item.name}
                    to={item.path}
                    className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors
                    ${
                      location.pathname === item.path
                        ? "text-omi-600 bg-gray-100"
                        : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                    }`}
                    title={item.name}
                  >
                    {isWindows98Style ? <img src={item.icon} alt={item.name} className="w-6 h-6" /> : item.name}
                  </Link>
                ))}
              </nav>
            )}
          </div>

          <div className="flex items-center gap-2">
            {user ? (
              <>
                <ErrorReportButton />
                <div className="flex items-center">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="rounded-full">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-omi-300 text-white">{getInitial()}</AvatarFallback>
                        </Avatar>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => logout()}>Wyloguj</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </>
            ) : (
              <Link to="/login">
                <Button variant="default" size="sm">
                  Logowanie
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
