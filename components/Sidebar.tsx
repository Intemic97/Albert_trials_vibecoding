import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE } from '../config';
import { useAuth } from '../context/AuthContext';
import { ProfileMenu, UserAvatar, OrganizationLogo } from './ProfileMenu';
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
  CaretLeft,
  CaretRight,
  CaretUpDown,
  Checks,
  ClipboardText,
  Flask,
  MagnifyingGlass,
  ChatCircle,
  Factory
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
  'lab': '/lab',
  'workflows': '/workflows',
  'database': '/database',
  'templates': '/templates',
  'documents': '/documents',
  'reports': '/reports',
  'copilots': '/copilots',
  'logs': '/logs',
  'connections': '/connections',
  'industrial': '/industrial',
  'documentation': '/documentation',
  'settings': '/settings',
  'admin': '/admin',
};

export const Sidebar: React.FC<SidebarProps> = ({ activeView, onNavigate, onShowTutorial }) => {
  const { organizations, user } = useAuth();
  const navigate = useNavigate();
  const notificationCenter = useNotificationCenter();
  const searchRef = useRef<HTMLInputElement>(null);
  const notificationBellRef = useRef<HTMLButtonElement>(null);
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
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved === 'true';
  });
  const [otAlertCount, setOtAlertCount] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const currentOrg = organizations.find(org => org.id === user?.orgId);

  // Fetch OT alert count
  const fetchOtAlertCount = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/ot-alerts?acknowledged=false&limit=100`, {
        credentials: 'include'
      });
      if (res.ok) {
        const alerts = await res.json();
        setOtAlertCount(Array.isArray(alerts) ? alerts.length : 0);
      }
    } catch (error) {
      // Silently fail - OT alerts might not be configured
    }
  }, []);

  // Subscribe to OT alerts via WebSocket
  useEffect(() => {
    if (!user?.orgId) return;

    fetchOtAlertCount();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchOtAlertCount, 30000);

    // WebSocket for real-time updates
    const wsUrl = window.location.protocol === 'https:'
      ? `wss://${window.location.hostname}${window.location.port ? `:${window.location.port}` : ''}/ws`
      : `ws://${window.location.hostname}:3001/ws`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: 'subscribe_ot_alerts',
          orgId: user.orgId,
          user: { id: user.id, name: user.name || 'User', email: user.email }
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'ot_alert') {
            // New alert received, refresh count
            fetchOtAlertCount();
          }
        } catch (e) {
          // Ignore parse errors
        }
      };

      ws.onerror = () => {};
      ws.onclose = () => {};
    } catch (e) {
      // WebSocket not available
    }

    return () => {
      clearInterval(interval);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [user?.orgId, user?.id, user?.name, user?.email, fetchOtAlertCount]);

  // Persist collapsed state
  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(isCollapsed));
  }, [isCollapsed]);

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

  const NavItem = ({ icon: Icon, label, view, active = false, onClick, onNavigate: onNavCb, badge }: { icon: any, label: string, view?: string, active?: boolean, onClick?: () => void, onNavigate?: () => void, badge?: number }) => {
    const route = view ? viewToRoute[view] || `/${view}` : '#';
    
    const baseClasses = `flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-3'} py-2 text-sm rounded-lg cursor-pointer transition-all duration-200 ease-in-out w-full text-left group relative`;
    const activeClasses = active 
      ? 'bg-[var(--sidebar-bg-active)] text-[var(--sidebar-text-active)] font-medium' 
      : 'text-[var(--sidebar-text)] hover:text-[var(--sidebar-text-hover)] hover:bg-[var(--sidebar-bg-hover)]';
    
    const iconClasses = `${isCollapsed ? '' : 'mr-3'} transition-colors duration-200 ease-in-out flex-shrink-0 ${active ? 'text-[var(--sidebar-icon-active)]' : 'text-[var(--sidebar-icon)] group-hover:text-[var(--sidebar-text-hover)]'}`;
    
    // Tooltip for collapsed state
    const tooltip = isCollapsed ? (
      <span className="absolute left-full ml-2 px-2 py-1 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-md text-xs text-[var(--text-primary)] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg">
        {label}
        {badge !== undefined && badge > 0 && ` (${badge})`}
      </span>
    ) : null;
    
    // Badge element
    const badgeElement = badge !== undefined && badge > 0 ? (
      <span className={`${isCollapsed ? 'absolute -top-1 -right-1' : 'ml-auto'} min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-medium rounded-full ${
        badge > 0 ? 'bg-red-500 text-white' : 'bg-gray-500 text-white'
      }`}>
        {badge > 99 ? '99+' : badge}
      </span>
    ) : null;
    
    if (onClick) {
      return (
        <button
          onClick={onClick}
          className={`${baseClasses} ${activeClasses}`}
          title={isCollapsed ? label : undefined}
        >
          <Icon size={isCollapsed ? 18 : 16} weight="light" className={iconClasses} />
          {!isCollapsed && <span className="transition-colors duration-200 ease-in-out">{label}</span>}
          {!isCollapsed && badgeElement}
          {isCollapsed && badgeElement}
          {tooltip}
        </button>
      );
    }
    
    if (!view) {
      return (
        <div className={`${baseClasses} ${activeClasses}`} title={isCollapsed ? label : undefined}>
          <Icon size={isCollapsed ? 18 : 16} weight="light" className={iconClasses} />
          {!isCollapsed && <span className="transition-colors duration-200 ease-in-out">{label}</span>}
          {!isCollapsed && badgeElement}
          {isCollapsed && badgeElement}
          {tooltip}
        </div>
      );
    }

    const handleClick = () => {
      if (onNavCb) {
        onNavCb();
      }
    };

    return (
      <Link
        to={route}
        data-tutorial={`nav-${view}`}
        className={`${baseClasses} ${activeClasses}`}
        onClick={handleClick}
        title={isCollapsed ? label : undefined}
      >
        <Icon size={isCollapsed ? 18 : 16} weight="light" className={iconClasses} />
        {!isCollapsed && <span className="transition-colors duration-200 ease-in-out">{label}</span>}
        {!isCollapsed && badgeElement}
        {isCollapsed && badgeElement}
        {tooltip}
      </Link>
    );
  };

  const SectionLabel = ({ label }: { label: string }) => (
    isCollapsed ? (
      <div className="px-2 mt-4 mb-2 first:mt-0">
        <div className="h-px bg-[var(--sidebar-border)]" />
      </div>
    ) : (
      <div className="px-3 mt-6 mb-2 first:mt-0 text-[10px] font-light text-[var(--sidebar-section-label)] uppercase tracking-wider">
        {label}
      </div>
    )
  );

  return (
    <div data-tutorial="sidebar" className={`${isCollapsed ? 'w-16' : 'w-60'} bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)] h-screen flex flex-col sticky top-0 font-sans z-[60] transition-all duration-300 overflow-x-hidden`}>
      {/* Collapse Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-20 w-6 h-6 bg-[var(--bg-card)] border border-[var(--border-light)] rounded-full flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition-colors z-[100] shadow-sm"
      >
        {isCollapsed ? <CaretRight size={12} weight="bold" /> : <CaretLeft size={12} weight="bold" />}
      </button>

      {/* Header */}
      <div className={`${isCollapsed ? 'px-3' : 'px-6'} pt-5 pb-5 border-b border-[var(--sidebar-border)]`}>
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} mb-5 ${isCollapsed ? '' : 'pl-1'}`}>
          {isCollapsed ? (
            <img
              src="/favicon.svg"
              alt="Intemic"
              className="h-6 w-6 object-contain transition-all duration-200"
              style={{ filter: 'var(--logo-filter)' }}
            />
          ) : (
            <>
              <img
                src="/logo.svg"
                alt="Intemic"
                className="h-5 w-auto object-contain transition-all duration-200"
                style={{ filter: 'var(--logo-filter)' }}
              />
              {/* Notification Bell */}
              <div className="relative">
                <NotificationBell 
                  ref={notificationBellRef}
                  onClick={notificationCenter.toggle} 
                  unreadCount={notificationCenter.unreadCount} 
                />
                <NotificationCenter 
                  isOpen={notificationCenter.isOpen} 
                  onClose={notificationCenter.close}
                  triggerRef={notificationBellRef}
                />
              </div>
            </>
          )}
        </div>
        {!isCollapsed ? (
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
                  setSearchQuery('');
                }
              }}
              onBlur={() => {
                // Small delay to allow click events on results
                setTimeout(() => setShowResults(false), 200);
              }}
              placeholder="Search"
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-[var(--bg-input)] border border-[var(--border-light)] rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--border-focus)] focus:border-[var(--border-focus)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] transition-all duration-200"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setShowResults(false);
                  searchRef.current?.focus();
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
              >
                <X size={14} weight="light" />
              </button>
            )}
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
        ) : (
          <button
            onClick={() => setIsCollapsed(false)}
            className="w-full flex items-center justify-center p-2 rounded-lg text-[var(--sidebar-icon)] hover:text-[var(--sidebar-text-hover)] hover:bg-[var(--sidebar-bg-hover)] transition-colors"
            title="Search (⌘K)"
          >
            <MagnifyingGlass size={18} weight="light" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <nav className="px-3 py-2">
          {/* Overview - standalone */}
          <div className="space-y-0.5 mb-1">
            <NavItem icon={House} label="Overview" view="overview" active={activeView === 'overview'} />
          </div>

          <SectionLabel label="Build" />
          <div className="space-y-0.5">
            <NavItem icon={FlowArrow} label="Workflows" view="workflows" active={activeView === 'workflows'} />
            <NavItem icon={Database} label="Knowledge Base" view="database" active={activeView === 'database'} />
            <NavItem icon={Plug} label="Connections" view="connections" active={activeView === 'connections'} badge={otAlertCount} />
          </div>

          <SectionLabel label="Analyze" />
          <div className="space-y-0.5">
            <NavItem icon={SquaresFour} label="Dashboards" view="dashboard" active={activeView === 'dashboard'} />
            <NavItem icon={Flask} label="Lab" view="lab" active={activeView === 'lab'} />
            <NavItem icon={Sparkle} label="Copilots" view="copilots" active={activeView === 'copilots'} />
          </div>

          <SectionLabel label="Reports" />
          <div className="space-y-0.5">
            <NavItem icon={FileText} label="Templates" view="templates" active={activeView === 'templates'} />
            <NavItem icon={Checks} label="Documents" view="documents" active={activeView === 'documents'} />
          </div>

        </nav>
      </div>

      {/* Footer */}
      <div className={`${isCollapsed ? 'px-2' : 'px-3'} py-3 border-t border-[var(--sidebar-border)]`}>
        {/* Help Dropdown */}
        {!isCollapsed ? (
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
        ) : (
          <div className="mb-2">
            <NavItem icon={Question} label="Help" view="documentation" active={activeView === 'documentation'} />
          </div>
        )}
        
        <div className="mb-2">
          <NavItem icon={GearSix} label="Settings" view="settings" active={activeView === 'settings'} />
        </div>
        
        {/* Organization Switcher */}
        {isCollapsed ? (
          <ProfileMenu
            onNavigate={onNavigate}
            menuPlacement="top-right"
            initialView="organizations"
            triggerClassName="w-full flex items-center justify-center p-2 rounded-lg hover:bg-[var(--sidebar-bg-hover)] transition-colors duration-200 ease-in-out"
            triggerContent={<OrganizationLogo name={currentOrg?.name} logo={(currentOrg as any)?.logo} size="sm" />}
          />
        ) : (
          <div className="flex items-center justify-between w-full px-2 py-2 rounded-lg hover:bg-[var(--sidebar-bg-hover)] transition-colors duration-200 ease-in-out">
            {/* Main area - opens full menu */}
            <ProfileMenu
              onNavigate={onNavigate}
              menuPlacement="top-right"
              triggerClassName="flex items-center gap-3 min-w-0 flex-1"
              triggerContent={(
                <>
                  <OrganizationLogo name={currentOrg?.name} logo={(currentOrg as any)?.logo} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-normal text-[var(--sidebar-text)] truncate uppercase tracking-wide">
                      {currentOrg?.name || 'Organization'}
                    </div>
                  </div>
                </>
              )}
            />
            {/* Switch button - opens directly to organizations */}
            <ProfileMenu
              onNavigate={onNavigate}
              menuPlacement="top-right"
              initialView="organizations"
              triggerClassName="p-1.5 rounded hover:bg-[var(--sidebar-bg-active)] transition-colors duration-200 ease-in-out flex-shrink-0"
              triggerContent={
                <CaretUpDown size={16} weight="light" className="text-[var(--sidebar-icon)]" />
              }
            />
          </div>
        )}
      </div>
    </div>
  );
};
