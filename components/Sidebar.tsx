import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE } from '../config';
import { useAuth } from '../context/AuthContext';
import { ProfileMenu, UserAvatar } from './ProfileMenu';
import { NotificationBell, NotificationCenter, useNotificationCenter } from './NotificationCenter';
import {
  SquaresFour,
  Database,
  FlowArrow,
  GearSix,
  FileText,
  House,
  Sparkle,
  ChartLineUp,
  Plug,
  Question,
  BookOpen,
  Bug,
  CaretDown,
  CaretUp,
  Checks,
  ClipboardText,
  Sliders,
  MagnifyingGlass,
  ChatCircle
} from '@phosphor-icons/react';

interface SidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
  onShowTutorial?: () => void;
}

// Map view names to routes
const viewToRoute: Record<string, string> = {
  'overview': '/overview',
  'dashboard': '/dashboard',
  'simulations': '/simulations',
  'workflows': '/workflows',
  'database': '/database',
  'templates': '/templates',
  'documents': '/documents',
  'reports': '/reports',
  'copilots': '/copilots',
  'logs': '/logs',
  'connections': '/connections',
  'documentation': '/documentation',
  'settings': '/settings',
  'admin': '/admin',
};

export const Sidebar: React.FC<SidebarProps> = ({ activeView, onNavigate, onShowTutorial }) => {
  const { organizations, user } = useAuth();
  const navigate = useNavigate();
  const notificationCenter = useNotificationCenter();
  const searchRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState<'workflows' | 'chats' | 'knowledge'>('workflows');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<{
    workflows: Array<{ id: string; name: string }>;
    chats: Array<{ id: string; title: string }>;
    entities: Array<{ id: string; name: string }>;
  }>({ workflows: [], chats: [], entities: [] });
  const [showResults, setShowResults] = useState(false);
  const [showHelpDropdown, setShowHelpDropdown] = useState(false);
  const currentOrg = organizations.find(org => org.id === user?.orgId);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setShowResults(false);
      setSearchResults({ workflows: [], chats: [], entities: [] });
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      try {
        const [workflowsRes, chatsRes, entitiesRes] = await Promise.all([
          fetch(`${API_BASE}/workflows`, { credentials: 'include', signal: controller.signal }),
          fetch(`${API_BASE}/copilot/chats`, { credentials: 'include', signal: controller.signal }),
          fetch(`${API_BASE}/entities`, { credentials: 'include', signal: controller.signal })
        ]);

        const [workflowsData, chatsData, entitiesData] = await Promise.all([
          workflowsRes.ok ? workflowsRes.json() : [],
          chatsRes.ok ? chatsRes.json() : { chats: [] },
          entitiesRes.ok ? entitiesRes.json() : []
        ]);

        const query = searchQuery.toLowerCase();
        const workflows = Array.isArray(workflowsData)
          ? workflowsData.filter((wf: any) => wf.name?.toLowerCase().includes(query)).slice(0, 5)
          : [];
        const chats = Array.isArray(chatsData?.chats)
          ? chatsData.chats.filter((chat: any) => chat.title?.toLowerCase().includes(query)).slice(0, 5)
          : [];
        const entities = Array.isArray(entitiesData)
          ? entitiesData.filter((entity: any) => entity.name?.toLowerCase().includes(query)).slice(0, 5)
          : [];

        setSearchResults({
          workflows: workflows.map((wf: any) => ({ id: wf.id, name: wf.name })),
          chats: chats.map((chat: any) => ({ id: chat.id, title: chat.title })),
          entities: entities.map((entity: any) => ({ id: entity.id, name: entity.name }))
        });
        setShowResults(true);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          setSearchResults({ workflows: [], chats: [], entities: [] });
        }
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [searchQuery]);

  const NavItem = ({ icon: Icon, label, view, active = false, onClick, onNavigate }: { icon: any, label: string, view?: string, active?: boolean, onClick?: () => void, onNavigate?: () => void }) => {
    const route = view ? viewToRoute[view] || `/${view}` : '#';
    
    const baseClasses = "flex items-center px-3 py-2 text-sm rounded-lg cursor-pointer transition-all duration-200 ease-in-out w-full text-left group";
    const activeClasses = active 
      ? 'bg-[var(--sidebar-bg-active)] text-[var(--sidebar-text-active)] font-medium' 
      : 'text-[var(--sidebar-text)] hover:text-[var(--sidebar-text-hover)] hover:bg-[var(--sidebar-bg-hover)]';
    
    const iconClasses = `mr-3 transition-colors duration-200 ease-in-out ${active ? 'text-[var(--sidebar-icon-active)]' : 'text-[var(--sidebar-icon)] group-hover:text-[var(--sidebar-text-hover)]'}`;
    
    if (onClick) {
      return (
        <button
          onClick={onClick}
          className={`${baseClasses} ${activeClasses}`}
        >
          <Icon size={16} weight="light" className={iconClasses} />
          <span className="transition-colors duration-200 ease-in-out">{label}</span>
        </button>
      );
    }
    
    if (!view) {
      return (
        <div className={`${baseClasses} ${activeClasses}`}>
          <Icon size={16} weight="light" className={iconClasses} />
          <span className="transition-colors duration-200 ease-in-out">{label}</span>
        </div>
      );
    }

    const handleClick = () => {
      if (onNavigate) {
        onNavigate();
      }
    };

    return (
      <Link
        to={route}
        data-tutorial={`nav-${view}`}
        className={`${baseClasses} ${activeClasses}`}
        onClick={handleClick}
      >
        <Icon size={16} weight="light" className={iconClasses} />
        <span className="transition-colors duration-200 ease-in-out">{label}</span>
      </Link>
    );
  };

  const SectionLabel = ({ label }: { label: string }) => (
    <div className="px-3 mt-6 mb-2 first:mt-0 text-[10px] font-light text-[var(--sidebar-section-label)] uppercase tracking-wider">
      {label}
    </div>
  );

  return (
    <div data-tutorial="sidebar" className="w-60 bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)] h-screen flex flex-col sticky top-0 font-sans z-40 transition-colors duration-200">
      {/* Header */}
      <div className="px-6 pt-5 pb-5 border-b border-[var(--sidebar-border)]">
        <div className="flex items-center justify-between mb-5 pl-1">
          <img
            src="/logo.svg"
            alt="Intemic"
            className="h-5 w-auto object-contain transition-all duration-200"
            style={{ filter: 'var(--logo-filter)' }}
          />
          {/* Notification Bell */}
          <div className="relative">
            <NotificationBell 
              onClick={notificationCenter.toggle} 
              unreadCount={notificationCenter.unreadCount} 
            />
            <NotificationCenter 
              isOpen={notificationCenter.isOpen} 
              onClose={notificationCenter.close} 
            />
          </div>
        </div>
        <div className="relative">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--sidebar-icon)]" size={14} weight="light" />
          <input
            type="text"
            ref={searchRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchQuery.trim()) {
                const query = encodeURIComponent(searchQuery.trim());
                if (searchScope === 'workflows') {
                  navigate(`/workflows?q=${query}`);
                } else if (searchScope === 'chats') {
                  navigate(`/copilots?q=${query}`);
                } else {
                  navigate(`/database?q=${query}`);
                }
                setShowResults(false);
              }
              if (e.key === 'Escape') {
                setShowResults(false);
              }
            }}
            placeholder="Search"
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-[var(--bg-input)] border border-[var(--border-light)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--border-focus)] focus:border-[var(--border-focus)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] transition-all duration-200"
          />
          {showResults && (
            <div className="absolute left-0 right-0 mt-2 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-lg shadow-lg text-sm z-20 overflow-hidden">
              <div className="px-3 py-2 text-xs font-medium text-[var(--text-secondary)] border-b border-[var(--border-light)] bg-[var(--bg-tertiary)]">
                {isSearching ? 'Searching...' : 'Results'}
              </div>
              <div className="max-h-64 overflow-y-auto">
                {searchResults.workflows.length > 0 && (
                  <div className="py-1.5">
                    <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] font-normal">Workflows</div>
                    {searchResults.workflows.map(item => (
                      <button
                        key={item.id}
                        onClick={() => {
                          navigate(`/workflow/${item.id}`);
                          setShowResults(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[var(--bg-hover)] text-left transition-colors"
                      >
                        <FlowArrow size={14} weight="light" className="text-[var(--text-tertiary)] flex-shrink-0" />
                        <span className="truncate text-sm text-[var(--text-primary)]">{item.name}</span>
                      </button>
                    ))}
                  </div>
                )}

                {searchResults.chats.length > 0 && (
                  <div className="py-1.5 border-t border-[var(--border-light)]">
                    <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] font-normal">Chats</div>
                    {searchResults.chats.map(item => (
                      <button
                        key={item.id}
                        onClick={() => {
                          navigate(`/copilots?chatId=${item.id}`);
                          setShowResults(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[var(--bg-hover)] text-left transition-colors"
                      >
                        <ChatCircle size={14} weight="light" className="text-[var(--text-tertiary)] flex-shrink-0" />
                        <span className="truncate text-sm text-[var(--text-primary)]">{item.title}</span>
                      </button>
                    ))}
                  </div>
                )}

                {searchResults.entities.length > 0 && (
                  <div className="py-1.5 border-t border-[var(--border-light)]">
                    <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] font-normal">Knowledge Base</div>
                    {searchResults.entities.map(item => (
                      <button
                        key={item.id}
                        onClick={() => {
                          navigate(`/database/${item.id}`);
                          setShowResults(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[var(--bg-hover)] text-left transition-colors"
                      >
                        <Database size={14} weight="light" className="text-[var(--text-tertiary)] flex-shrink-0" />
                        <span className="truncate text-sm text-[var(--text-primary)]">{item.name}</span>
                      </button>
                    ))}
                  </div>
                )}

                {searchResults.workflows.length === 0 && searchResults.chats.length === 0 && searchResults.entities.length === 0 && !isSearching && (
                  <div className="px-3 py-4 text-xs text-[var(--text-tertiary)] text-center">No results found</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <nav className="px-3 py-2">
          <SectionLabel label="Company" />
          <div className="space-y-0.5">
            <NavItem icon={House} label="Overview" view="overview" active={activeView === 'overview'} />
            <NavItem icon={SquaresFour} label="Dashboards" view="dashboard" active={activeView === 'dashboard'} />
          </div>

          <SectionLabel label="Data Modeling" />
          <div className="space-y-0.5">
            <NavItem icon={FlowArrow} label="Workflows" view="workflows" active={activeView === 'workflows'} />
            <NavItem icon={Database} label="Knowledge Base" view="database" active={activeView === 'database'} />
            <NavItem icon={Sparkle} label="Copilots" view="copilots" active={activeView === 'copilots'} />
            <NavItem icon={Sliders} label="Simulations" view="simulations" active={activeView === 'simulations'} />
          </div>

          <SectionLabel label="Reports" />
          <div className="space-y-0.5">
            <NavItem icon={FileText} label="Templates" view="templates" active={activeView === 'templates'} />
            <NavItem icon={Checks} label="Documents" view="documents" active={activeView === 'documents'} />
          </div>

          <SectionLabel label="Operations" />
          <div className="space-y-0.5">
            <NavItem icon={Plug} label="Connections" view="connections" active={activeView === 'connections'} />
          </div>

        </nav>
      </div>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-[var(--sidebar-border)]">
        {/* Help Dropdown */}
        <div className="mb-2">
          <button
            onClick={() => setShowHelpDropdown(!showHelpDropdown)}
            className="flex items-center justify-between w-full px-3 py-2 text-sm rounded-lg cursor-pointer transition-colors duration-200 ease-in-out text-[var(--sidebar-text)] hover:bg-[var(--sidebar-bg-hover)] hover:text-[var(--sidebar-text-hover)] group"
          >
            <div className="flex items-center">
              <Question size={16} weight="light" className="mr-3 text-[var(--sidebar-icon)] group-hover:text-[var(--sidebar-text-hover)] transition-colors duration-200 ease-in-out" />
              <span className="transition-colors duration-200 ease-in-out">Help</span>
            </div>
            {showHelpDropdown ? (
              <CaretUp size={16} weight="light" className="text-[var(--sidebar-icon)]" />
            ) : (
              <CaretDown size={16} weight="light" className="text-[var(--sidebar-icon)]" />
            )}
          </button>
          {showHelpDropdown && (
            <div className="ml-4 mt-1 space-y-0.5 border-l border-[var(--sidebar-border)] pl-3">
              <NavItem 
                icon={Question} 
                label="Quickstart" 
                onClick={() => {
                  setShowHelpDropdown(false);
                  if (onShowTutorial) {
                    onShowTutorial();
                  } else {
                    window.dispatchEvent(new CustomEvent('showTutorial'));
                  }
                }} 
              />
              <div onClick={() => setShowHelpDropdown(false)}>
                <NavItem 
                  icon={BookOpen} 
                  label="Documentation" 
                  view="documentation"
                  active={activeView === 'documentation'}
                />
              </div>
              <NavItem 
                icon={Bug} 
                label="Report a Bug" 
                onClick={() => {
                  setShowHelpDropdown(false);
                  window.dispatchEvent(new CustomEvent('showReportBug'));
                }} 
              />
            </div>
          )}
        </div>
        
        <div className="mb-2">
          <NavItem icon={GearSix} label="Settings" view="settings" active={activeView === 'settings'} />
        </div>
        <ProfileMenu
          onNavigate={onNavigate}
          menuPlacement="top-right"
          triggerClassName="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--sidebar-bg-hover)] transition-colors duration-200 ease-in-out text-left border border-transparent hover:border-[var(--sidebar-border)]"
          triggerContent={(
            <>
              <UserAvatar name={user?.name} profilePhoto={user?.profilePhoto} size="md" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-normal text-[var(--sidebar-text)] truncate">{user?.name || 'User'}</div>
                {currentOrg && (
                  <div className="text-xs text-[var(--text-tertiary)] truncate">
                    {currentOrg.name}
                  </div>
                )}
              </div>
            </>
          )}
        />
      </div>
    </div>
  );
};
