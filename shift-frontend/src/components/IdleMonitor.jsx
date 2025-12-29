import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

// ВРЕМЯ ТАЙМАУТА В МИНУТАХ (Настройте здесь)
const TIMEOUT_MINUTES = 30; 

const IdleMonitor = () => {
  const navigate = useNavigate();
  const timerRef = useRef(null);

  const logoutUser = () => {
    // Если пользователь и так не залогинен, ничего не делаем
    if (!localStorage.getItem('token')) return;

    console.log("⏳ Session expired due to inactivity");
    localStorage.clear();
    navigate('/'); // Перенаправляем на вход
    // Можно добавить alert("Сессия истекла из-за неактивности");
  };

  const resetTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    
    // Если пользователь на странице логина, таймер не нужен
    if (window.location.pathname === '/') return;

    timerRef.current = setTimeout(logoutUser, TIMEOUT_MINUTES * 60 * 1000);
  };

  useEffect(() => {
    // События, которые считаются "активностью"
    const events = ['click', 'mousemove', 'keydown', 'scroll', 'touchstart'];

    // Запускаем таймер при загрузке
    resetTimer();

    // Вешаем слушатели
    events.forEach(event => window.addEventListener(event, resetTimer));

    // Чистим за собой
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [navigate]);

  return null; // Этот компонент ничего не рисует
};

export default IdleMonitor;