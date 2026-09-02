import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../../api/dashboardApi';
import { usersApi } from '../../api/usersApi';
import { leadsApi } from '../../api/leadsApi';
import { searchApi } from '../../api/searchApi';
import { notificationsApi } from '../../api/notificationsApi';
import { useMeetingAlerts } from '../../hooks/useMeetingAlerts';
import MeetingAlertBanner from '../ui/MeetingAlertBanner';
import { useToast } from '../../context/ToastContext';

const getIcon = (iconName) => {
  const props = { className: "icon", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round" };
  switch (iconName) {
    case 'overview':
      return <svg {...props}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>;
    case 'work':
      return <span style={{ fontSize: '18px', marginRight: '4px' }}>💼</span>;
    case 'meetings':
      return <span style={{ fontSize: '18px', marginRight: '4px' }}>📅</span>;
    case 'leads-v2':
      return <span style={{ fontSize: '18px', marginRight: '4px' }}>👥</span>;
    case 'calendar-v2':
      return <span style={{ fontSize: '18px', marginRight: '4px' }}>🗓️</span>;
    case 'reports-v2':
      return <span style={{ fontSize: '18px', marginRight: '4px' }}>📊</span>;
    case 'earnings':
      return <span style={{ fontSize: '18px', marginRight: '4px' }}>💰</span>;
    case 'policies':
      return <span style={{ fontSize: '18px', marginRight: '4px' }}>📄</span>;
    case 'hierarchy':
      return <span style={{ fontSize: '18px', marginRight: '4px' }}>🏢</span>;
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
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Global Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({ leads: [], staff: [] });
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchRef = useRef(null);
  const notifRef = useRef(null);

  // Notifications from API
  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.getNotifications().then(res => res.data),
    refetchInterval: 30000,
    staleTime: 15000,
  });
  const notifications = notifData?.notifications || [];
  const unreadCount = notifData?.unreadCount || 0;

  const handleMarkRead = async (id) => {
    try {
      await notificationsApi.markAsRead(id);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    } catch (err) { console.error('Mark read failed:', err); }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    } catch (err) { console.error('Mark all read failed:', err); }
  };

  // Close the notification panel when clicking anywhere outside it.
  useEffect(() => {
    if (!isNotificationOpen) return;
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setIsNotificationOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isNotificationOpen]);

  // Debounce Search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults({ leads: [], staff: [] });
      setShowSearchDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await searchApi.globalSearch(searchQuery);
        setSearchResults(res.data);
        setShowSearchDropdown(true);
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click Outside & Escape Key
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSearchDropdown(false);
      }
    };

    const handleEscape = (e) => {
      if (e.key === 'Escape') setShowSearchDropdown(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handlePrefetch = (item) => {
    if (!item.path || item.path === '#' || item.disabled) return;
    
    const params = new URLSearchParams(item.path.split('?')[1]);
    const page = params.get('page') || 'overview';
    
    if (page === 'overview') {
      queryClient.prefetchQuery({
        queryKey: ['dashboard', userRole],
        queryFn: () => {
          if (userRole === 'founder') return dashboardApi.getFounderDashboard().then(res => res.data);
          if (userRole === 'state_manager') return dashboardApi.getStateManagerDashboard().then(res => res.data);
          if (userRole === 'executive') return dashboardApi.getExecutiveDashboard().then(res => res.data);
          return null;
        },
        staleTime: 5 * 60 * 1000
      });
    } else if (page === 'state-managers') {
      queryClient.prefetchQuery({
        queryKey: ['users', 'state-managers-global'],
        queryFn: () => usersApi.getUsers({ role: 'state_manager' }).then(res => res.data),
        staleTime: 5 * 60 * 1000
      });
    } else if (page === 'industry-managers') {
      queryClient.prefetchQuery({
        queryKey: ['users', 'industry-managers-global'],
        queryFn: () => usersApi.getUsers({ role: 'industry_manager' }).then(res => res.data),
        staleTime: 5 * 60 * 1000
      });
    } else if (page === 'leads') {
      queryClient.prefetchQuery({
        queryKey: ['leads', 'global', 'all', 'All', ''],
        queryFn: () => leadsApi.getLeads({ limit: 15 }).then(res => res.data),
        staleTime: 5 * 60 * 1000
      });
    }
  };


  const { addToast } = useToast();

  // Meeting reminder banner — fires for all roles via socket push + polling fallback
  const { activeMeeting, dismissMeeting } = useMeetingAlerts();

  const handleMeetingConfirm = async () => {
    if (!activeMeeting?.leadId) { dismissMeeting(); return; }
    try {
      await leadsApi.updateLead(activeMeeting.leadId, {
        notes: `Meeting confirmed at ${new Date(activeMeeting.meetingAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      });
      addToast('Meeting confirmed ✓', 'success');
    } catch { /* non-critical */ }
    dismissMeeting();
  };

  const handleMeetingFeedback = async (feedback) => {
    if (!feedback.trim() || !activeMeeting?.leadId) return;
    try {
      await leadsApi.updateLead(activeMeeting.leadId, { notes: feedback });
      addToast('Note saved.', 'success');
    } catch { /* non-critical */ }
    dismissMeeting();
  };

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
          <div className={`logo-mark ${userRole === 'industry_manager' ? 'bg-purple shadow-purple/20' : userRole === 'state_manager' ? 'bg-blue shadow-blue/20' : logoMarkClass === 'brown' ? 'bg-brown shadow-brown/20' : ''}`}>{logoMarkText}</div>
          <div style={{ flex: 1 }}>
            {/* Fix: Rename branding to RoadMate Team */}
            <div className="logo-text">RoadMate Team</div>
            {roleBadge && (
              <div className={`role-badge-v2 ${roleBadgeClass || ''}`}>
                {roleBadge}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide py-2">
          {effectiveSections.map((section, sidx) => (
            <div key={sidx} className="sidebar-section">
              <div className="sidebar-label">{section.label}</div>
              {section.items.map((item, iidx) => {
                const isActive = location.pathname + location.search === item.path;
                const itemContent = (
                  <>
                    <div className="nav-icon-wrapper">
                      {typeof item.icon === 'string' ? getIcon(item.icon) : item.icon}
                    </div>
                    <span className="nav-label-text">{item.label}</span>
                    {item.badge && (
                      <span className={`nav-badge-v2 ${item.badgeColor || ''}`}>
                        {item.badge}
                      </span>
                    )}
                  </>
                );
                
                return (
                  <NavLink
                    key={iidx}
                    to={item.path}
                    className={`nav-item ${isActive ? 'active' : ''} ${item.special ? 'special-item' : ''}`}
                    onMouseEnter={() => handlePrefetch(item)}
                    onClick={(e) => {
                      if (item.onClick) {
                        e.preventDefault();
                        item.onClick();
                      }
                      setIsSidebarOpen(false);
                    }}
                  >
                    {itemContent}
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
                <div className="dropdown-item" onClick={() => { 
                  window.dispatchEvent(new CustomEvent('open-modal', { detail: 'change-password' }));
                  setIsUserDropdownOpen(false); 
                }}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M4 7V5a4 4 0 0 1 8 0v2M5 7h6a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Change Password
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
          <header className="header h-20 px-8 flex items-center justify-between border-b border-border bg-white sticky top-0 z-20">
            {/* Left: Title */}
            <div className="flex flex-col">
              <h1 className="text-lg font-black tracking-tight text-text-primary">{pageTitle}</h1>
              {pageSubtitle && <span className="text-[11px] font-bold text-muted mt-0.5">{pageSubtitle}</span>}
            </div>
            
            {/* Center: Search Bar */}
            <div className="flex-1 max-w-xl px-12" ref={searchRef}>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-orange transition-colors">
                  {isSearching ? (
                    <div className="w-4 h-4 border-2 border-orange/30 border-t-orange rounded-full animate-spin"></div>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                  )}
                </div>
                <input 
                  type="text" 
                  placeholder="Search leads, tasks, meetings..." 
                  className="w-full bg-surface2 border border-border rounded-xl py-2.5 pl-12 pr-4 text-xs font-bold focus:bg-white focus:ring-4 focus:ring-orange/5 focus:border-orange outline-none transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => searchQuery.length >= 2 && setShowSearchDropdown(true)}
                />

                {/* Search Dropdown */}
                {showSearchDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-border overflow-hidden z-[60] animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="max-h-[320px] overflow-y-auto">
                      {searchResults.leads.length === 0 && searchResults.staff.length === 0 ? (
                        <div className="p-8 text-center text-text-muted">
                          <div className="text-xl mb-1">🔍</div>
                          <div className="text-xs font-bold">No results found for "{searchQuery}"</div>
                        </div>
                      ) : (
                        <>
                          {searchResults.leads.length > 0 && (
                            <div className="p-2">
                              <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-text-muted">Leads</div>
                              {searchResults.leads.map(lead => (
                                <div 
                                  key={lead._id}
                                  className="flex items-center justify-between p-3 rounded-xl hover:bg-surface2 cursor-pointer transition-colors group"
                                  onClick={() => {
                                    // Map routes based on role or detail view
                                    navigate(`/leads/${lead._id}`);
                                    setShowSearchDropdown(false);
                                    setSearchQuery('');
                                  }}
                                >
                                  <div>
                                    <div className="text-[13px] font-bold group-hover:text-orange transition-colors">{lead.name}</div>
                                    <div className="text-[11px] text-text-muted font-medium">{lead.company}</div>
                                  </div>
                                  <div className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter ${lead.status === 'converted' ? 'bg-green/10 text-green' : 'bg-orange/10 text-orange'}`}>
                                    {lead.status}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {searchResults.staff.length > 0 && (
                            <div className="p-2 border-t border-border/50">
                              <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-text-muted">Staff</div>
                              {searchResults.staff.map(member => (
                                <div 
                                  key={member._id}
                                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface2 cursor-pointer transition-colors"
                                  onClick={() => {
                                    navigate(`/staff/${member._id}`);
                                    setShowSearchDropdown(false);
                                    setSearchQuery('');
                                  }}
                                >
                                  <div className="w-8 h-8 rounded-full bg-blue/10 text-blue flex items-center justify-center font-bold text-xs">
                                    {member.name.charAt(0)}
                                  </div>
                                  <div>
                                    <div className="text-[13px] font-bold">{member.name}</div>
                                    <div className="text-[11px] text-text-muted font-medium capitalize">{member.role.replace('_', ' ')}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-4">
              {userRole === 'executive' && (
                <button 
                  className="bg-[#B45309] hover:bg-[#92400E] text-white px-6 py-2.5 rounded-xl text-xs font-black shadow-lg shadow-orange/20 transition-all active:scale-95"
                  onClick={() => window.dispatchEvent(new CustomEvent('open-modal', { detail: 'add-lead' }))}
                >
                  + New Lead
                </button>
              )}

              <div className="flex items-center gap-2 border-l border-border pl-4">
                <div className="relative" ref={notifRef}>
                  <button 
                    className="w-10 h-10 rounded-xl hover:bg-surface2 flex items-center justify-center relative group transition-colors"
                    onClick={() => {
                      setIsNotificationOpen(!isNotificationOpen);
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted group-hover:text-text-primary"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
                    {unreadCount > 0 && (
                      <div className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 bg-red-500 border-2 border-white rounded-full flex items-center justify-center">
                        <span className="text-[8px] font-black text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>
                      </div>
                    )}
                  </button>

                  {isNotificationOpen && (
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-border z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="p-4 border-b border-border flex items-center justify-between">
                        <h3 className="font-bold text-sm">Notifications</h3>
                        <div className="flex gap-2">
                          {/* Only the founder and managers can message a team */}
                          {['founder', 'state_manager', 'industry_manager'].includes(userRole) && (
                            <button
                              onClick={() => {
                                setIsNotificationOpen(false);
                                window.dispatchEvent(new CustomEvent('open-modal', { detail: { type: 'send-notification' } }));
                              }}
                              className="text-[10px] font-bold text-[#0f766e] hover:underline"
                            >
                              Send to team
                            </button>
                          )}
                          {unreadCount > 0 && (
                            <button onClick={handleMarkAllRead} className="text-[10px] font-bold text-blue hover:underline">Mark all read</button>
                          )}
                          <button onClick={() => setIsNotificationOpen(false)} className="text-[10px] font-bold text-text-muted hover:underline">Close</button>
                        </div>
                      </div>
                      <div className="max-h-[400px] overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="p-8 text-center text-text-muted">
                            <div className="text-2xl mb-2">🔔</div>
                            <div className="text-xs font-bold">No notifications yet</div>
                          </div>
                        ) : (
                          notifications.map((n) => (
                            <div 
                              key={n._id} 
                              className={`p-4 border-b border-border last:border-0 hover:bg-surface2/30 transition-colors cursor-pointer ${!n.read ? 'bg-accent/5' : ''}`}
                              onClick={() => !n.read && handleMarkRead(n._id)}
                            >
                              <div className="flex gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs shrink-0
                                  ${n.type?.includes('leave') ? 'bg-blue/10 text-blue' : 
                                    n.type?.includes('staff') ? 'bg-orange/10 text-orange' : 
                                    n.type === 'document_uploaded' ? 'bg-purple/10 text-purple' :
                                    n.type?.includes('lead') ? 'bg-green/10 text-green' : 'bg-accent/10 text-accent'}
                                `}>
                                  {n.type?.includes('leave') ? '📅' : n.type?.includes('staff') ? '🤝' : n.type === 'document_uploaded' ? '📄' : n.type === 'broadcast' ? '📣' : n.type?.includes('lead') ? '👥' : '🔔'}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-bold text-text-primary line-clamp-2">{n.message}</div>
                                  <div className="text-[9px] text-text-muted mt-1 font-medium">
                                    {n.createdAt ? new Date(n.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                                  </div>
                                </div>
                                {!n.read && <div className="w-2 h-2 rounded-full bg-blue shrink-0 mt-1"></div>}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>


              </div>
            </div>
          </header>
        )}

        <div className="content">
          {children}
        </div>
      </div>

      {/* Meeting reminder banner — fixed bottom-right, appears for 1h and 15m alerts */}
      {activeMeeting && (
        <MeetingAlertBanner
          meeting={activeMeeting}
          onConfirm={handleMeetingConfirm}
          onReject={dismissMeeting}
          onFeedback={handleMeetingFeedback}
        />
      )}
    </div>
  );
};

export default DashboardLayout;
