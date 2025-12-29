import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';

const Layout = () => {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Навигация всегда сверху */}
      <Navbar />
      
      {/* Контент меняется здесь */}
      <div className="container mx-auto p-4">
        <Outlet />
      </div>
    </div>
  );
};

export default Layout;