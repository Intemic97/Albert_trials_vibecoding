import React from 'react';
import {
  LayoutDashboard,
  Database,
  Workflow,
  Settings,
  Users,
  FileText,
  Cpu,
  Layers,
  ChevronRight
} from 'lucide-react';

interface SidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeView, onNavigate }) => {
  const NavItem = ({ icon: Icon, label, view, active = false }: { icon: any, label: string, view?: string, active?: boolean }) => (
    <div
      onClick={() => view && onNavigate(view)}
      className={`flex items-center px-4 py-2 my-1 text-sm font-medium rounded-md cursor-pointer transition-colors ${active ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
    >
      <Icon size={18} className={`mr-3 ${active ? 'text-teal-600' : 'text-slate-400'}`} />
      {label}
    </div>
  );

  const SectionLabel = ({ label }: { label: string }) => (
    <div className="px-4 mt-6 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
      {label}
    </div>
  );

  return (
    <div className="w-64 bg-white border-r border-slate-200 h-screen flex flex-col sticky top-0">
      <div className="p-6 flex items-center">
        <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center mr-3 shadow-sm">
          <Layers className="text-white" size={20} />
        </div>
        <span className="text-xl font-bold text-slate-800 tracking-tight">intemic</span>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <nav className="px-2">
          <SectionLabel label="Company" />
          <NavItem icon={LayoutDashboard} label="Overview" />
          <NavItem icon={LayoutDashboard} label="Dashboards" />
          <NavItem icon={Users} label="Copilots" />

          <SectionLabel label="Modeling" />
          <NavItem icon={Workflow} label="Dataflows" />
          <NavItem icon={Database} label="Database" view="database" active={activeView === 'database'} />
          <NavItem icon={Cpu} label="Reports" view="reports" active={activeView === 'reports'} />

          <SectionLabel label="Discover" />
          <NavItem icon={FileText} label="Documentation" />

          <div className="mt-8 border-t border-slate-100 pt-4">
            <NavItem icon={Users} label="Admin panel" />
          </div>
        </nav>
      </div>

      <div className="p-4 border-t border-slate-200">
        <NavItem icon={Settings} label="Settings" />
      </div>
    </div>
  );
};