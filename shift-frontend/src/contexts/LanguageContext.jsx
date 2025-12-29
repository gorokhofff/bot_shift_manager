import React, { createContext, useState, useContext, useEffect } from 'react';
import { translations } from '../translations';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  // Загружаем язык из localStorage или по умолчанию 'ru'
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('appLanguage') || 'ru';
  });

  useEffect(() => {
    localStorage.setItem('appLanguage', language);
  }, [language]);

  const t = (key) => {
    return translations[language][key] || key;
  };

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'ru' ? 'tr' : 'ru');
  };

  // Получение названия месяца
  const getMonthName = (monthIndex) => {
    // monthIndex 0-11
    return t(`month_${monthIndex + 1}`);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, toggleLanguage, getMonthName }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);