import { useLocation } from 'wouter';
import ThemeToggle from './ThemeToggle';
import { useAuth } from '@/contexts/AuthContext';

const Sidebar = () => {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  return (
    <aside className="hidden md:flex md:w-64 flex-col bg-background dark:bg-card border-r border-border shadow-sm">
      <div className="p-4 border-b border-border flex items-center space-x-2">
        <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-secondary inline-block text-transparent bg-clip-text">Dr.Mind
        </h1>
      </div>
      
      <nav className="flex-1 p-4 space-y-1">
        <a 
          href="/" 
          className={`flex items-center space-x-2 p-2 rounded-lg ${
            location === '/' 
              ? 'bg-primary/10 text-primary' 
              : 'hover:bg-muted text-muted-foreground hover:text-foreground'
          }`}
        >
          <i className="fas fa-home w-5 h-5"></i>
          <span>Home</span>
        </a>
        <a 
          href="/diary" 
          className={`flex items-center space-x-2 p-2 rounded-lg ${
            location === '/diary' 
              ? 'bg-primary/10 text-primary' 
              : 'hover:bg-muted text-muted-foreground hover:text-foreground'
          }`}
        >
          <i className="fas fa-book w-5 h-5"></i>
          <span>Diary</span>
        </a>
        <a 
          href="/chat" 
          className={`flex items-center space-x-2 p-2 rounded-lg ${
            location === '/chat' 
              ? 'bg-primary/10 text-primary' 
              : 'hover:bg-muted text-muted-foreground hover:text-foreground'
          }`}
        >
          <i className="fas fa-comment-dots w-5 h-5"></i>
          <span>AI Chat</span>
        </a>
        <a 
          href="/mood" 
          className={`flex items-center space-x-2 p-2 rounded-lg ${
            location === '/mood' 
              ? 'bg-primary/10 text-primary' 
              : 'hover:bg-muted text-muted-foreground hover:text-foreground'
          }`}
        >
          <i className="fas fa-smile w-5 h-5"></i>
          <span>Mood Tracker</span>
        </a>
        <a 
          href="/mental-peace" 
          className={`flex items-center space-x-2 p-2 rounded-lg ${
            location === '/mental-peace' 
              ? 'bg-primary/10 text-primary' 
              : 'hover:bg-muted text-muted-foreground hover:text-foreground'
          }`}
        >
          <i className="fas fa-leaf w-5 h-5"></i>
          <span>Mental Peace</span>
        </a>
        <a 
          href="/about" 
          className={`flex items-center space-x-2 p-2 rounded-lg ${
            location === '/about' 
              ? 'bg-primary/10 text-primary' 
              : 'hover:bg-muted text-muted-foreground hover:text-foreground'
          }`}
        >
          <i className="fas fa-info-circle w-5 h-5"></i>
          <span>About</span>
        </a>
      </nav>
      
      <div className="p-4 border-t border-border space-y-1">
        {user && (
          <p className="text-xs text-muted-foreground px-2 truncate" title={user.username}>
            {user.username}
          </p>
        )}
        <a 
          href="/settings" 
          className={`flex items-center space-x-2 p-2 rounded-lg ${
            location === '/settings' 
              ? 'bg-primary/10 text-primary' 
              : 'hover:bg-muted text-muted-foreground hover:text-foreground'
          }`}
        >
          <i className="fas fa-cog w-5 h-5"></i>
          <span>Settings</span>
        </a>
        <button
          type="button"
          onClick={() => logout()}
          className="flex items-center space-x-2 p-2 rounded-lg w-full hover:bg-muted text-muted-foreground hover:text-foreground text-left"
        >
          <i className="fas fa-sign-out-alt w-5 h-5"></i>
          <span>Log out</span>
        </button>
        
        {/* Theme toggle */}
        <div className="mt-3">
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
