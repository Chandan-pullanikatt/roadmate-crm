import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import GlobalModals from '../GlobalModals';

const getIcon = (iconName) => {
  const props = { className: "icon", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" };
  switch (iconName) {
    case 'overview':
      return <svg {...props}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>;
    case 'state-managers':
      return <svg {...props}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>;
    case 'industry-managers':
      return <svg {...props}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>;
    case 'executives':
      return <svg {...props}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
    case 'leads':
      return <svg {...props}><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>;
    case 'add-lead':
      return <svg {...props}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
    case 'bulk-upload':
      return <svg {...props}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;
    case 'expected':
      return <svg {...props}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>;
    case 'attendance':
      return <svg {...props}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
    case 'leave':
      return <svg {...props}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/></svg>;
    case 'performance':
      return <svg {...props}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>;
    case 'working-hours':
      return <svg {...props}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
    case 'reports':
      return <svg {...props}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>;
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
