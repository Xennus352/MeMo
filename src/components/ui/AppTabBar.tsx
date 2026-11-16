import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Heart, Calendar, Users } from 'lucide-react';
import { TabBar } from './GlassComponents';

const TABS = [
  { id: 'home', label: 'Home', icon: <Heart className="w-5 h-5" />, path: '/' },
  { id: 'milestones', label: 'Milestones', icon: <Calendar className="w-5 h-5" />, path: '/milestones' },
  { id: 'pairing', label: 'Partner', icon: <Users className="w-5 h-5" />, path: '/pairing' },
] as const;

/**
 * The app dock. Rendered once, OUTSIDE the animated page wrapper, so it stays
 * perfectly still while pages slide in and out.
 */
export const AppTabBar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const active = TABS.find(t => t.path === location.pathname)?.id ?? 'home';

  return (
    <TabBar
      tabs={TABS.map(({ id, label, icon }) => ({ id, label, icon }))}
      activeTab={active}
      onTabChange={(id) => {
        const tab = TABS.find(t => t.id === id);
        if (tab && tab.path !== location.pathname) navigate(tab.path);
      }}
    />
  );
};
