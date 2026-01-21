import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, MessageSquare } from 'lucide-react';
import { API_BASE } from '../config';
import { useAuth } from '../context/AuthContext';
import { ProfileMenu, UserAvatar } from './ProfileMenu';
import {
  LayoutDashboard,
  Database,
  Workflow,
  Settings,
  FileText,
  Home,
  Sparkles,
  Activity,
  Plug,
  HelpCircle,
  BookOpen,
  Bug,
  ChevronDown,
  ChevronUp,
  FileCheck,
  Clipboard
} from 'lucide-react';

interface SidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
  onShowTutorial?: () => void;
}

// Map view names to routes
const viewToRoute: Record<string, string> = {
  'overview': '/overview',
  'dashboard': '/dashboard',
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
      ? 'bg-white/60 text-black shadow-[0_1px_2px_rgba(0,0,0,0.05),0_0_0_1px_rgba(0,0,0,0.02)]' 
      : 'text-slate-600 hover:text-slate-800 hover:bg-white/30';
    
    if (onClick) {
      // Clickable item with custom handler (like Quickstart)
      return (
        <button
          onClick={onClick}
          className={`${baseClasses} ${activeClasses}`}
        >
          <Icon size={16} className={`mr-3 transition-colors duration-200 ease-in-out ${active ? 'text-black' : 'text-slate-500 group-hover:text-slate-700'}`} />
          <span className="transition-colors duration-200 ease-in-out">{label}</span>
        </button>
      );
    }
    
    if (!view) {
      // Non-navigable item (like Documentation)
      return (
        <div className={`${baseClasses} ${activeClasses}`}>
          <Icon size={16} className={`mr-3 transition-colors duration-200 ease-in-out ${active ? 'text-black' : 'text-slate-500 group-hover:text-slate-700'}`} />
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
        <Icon size={16} className={`mr-3 transition-colors duration-200 ease-in-out ${active ? 'text-black' : 'text-slate-500 group-hover:text-slate-700'}`} />
        <span className="transition-colors duration-200 ease-in-out">{label}</span>
      </Link>
    );
  };

  const SectionLabel = ({ label }: { label: string }) => (
    <div className="px-3 mt-6 mb-2 first:mt-0 text-[10px] font-light text-slate-400 uppercase tracking-wider">
      {label}
    </div>
  );

  return (
    <div data-tutorial="sidebar" className="w-60 bg-slate-50 border-r border-slate-200 h-screen flex flex-col sticky top-0 font-sans z-40">
      {/* Header */}
      <div className="px-6 pt-5 pb-5 border-b border-slate-200 bg-white">
        <div className="flex items-center mb-5 pl-1">
          <img
            src="/logo.svg"
            alt="Intemic"
            className="h-5 w-auto object-contain"
          />
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
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
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 text-slate-700 placeholder:text-slate-400 transition-all"
          />
          {showResults && (
            <div className="absolute left-0 right-0 mt-2 bg-white border border-slate-200 rounded-lg shadow-xl text-sm z-20 overflow-hidden">
              <div className="px-3 py-2 text-xs font-medium text-slate-500 border-b border-slate-100 bg-slate-50/50">
                {isSearching ? 'Searching...' : 'Results'}
              </div>
              <div className="max-h-64 overflow-y-auto">
                {searchResults.workflows.length > 0 && (
                  <div className="py-1.5">
                    <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-slate-400 font-normal">Workflows</div>
                    {searchResults.workflows.map(item => (
                      <button
                        key={item.id}
                        onClick={() => {
                          navigate(`/workflow/${item.id}`);
                          setShowResults(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 text-left transition-colors"
                      >
                        <Workflow size={14} className="text-slate-400 flex-shrink-0" />
                        <span className="truncate text-sm text-slate-700">{item.name}</span>
                      </button>
                    ))}
                  </div>
                )}

                {searchResults.chats.length > 0 && (
                  <div className="py-1.5 border-t border-slate-100">
                    <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-slate-400 font-normal">Chats</div>
                    {searchResults.chats.map(item => (
                      <button
                        key={item.id}
                        onClick={() => {
                          navigate(`/copilots?chatId=${item.id}`);
                          setShowResults(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 text-left transition-colors"
                      >
                        <MessageSquare size={14} className="text-slate-400 flex-shrink-0" />
                        <span className="truncate text-sm text-slate-700">{item.title}</span>
                      </button>
                    ))}
                  </div>
                )}

                {searchResults.entities.length > 0 && (
                  <div className="py-1.5 border-t border-slate-100">
                    <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-slate-400 font-normal">Knowledge Base</div>
                    {searchResults.entities.map(item => (
                      <button
                        key={item.id}
                        onClick={() => {
                          navigate(`/database/${item.id}`);
                          setShowResults(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 text-left transition-colors"
                      >
                        <Database size={14} className="text-slate-400 flex-shrink-0" />
                        <span className="truncate text-sm text-slate-700">{item.name}</span>
                      </button>
                    ))}
                  </div>
                )}

                {searchResults.workflows.length === 0 && searchResults.chats.length === 0 && searchResults.entities.length === 0 && !isSearching && (
                  <div className="px-3 py-4 text-xs text-slate-500 text-center">No results found</div>
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
            <NavItem icon={Home} label="Overview" view="overview" active={activeView === 'overview'} />
            <NavItem icon={LayoutDashboard} label="Dashboards" view="dashboard" active={activeView === 'dashboard'} />
          </div>

          <SectionLabel label="Data Modeling" />
          <div className="space-y-0.5">
            <NavItem icon={Workflow} label="Workflows" view="workflows" active={activeView === 'workflows'} />
            <NavItem icon={Database} label="Knowledge Base" view="database" active={activeView === 'database'} />
            <NavItem icon={Sparkles} label="Copilots" view="copilots" active={activeView === 'copilots'} />
          </div>

          <SectionLabel label="Reports" />
          <div className="space-y-0.5">
            <NavItem icon={FileText} label="Templates" view="templates" active={activeView === 'templates'} />
            <NavItem icon={FileCheck} label="Documents" view="documents" active={activeView === 'documents'} />
            <NavItem icon={Clipboard} label="Reports" view="reports" active={activeView === 'reports'} />
          </div>

          <SectionLabel label="Operations" />
          <div className="space-y-0.5">
            <NavItem icon={Activity} label="Executions" view="logs" active={activeView === 'logs'} />
            <NavItem icon={Plug} label="Connections" view="connections" active={activeView === 'connections'} />
          </div>

        </nav>
      </div>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-slate-200">
        {/* Help Dropdown */}
        <div className="mb-2">
          <button
            onClick={() => setShowHelpDropdown(!showHelpDropdown)}
            className="flex items-center justify-between w-full px-3 py-2 text-sm rounded-lg cursor-pointer transition-colors duration-200 ease-in-out text-slate-600 hover:bg-white/30 hover:text-slate-800 group"
          >
            <div className="flex items-center">
              <HelpCircle size={16} className="mr-3 text-slate-500 group-hover:text-slate-700 transition-colors duration-200 ease-in-out" />
              <span className="transition-colors duration-200 ease-in-out">Help</span>
            </div>
            {showHelpDropdown ? (
              <ChevronUp size={16} className="text-slate-400" />
            ) : (
              <ChevronDown size={16} className="text-slate-400" />
            )}
          </button>
          {showHelpDropdown && (
            <div className="ml-4 mt-1 space-y-0.5 border-l border-slate-200 pl-3">
              <NavItem 
                icon={HelpCircle} 
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
          <NavItem icon={Settings} label="Settings" view="settings" active={activeView === 'settings'} />
        </div>
        <ProfileMenu
          onNavigate={onNavigate}
          menuPlacement="top-right"
          triggerClassName="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/30 transition-colors duration-200 ease-in-out text-left border border-transparent hover:border-slate-200"
          triggerContent={(
            <>
              <UserAvatar name={user?.name} profilePhoto={user?.profilePhoto} size="md" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-normal text-slate-900 truncate">{user?.name || 'User'}</div>
                {currentOrg && (
                  <div className="text-xs text-slate-500 truncate">
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