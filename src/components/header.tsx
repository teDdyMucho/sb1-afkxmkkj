import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { 
  LogOut, 
  Home,
  User,
  Gamepad2,
  ShieldCheck,
  Coins,
  Wallet,
  Menu,
  X
} from 'lucide-react';
import { useState } from 'react';

export function Header() {
  const { user, logout } = useAuthStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navigateToPanel = (panel: 'home' | 'user' | 'game' | 'admin' | null) => {
    if (panel) {
      window.location.hash = panel;
    } else {
      window.location.hash = '';
    }
    setIsMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 border-b bg-white">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold">FLOWER BET</h1>
            {user && (
              <span className="hidden text-sm text-gray-600 md:block">
                Welcome, {user.username}
              </span>
            )}
          </div>

          {user && (
            <>
              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 md:hidden"
              >
                {isMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>

              {/* Desktop Navigation */}
              <div className="hidden items-center space-x-4 md:flex">
                <div className="flex space-x-2">
                  <Button
                    onClick={() => navigateToPanel('home')}
                    variant="ghost"
                    className="flex items-center space-x-2 text-gray-600 hover:bg-gray-50 hover:text-gray-700"
                  >
                    <Home className="h-4 w-4" />
                    <span>Home</span>
                  </Button>
                  <Button
                    onClick={() => navigateToPanel('user')}
                    variant="ghost"
                    className="flex items-center space-x-2 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                  >
                    <User className="h-4 w-4" />
                    <span>Game Info</span>
                  </Button>
                  <Button
                    onClick={() => navigateToPanel('game')}
                    variant="ghost"
                    className="flex items-center space-x-2 text-green-600 hover:bg-green-50 hover:text-green-700"
                  >
                    <Gamepad2 className="h-4 w-4" />
                    <span>Game Panel</span>
                  </Button>
                  {user.isAdmin && (
                    <Button
                      onClick={() => navigateToPanel('admin')}
                      variant="ghost"
                      className="flex items-center space-x-2 text-purple-600 hover:bg-purple-50 hover:text-purple-700"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      <span>Admin Panel</span>
                    </Button>
                  )}
                </div>

                <div className="flex space-x-4 rounded-md bg-gray-100 px-4 py-2">
                  <div className="flex items-center space-x-2">
                    <Coins className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm font-medium">
                      FBT: {user.points}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Wallet className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium">
                      Cash: {user.cash || 0}
                    </span>
                  </div>
                </div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={logout}
                  className="flex items-center space-x-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </Button>
              </div>

              {/* Mobile Menu */}
              {isMenuOpen && (
                <div className="absolute left-0 right-0 top-16 border-t bg-white p-4 shadow-lg md:hidden">
                  <div className="space-y-2">
                    <Button
                      onClick={() => navigateToPanel('home')}
                      variant="ghost"
                      className="flex w-full items-center justify-start space-x-2 text-gray-600"
                    >
                      <Home className="h-4 w-4" />
                      <span>Home</span>
                    </Button>
                    <Button
                      onClick={() => navigateToPanel('user')}
                      variant="ghost"
                      className="flex w-full items-center justify-start space-x-2 text-blue-600"
                    >
                      <User className="h-4 w-4" />
                      <span>Game Info</span>
                    </Button>
                    <Button
                      onClick={() => navigateToPanel('game')}
                      variant="ghost"
                      className="flex w-full items-center justify-start space-x-2 text-green-600"
                    >
                      <Gamepad2 className="h-4 w-4" />
                      <span>Game Panel</span>
                    </Button>
                    {user.isAdmin && (
                      <Button
                        onClick={() => navigateToPanel('admin')}
                        variant="ghost"
                        className="flex w-full items-center justify-start space-x-2 text-purple-600"
                      >
                        <ShieldCheck className="h-4 w-4" />
                        <span>Admin Panel</span>
                      </Button>
                    )}

                    <div className="my-4 space-y-2 rounded-md bg-gray-100 p-4">
                      <div className="flex items-center space-x-2">
                        <Coins className="h-4 w-4 text-yellow-600" />
                        <span className="text-sm font-medium">
                          FBT: {user.points}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Wallet className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium">
                          Cash: {user.cash || 0}
                        </span>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      onClick={logout}
                      className="flex w-full items-center justify-start space-x-2 text-red-600"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Logout</span>
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}