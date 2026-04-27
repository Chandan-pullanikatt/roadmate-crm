import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import GlobalModals from '../GlobalModals';

const getIcon = (iconName) => {
  const props = { className: "icon", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round" };
  switch (iconName) {
    case 'overview':
      return <svg {...props}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>;
    case 'my-work':
      return <svg {...props}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/><path d="M12 11v-4"/></svg>;
    case 'industry':
      return <svg {...props}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
    case 'executives':
      return <svg {...props}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
    case 'leads':
      return <svg {...props}><path d="M17.5 19L9 13l8.5-6"/><path d="M12 12h9"/><path d="M2 12h4"/><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="9" strokeOpacity="0.2"/></svg>;
    case 'attendance':
      return <svg {...props}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
    case 'calendar':
      return <svg {...props}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
    case 'performance':
      return <svg {...props}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>;
    case 'reports':
      return <svg {...props}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
    default:
      return <svg {...props}><circle cx="12" cy="12" r="10"/></svg>;
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

  const activePage = new URLSearchParams(location.search).get('page') || 'overview';
  const shouldShowGlobalHeader = userRole !== 'industry_manager' || activePage === 'overview';

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
          <div className={`logo-mark ${userRole === 'industry_manager' ? 'bg-purple shadow-purple/20' : userRole === 'state_manager' ? 'bg-blue shadow-blue/20' : ''}`}>{logoMarkText}</div>
          <div style={{ flex: 1 }}>
            <div className="logo-text">RoadMate CRM</div>
            <div className="logo-sub">{logoSub}</div>
            <div className="state-tag">
               <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
                 <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                 <circle cx="12" cy="10" r="3" />
               </svg>
               {stateName}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide py-2">
          {effectiveSections.map((section, sidx) => (
            <div key={sidx} className="sidebar-section">
              <div className="sidebar-label">{section.label}</div>
              {section.items.map((item, iidx) => {
                const isActive = location.pathname + location.search === item.path;
                
                return (
                  <NavLink
                    key={iidx}
                    to={item.path}
                    className={`nav-item ${isActive ? 'active' : ''}`}
                    onClick={(e) => {
                      if (item.onClick) {
                        e.preventDefault();
                        item.onClick();
                      }
                      setIsSidebarOpen(false);
                    }}
                  >
                    {typeof item.icon === 'string' ? getIcon(item.icon) : item.icon}
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {item.badge && (
                      <span className={`nav-badge ${item.badgeColor || ''}`}>
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
          <div className="user-dropdown-container">
            <div 
              className={`user-card ${isUserDropdownOpen ? 'active' : ''}`} 
              onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
            >
              <div className={`avatar ${avatarClass}`} style={{ borderRadius: '50%' }}>
                {userName?.split(' ').map(n => n[0]).join('') || 'U'}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="user-name" style={{ fontWeight: 700, fontSize: '14px' }}>{userName}</div>
                <div className="user-role" style={{ fontSize: '11px', fontWeight: 500 }}>{userRole?.replace('_', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} · {stateName}</div>
              </div>
              <svg className={`chevron ${isUserDropdownOpen ? 'open' : ''}`} width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 'auto' }}>
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
      <div className={`main role-${userRole}`}>
        {shouldShowGlobalHeader && (
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
        )}

        <div className="content">
          {children}
        </div>
      </div>
      <GlobalModals />
    </div>
  );
};

export default DashboardLayout;
