import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Database,
  Workflow,
  Settings,
  FileText,
  Cpu,
  Layers,
  ChevronRight
} from 'lucide-react';

interface SidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
}

// Map view names to routes
const viewToRoute: Record<string, string> = {
  'overview': '/overview',
  'dashboard': '/dashboard',
  'workflows': '/workflows',
  'database': '/database',
  'reports': '/reports',
  'settings': '/settings',
  'admin': '/admin',
};

export const Sidebar: React.FC<SidebarProps> = ({ activeView, onNavigate }) => {
  const NavItem = ({ icon: Icon, label, view, active = false }: { icon: any, label: string, view?: string, active?: boolean }) => {
    const route = view ? viewToRoute[view] || `/${view}` : '#';
    
    if (!view) {
      // Non-navigable item (like Documentation)
      return (
        <div
          className={`flex items-center px-4 py-2 my-1 text-sm font-medium rounded-md cursor-pointer transition-colors text-slate-500 hover:bg-slate-100 hover:text-slate-900`}
        >
          <Icon size={18} className="mr-3 text-slate-400" />
          {label}
        </div>
      );
    }

    return (
      <Link
        to={route}
        data-tutorial={`nav-${view}`}
        className={`flex items-center px-4 py-2 my-1 text-sm font-medium rounded-md cursor-pointer transition-colors ${active
          ? 'bg-[#E3EFF1] text-[#1F5F68]'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
          }`}
      >
        <Icon size={18} className={`mr-3 ${active ? 'text-[#1F5F68]' : 'text-slate-400'}`} />
        {label}
      </Link>
    );
  };

  const SectionLabel = ({ label }: { label: string }) => (
    <div className="px-4 mt-6 mb-2 text-xs font-semibold text-[#103D45] uppercase tracking-wider">
      {label}
    </div>
  );

  return (
    <div data-tutorial="sidebar" className="w-64 bg-[#F5F7F9] border-r border-slate-200 h-screen flex flex-col sticky top-0 font-sans">
      {/* Logo Area */}
      <div className="p-6 flex items-center mb-2">
        <img
          src="/logo.png"
          alt="Intemic"
          className="h-8 w-auto object-contain"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            e.currentTarget.nextElementSibling?.classList.remove('hidden');
          }}
        />
        {/* Fallback if logo missing */}
        <div className="hidden flex items-center">
          <div className="w-8 h-8 bg-teal-800 rounded-lg flex items-center justify-center mr-3">
            <Layers className="text-white" size={20} />
          </div>
          <span className="text-xl font-bold text-slate-800 tracking-tight">intemic</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <nav className="px-2">
          <SectionLabel label="Company" />
          <NavItem icon={LayoutDashboard} label="Overview" view="overview" active={activeView === 'overview'} />
          <NavItem icon={LayoutDashboard} label="Dashboards" view="dashboard" active={activeView === 'dashboard'} />

          <SectionLabel label="Modeling" />
          <NavItem icon={Workflow} label="Workflows" view="workflows" active={activeView === 'workflows'} />
          <NavItem icon={Database} label="Database" view="database" active={activeView === 'database'} />
          <NavItem icon={Cpu} label="Reports" view="reports" active={activeView === 'reports'} />

          <SectionLabel label="Discover" />
          <NavItem icon={FileText} label="Documentation" />


        </nav>
      </div>

      <div className="p-4">
        <NavItem icon={Settings} label="Settings" view="settings" active={activeView === 'settings'} />
      </div>
    </div>
  );
};