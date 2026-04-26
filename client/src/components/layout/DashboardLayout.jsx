import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import GlobalModals from '../GlobalModals';

const getIcon = (iconName) => {
  const props = { className: "icon", viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.5" };
  switch (iconName) {
    case 'overview':
      return <svg {...props}><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>;
    case 'my-work':
      return <svg {...props} style={{ opacity: 1 }}><circle cx="8" cy="3" r="2"/><path d="M3 14v-2a5 5 0 0110 0v2"/><path d="M8 7v4M6 9h4"/></svg>;
    case 'industry':
      return <svg {...props}><circle cx="8" cy="5" r="3"/><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6"/></svg>;
    case 'executives':
      return <svg {...props}><path d="M8 1l1.5 4.5H14l-3.7 2.7 1.4 4.3L8 9.8l-3.7 2.7 1.4-4.3L2 5.5h4.5z"/></svg>;
    case 'leads':
      return <svg {...props}><path d="M14 10c0 2.2-1.8 4-4 4H4c-1.7 0-3-1.3-3-3 0-1.4.9-2.5 2.2-2.9C3.1 7.8 3 7.4 3 7c0-1.7 1.3-3 3-3 .3 0 .7 0 1 .1C7.5 2.9 8.9 2 10.5 2 12.4 2 14 3.6 14 5.5c0 .3 0 .6-.1.9.6.4 1.1 1 1.1 1.8v.3H14z"/></svg>;
    case 'attendance':
      return <svg {...props}><rect x="2" y="3" width="12" height="11" rx="1"/><path d="M5 1v4M11 1v4M2 7h12"/></svg>;
    case 'calendar':
      return <svg {...props}><path d="M8 2v4l3 3"/><circle cx="8" cy="8" r="6"/></svg>;
    case 'performance':
      return <svg {...props}><path d="M2 12l4-4 3 3 5-6"/></svg>;
    case 'reports':
      return <svg {...props}><path d="M4 12V7M8 12V4M12 12V9"/></svg>;
    default:
      return null;
  }
};

const DashboardLayout = ({ 
  children, 
  sections = [],
  navItems = [], // Fallback for old structure
  logoSub,
  roleBadge, 
  roleBadgeClass,
  logoMarkClass = "",
  logoMarkText = "RM",
  avatarClass = "av-green",
  userName, 
  userRole, 
  stateName = "Kerala",
  pageTitle = 'Dashboard',
  pageSubtitle = 'Welcome back',
  onLogout,
  extraContent,
  footerBranding
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const location = useLocation();

  // Handle case where sections aren't provided but navItems are
  const effectiveSections = sections.length > 0 ? sections : [{ label: 'Main', items: navItems }];

  return (
    <div className="flex min-h-screen">
      {/* Mobile Sidebar Overlay */}
      <div 
        className={`sidebar-overlay ${isSidebarOpen ? 'open' : ''}`}
        onClick={() => setIsSidebarOpen(false)}
      />

      {/* SIDEBAR */}
      <aside className={`sidebar role-${userRole} ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div className={`logo-mark ${logoMarkClass}`}>{logoMarkText}</div>
          <div>
            <div className="logo-text">RoadMate CRM</div>
            <div className="logo-sub">{logoSub}</div>
            <div className={roleBadgeClass}>{roleBadge}</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {effectiveSections.map((section, sidx) => (
            <div key={sidx} className="sidebar-section">
              <div className="sidebar-label">{section.label}</div>
              {section.items.map((item, iidx) => {
                const isActive = location.pathname + location.search === item.path;
                const isWorkingHours = item.label === 'Working Hours';
                
                return (
                  <NavLink
                    key={iidx}
                    to={item.path}
                    className={`nav-item ${isActive ? 'active' : ''} ${item.special ? 'nav-special' : ''}`}
                    onClick={(e) => {
                      if (item.onClick) {
                        e.preventDefault();
                        item.onClick();
                      }
                      setIsSidebarOpen(false);
                    }}
                  >
                    {typeof item.icon === 'string' ? getIcon(item.icon) : item.icon}
                    {item.label}
                    {item.badge && (
                      <span 
                        className={`${isWorkingHours ? 'wtime-chip' : 'nav-badge'} ${item.badgeColor || ''}`} 
                        style={isWorkingHours ? { marginLeft: 'auto', fontSize: '9px', padding: '1px 6px' } : {}}
                      >
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
          {extraContent}
        </div>

        <div className="sidebar-footer">
          {footerBranding && (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '0 8px 6px' }}>{footerBranding}</div>
          )}
          
          <div className="user-dropdown-container">
            <div 
              className={`user-card ${isUserDropdownOpen ? 'active' : ''}`} 
              onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
            >
              <div className={`avatar ${avatarClass}`}>
                {userName?.split(' ').map(n => n[0]).join('') || 'U'}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="user-name">{userName}</div>
                <div className="user-role">{userRole?.replace('_', ' ')} · {stateName}</div>
              </div>
              <svg className={`chevron ${isUserDropdownOpen ? 'open' : ''}`} width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>

            {isUserDropdownOpen && (
              <div className="user-dropdown-menu animate-in">
                <div className="dropdown-item" onClick={() => setIsUserDropdownOpen(false)}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="8" cy="5" r="3"/><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6"/>
                  </svg>
                  My Profile
                </div>
                <div className="dropdown-item" onClick={() => setIsUserDropdownOpen(false)}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M8 2v12M2 8h12" strokeLinecap="round"/>
                  </svg>
                  Settings
                </div>
                <div className="dropdown-divider"></div>
                <div className="dropdown-item text-red" onClick={() => { onLogout(); setIsUserDropdownOpen(false); }}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M10 3H3v10h7M13 8H6M13 8l-3-3M13 8l-3 3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Logout
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div className="main">
        <header className="header">
          <button className={`hamburger ${isSidebarOpen ? 'open' : ''}`} onClick={() => setIsSidebarOpen(true)}>
            <span></span><span></span><span></span>
          </button>
          
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="header-title" style={{ fontSize: '15.5px', fontWeight: 600 }}>{pageTitle}</div>
            <div className="header-sub" style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{pageSubtitle}</div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="search-bar" style={{ height: '34px', padding: '0 12px' }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <circle cx="6.5" cy="6.5" r="4" stroke="var(--text-muted)" strokeWidth="1.5"/>
                <path d="M11 11l2.5 2.5" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <input placeholder="Search leads, team, states…" style={{ fontSize: '12.5px' }} />
            </div>

            <div className="icon-btn" style={{ width: '34px', height: '34px' }}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <path d="M8 2a4.5 4.5 0 00-4.5 4.5c0 3-1.5 4-1.5 4h12s-1.5-1-1.5-4A4.5 4.5 0 008 2zM6.5 13.5a1.5 1.5 0 003 0" stroke="var(--text-secondary)" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              <div className="notif-dot"></div>
            </div>

            {userRole === 'executive' && (
              <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', whiteSpace: 'nowrap', marginLeft: '4px' }}>
                Lead <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>25</span> of <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>38</span>
              </div>
            )}

            {userRole === 'founder' && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-primary btn-sm" onClick={() => window.dispatchEvent(new CustomEvent('open-modal', { detail: 'add-lead' }))}>+ Add Lead</button>
                <button className="btn btn-outline btn-sm" onClick={() => window.dispatchEvent(new CustomEvent('open-modal', { detail: 'create-state-manager' }))}>+ State Manager</button>
              </div>
            )}
          </div>
        </header>

        <div className="content">
          {children}
        </div>
      </div>
      <GlobalModals />
    </div>
  );
};

export default DashboardLayout;
