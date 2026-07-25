import { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import Button from './ui/Button';

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const { isDark, toggleTheme } = useContext(ThemeContext);
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="fixed top-0 w-full z-50 bg-surface-glass backdrop-blur-md border-b border-border-glass shadow-sm transition-all duration-300">
      <div className="flex justify-between items-center h-16 px-4 sm:px-6 md:px-8 max-w-container-max mx-auto">
        <div className="flex items-center gap-stack-md">
          <Link to="/" className="font-display-lg text-headline-md bg-clip-text text-transparent bg-accent-gradient">
            ShortyURL
          </Link>
        </div>
        
        {user && (
          <nav className="hidden md:flex gap-8">
            <Link to="/dashboard" className="text-on-surface-variant hover:text-on-surface transition-colors font-body-md text-body-md active:scale-95">Dashboard</Link>
            {user.role === 'admin' && (
              <Link to="/admin" className="text-on-surface-variant hover:text-on-surface transition-colors font-body-md text-body-md active:scale-95">Admin</Link>
            )}
          </nav>
        )}

        <div className="flex items-center gap-4">
          <button 
            onClick={toggleTheme}
            className="material-symbols-outlined text-on-surface-variant hover:text-on-surface transition-all active:scale-95"
            title="Toggle theme"
          >
            {isDark ? 'light_mode' : 'dark_mode'}
          </button>
          
          <div className="hidden md:flex items-center gap-4">
            {user ? (
              <button 
                onClick={handleLogout}
                className="text-on-surface-variant hover:text-on-surface transition-colors text-label-sm font-label-sm uppercase tracking-wider"
              >
                Logout
              </button>
            ) : (
              <>
                <Link to="/login" className="text-on-surface-variant hover:text-on-surface transition-colors text-label-sm font-label-sm uppercase tracking-wider">
                  Login
                </Link>
                <Button variant="gradient" onClick={() => navigate('/register')} className="py-2">
                  Register
                </Button>
              </>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="md:hidden text-on-surface-variant active:scale-95 transition-transform flex items-center"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex justify-end animate-fade-in-up" style={{ animationDuration: '0.2s' }}>
          {/* Overlay */}
          <div 
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          ></div>
          
          {/* Drawer */}
          <div className="relative w-64 h-full bg-surface-container border-l border-border-glass shadow-2xl p-6 flex flex-col gap-6 animate-slide-in-right">
            <div className="flex justify-between items-center mb-4">
              <span className="font-display-lg text-headline-md text-primary">Menu</span>
              <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className="material-symbols-outlined text-on-surface-variant"
              >
                close
              </button>
            </div>
            
            <nav className="flex flex-col gap-4">
              {user ? (
                <>
                  <Link to="/dashboard" onClick={() => setIsMobileMenuOpen(false)} className="text-on-surface font-body-lg text-body-lg flex items-center gap-2">
                    <span className="material-symbols-outlined">dashboard</span> Dashboard
                  </Link>
                  {user.role === 'admin' && (
                    <Link to="/admin" onClick={() => setIsMobileMenuOpen(false)} className="text-primary font-body-lg text-body-lg flex items-center gap-2">
                      <span className="material-symbols-outlined">admin_panel_settings</span> Admin
                    </Link>
                  )}
                  <div className="h-px bg-border-glass my-2"></div>
                  <button onClick={handleLogout} className="text-error font-body-lg text-body-lg flex items-center gap-2 text-left">
                    <span className="material-symbols-outlined">logout</span> Logout
                  </button>
                </>
              ) : (
                <>
                  <div className="flex flex-col gap-3 pt-4 mt-2 border-t border-border-glass">
                    <Button variant="secondary" onClick={() => { setIsMobileMenuOpen(false); navigate('/login'); }} className="w-full flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-sm">login</span> Login
                    </Button>
                    <Button variant="gradient" onClick={() => { setIsMobileMenuOpen(false); navigate('/register'); }} className="w-full flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-sm">person_add</span> Register
                    </Button>
                  </div>
                </>
              )}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
