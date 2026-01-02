import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t, language, toggleLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  
  const role = localStorage.getItem('userRole') || 'guest';
  const name = localStorage.getItem('userName') || 'User';
  const isAdmin = role === 'admin';

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  const getLinkClass = (path, isMobile = false) => {
    const isActive = location.pathname.startsWith(path);
    const baseClasses = isMobile 
      ? "block w-full text-left px-4 py-3 rounded-lg text-base font-medium" 
      : "h-10 px-4 inline-flex items-center rounded-lg text-sm font-medium transition-colors";
      
    return `${baseClasses} ${
      isActive
        ? 'bg-blue-600 text-white'
        : 'text-gray-400 hover:text-white hover:bg-gray-800'
    }`;
  };

  // SVG Icons
  const MenuIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>;
  const CloseIcon = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;

  return (
    <nav className="bg-[#0F1115] border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* LOGO & DESKTOP MENU */}
          <div className="flex items-center gap-8">
            <Link to="/dashboard" className="flex-shrink-0 text-white font-bold text-xl tracking-tight">
              ShiftManager
            </Link>
            
            <div className="hidden xl:flex items-center gap-1">
              <Link to="/dashboard" className={getLinkClass('/dashboard')}>{t('nav_dashboard')}</Link>
              <Link to="/employee-schedules" className={getLinkClass('/employee-schedules')}>{t('nav_schedule')}</Link>
              <Link to="/payroll" className={getLinkClass('/payroll')}>{t('nav_payroll')}</Link>

              {isAdmin && (
                <>
                  <div className="w-px h-6 bg-gray-800 mx-2"></div>
                  <Link to="/users" className={getLinkClass('/users')}>{t('nav_employees')}</Link>
                  <Link to="/shifts" className={getLinkClass('/shifts')}>{t('nav_shifts')}</Link>
                  <Link to="/reports-parse" className={getLinkClass('/reports-parse')}>{t('nav_reports_edit')}</Link>
                  <Link to="/rates" className={getLinkClass('/rates')}>{t('nav_rates')}</Link>
                  <Link to="/work-plans" className={getLinkClass('/work-plans')}>{t('nav_plans')}</Link>
                  <Link to="/adminDashboard" className={getLinkClass('/adminDashboard')}>{t('nav_admin_db')}</Link>
                </>
              )}
            </div>
          </div>

          {/* RIGHT SIDE: PROFILE & ACTIONS */}
          <div className="hidden xl:flex items-center gap-6">
            <button 
              onClick={toggleLanguage}
              className="text-xs font-bold text-gray-400 hover:text-white uppercase tracking-wider px-2 py-2"
            >
              {language}
            </button>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-sm font-medium text-white leading-none">{name}</div>
                <div className="text-xs text-gray-500 mt-1 uppercase tracking-wide">{role}</div>
              </div>
              
              <button 
                onClick={handleLogout}
                className="h-9 px-4 rounded-lg bg-gray-800 text-gray-300 text-sm font-medium hover:bg-red-900/20 hover:text-red-400 transition-colors"
              >
                {t('nav_logout')}
              </button>
            </div>
          </div>

          {/* MOBILE MENU BUTTON */}
          <div className="xl:hidden flex items-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-3 -mr-3 text-gray-400 hover:text-white"
            >
              {isOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>
      </div>

      {/* MOBILE MENU DRAWER */}
      {isOpen && (
        <div className="xl:hidden bg-[#0F1115] border-t border-gray-800 absolute w-full left-0 shadow-2xl">
          <div className="px-4 pt-4 pb-6 space-y-2">
            <Link to="/dashboard" className={getLinkClass('/dashboard', true)} onClick={() => setIsOpen(false)}>{t('nav_dashboard')}</Link>
            <Link to="/employee-schedules" className={getLinkClass('/employee-schedules', true)} onClick={() => setIsOpen(false)}>{t('nav_schedule')}</Link>
            <Link to="/payroll" className={getLinkClass('/payroll', true)} onClick={() => setIsOpen(false)}>{t('nav_payroll')}</Link>
            
            {isAdmin && (
              <div className="pt-4 mt-4 border-t border-gray-800 space-y-2">
                <p className="px-4 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Administration</p>
                <Link to="/users" className={getLinkClass('/users', true)} onClick={() => setIsOpen(false)}>{t('nav_employees')}</Link>
                <Link to="/shifts" className={getLinkClass('/shifts', true)} onClick={() => setIsOpen(false)}>{t('nav_shifts')}</Link>
                <Link to="/reports-parse" className={getLinkClass('/reports-parse', true)} onClick={() => setIsOpen(false)}>{t('nav_reports_edit')}</Link>
                <Link to="/rates" className={getLinkClass('/rates', true)} onClick={() => setIsOpen(false)}>{t('nav_rates')}</Link>
                <Link to="/work-plans" className={getLinkClass('/work-plans', true)} onClick={() => setIsOpen(false)}>{t('nav_plans')}</Link>
                <Link to="/adminDashboard" className={getLinkClass('/adminDashboard', true)} onClick={() => setIsOpen(false)}>{t('nav_admin_db')}</Link>
              </div>
            )}
            
            <div className="pt-6 mt-6 border-t border-gray-800 flex items-center justify-between px-4">
               <div>
                  <div className="text-base font-medium text-white">{name}</div>
                  <div className="text-sm text-gray-500">{role}</div>
               </div>
               <div className="flex gap-4">
                  <button onClick={toggleLanguage} className="p-2 text-gray-400 uppercase font-bold">{language}</button>
                  <button onClick={handleLogout} className="text-red-400 font-medium">Exit</button>
               </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;