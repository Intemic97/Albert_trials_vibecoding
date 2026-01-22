import React from 'react';
import { useLocation } from 'react-router-dom';

interface TopNavProps {
    activeView: string;
}

const viewToLabel: Record<string, string> = {
    overview: 'Overview',
    dashboard: 'Dashboards',
    workflows: 'Workflows',
    database: 'Database',
    reports: 'Reports',
    copilots: 'Copilots',
    settings: 'Settings',
    admin: 'Admin'
};

export const TopNav: React.FC<TopNavProps> = ({ activeView }) => {
    return null;
};
