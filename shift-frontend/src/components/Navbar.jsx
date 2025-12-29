import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t, language, toggleLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false); // Состояние мобильного меню
  
  const role = localStorage.getItem('userRole') || 'guest';
  const name = localStorage.getItem('userName') || 'User';
  const isAdmin = role === 'admin';

  const handleLogout = () => {
    localStorage.clear();
    navigate('/');
  };

  const getLinkClass = (path, isMobile = false) => {
    const isActive = location.pathname === path;
    const baseClasses = isMobile 
      ? "block px-3 py-2 rounded-md text-base font-medium" 
      : "px-3 py-2 rounded-md text-sm font-medium transition-colors";
      
    return `${baseClasses} ${
      isActive
        ? 'bg-blue-600 text-white'
        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
    }`;
  };

  return (
    <nav className="bg-gray-800 border-b border-gray-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* ЛЕВАЯ ЧАСТЬ: ЛОГОТИП И ДЕСКТОП МЕНЮ */}
          <div className="flex items-center">
            <Link to="/dashboard" className="flex-shrink-0 text-white font-bold text-xl mr-8 flex items-center gap-2">
              🚀 <span className="hidden sm:block">{t('nav_brand')}</span>
            </Link>
            
            {/* DESKTOP MENU (Скрыто на мобильных) */}
            <div className="hidden xl:flex items-center space-x-2">
              <Link to="/dashboard" className={getLinkClass('/dashboard')}>{t('nav_dashboard')}</Link>
              <Link to="/employee-schedules" className={getLinkClass('/employee-schedules')}>{t('nav_schedule')}</Link>
              
              <Link to="/payroll" className={`px-3 py-2 rounded-md text-sm font-medium transition-colors border border-green-600 ${
                  location.pathname.startsWith('/payroll') 
                    ? 'bg-green-700 text-white' 
                    : 'text-green-400 hover:bg-green-800 hover:text-white'
                }`}>
                  {t('nav_payroll')}
              </Link>

              {isAdmin && (
                <>
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

          {/* ПРАВАЯ ЧАСТЬ: ПРОФИЛЬ И ЯЗЫК */}
          <div className="hidden xl:flex items-center gap-4">
            <button 
              onClick={toggleLanguage}
              className="px-2 py-1 rounded bg-gray-700 text-gray-300 text-xs hover:bg-gray-600 border border-gray-600 uppercase font-bold w-10 h-8 flex items-center justify-center"
            >
              {language}
            </button>

            <div className="text-right">
              <div className="text-sm font-medium text-white">{name}</div>
              <div className="text-[10px] text-gray-400 uppercase leading-none">{role}</div>
            </div>
            
             <button 
              onClick={handleLogout}
              className="text-gray-400 hover:text-white text-sm font-medium border border-gray-600 px-3 py-1 rounded hover:bg-gray-700 transition-colors h-8 flex items-center"
            >
              {t('nav_logout')}
            </button>
          </div>

          {/* КНОПКА ГАМБУРГЕР (Только на мобильных) */}
          <div className="-mr-2 flex xl:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="bg-gray-700 inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-600 focus:outline-none"
            >
              <span className="sr-only">Open main menu</span>
              {/* Иконка меню (3 полоски или крестик) */}
              {!isOpen ? (
                <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              ) : (
                <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* МОБИЛЬНОЕ МЕНЮ (Выпадает) */}
      {isOpen && (
        <div className="xl:hidden bg-gray-800 border-t border-gray-700 shadow-xl">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            <Link to="/dashboard" className={getLinkClass('/dashboard', true)} onClick={() => setIsOpen(false)}>{t('nav_dashboard')}</Link>
            <Link to="/employee-schedules" className={getLinkClass('/employee-schedules', true)} onClick={() => setIsOpen(false)}>{t('nav_schedule')}</Link>
            <Link to="/payroll" className={`block px-3 py-2 rounded-md text-base font-medium text-green-400 hover:bg-gray-700 ${location.pathname.startsWith('/payroll') ? 'bg-gray-900' : ''}`} onClick={() => setIsOpen(false)}>{t('nav_payroll')}</Link>
            
            {isAdmin && (
              <>
                <Link to="/users" className={getLinkClass('/users', true)} onClick={() => setIsOpen(false)}>{t('nav_employees')}</Link>
                <Link to="/shifts" className={getLinkClass('/shifts', true)} onClick={() => setIsOpen(false)}>{t('nav_shifts')}</Link>
                <Link to="/reports-parse" className={getLinkClass('/reports-parse', true)} onClick={() => setIsOpen(false)}>{t('nav_reports_edit')}</Link>
                <Link to="/rates" className={getLinkClass('/rates', true)} onClick={() => setIsOpen(false)}>{t('nav_rates')}</Link>
                <Link to="/work-plans" className={getLinkClass('/work-plans', true)} onClick={() => setIsOpen(false)}>{t('nav_plans')}</Link>
                <Link to="/adminDashboard" className={getLinkClass('/adminDashboard', true)} onClick={() => setIsOpen(false)}>{t('nav_admin_db')}</Link>
              </>
            )}
          </div>
          
          <div className="pt-4 pb-4 border-t border-gray-700">
            <div className="flex items-center px-5 justify-between">
              <div className="flex items-center">
                 <div className="ml-3">
                  <div className="text-base font-medium leading-none text-white">{name}</div>
                  <div className="text-sm font-medium leading-none text-gray-400 mt-1">{role}</div>
                </div>
              </div>
              <div className="flex gap-2">
                  <button onClick={toggleLanguage} className="bg-gray-700 p-2 rounded text-white text-xs font-bold border border-gray-600">{language}</button>
                  <button onClick={handleLogout} className="bg-red-900/50 p-2 rounded text-red-200 text-xs border border-red-900">Выход</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;