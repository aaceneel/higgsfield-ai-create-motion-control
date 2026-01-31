import { Wand2, FolderOpen, Settings, User } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/ThemeToggle";

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

const SidebarItem = ({ icon, label, active, onClick }: SidebarItemProps) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        onClick={onClick}
        className={cn(
          "flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-300 relative group",
          active
            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-100"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground hover:scale-105"
        )}
      >
        {icon}
        {active && (
          <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-l-full opacity-0" />
        )}
      </button>
    </TooltipTrigger>
    <TooltipContent side="right" className="bg-popover/80 backdrop-blur-md border-border/50 text-sm font-medium">
      {label}
    </TooltipContent>
  </Tooltip>
);

export const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <aside className="flex flex-col items-center w-20 py-8 h-full bg-background/80 backdrop-blur-xl border-r border-border/50">
      {/* Logo */}
      <div className="flex items-center justify-center w-12 h-12 mb-10 rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/20">
        <Wand2 className="w-6 h-6 text-primary-foreground" />
      </div>

      {/* Navigation */}
      <nav className="flex flex-col items-center gap-4 flex-1">
        <SidebarItem 
          icon={<Wand2 className="w-6 h-6" />} 
          label="Create" 
          active={location.pathname === '/'} 
          onClick={() => navigate('/')}
        />
        <SidebarItem 
          icon={<FolderOpen className="w-6 h-6" />} 
          label="History" 
          active={location.pathname === '/history'}
          onClick={() => navigate('/history')}
        />
        <SidebarItem 
          icon={<Settings className="w-6 h-6" />} 
          label="Profile" 
          active={location.pathname === '/profile'}
          onClick={() => navigate('/profile')}
        />
      </nav>

      {/* Theme Toggle & User Avatar */}
      <div className="mt-auto flex flex-col items-center gap-6">
        <ThemeToggle />
        <Tooltip>
          <TooltipTrigger asChild>
            <button 
              onClick={() => navigate('/profile')}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-secondary overflow-hidden ring-2 ring-transparent hover:ring-primary/20 transition-all shadow-sm"
            >
              <User className="w-5 h-5 text-secondary-foreground" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-popover/80 backdrop-blur-md border-border/50">
            Profile
          </TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
};
