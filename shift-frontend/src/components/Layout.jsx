import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';

const Layout = () => {
  return (
    <div className="min-h-screen bg-[#0F1115] text-white selection:bg-blue-500/30">
      <Navbar />
      
      {/* Используем max-w-screen-2xl для больших экранов.
         Padding увеличен для десктопа согласно гайдлайнам.
      */}
      <main className="container mx-auto px-4 py-6 md:px-8 md:py-8 lg:max-w-[1400px]">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;