import axios from 'axios';

// Базовый URL для API
const API = axios.create({
  baseURL: 'http://66.151.43.24:8000',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  // Отключаем credentials для избежания CORS проблем
  withCredentials: false,
});

// Интерцептор для логирования запросов
API.interceptors.request.use(
  (config) => {
    console.log('📡 API Request:', {
      method: config.method?.toUpperCase(),
      url: config.url,
      baseURL: config.baseURL,
      fullURL: `${config.baseURL}${config.url}`,
      data: config.data ? JSON.stringify(config.data).substring(0, 200) + '...' : 'No data',
      headers: config.headers
    });
    return config;
  },
  (error) => {
    console.error('❌ API Request Error:', error);
    return Promise.reject(error);
  }
);

// Интерцептор для логирования ответов
API.interceptors.response.use(
  (response) => {
    console.log('✅ API Response:', {
      status: response.status,
      statusText: response.statusText,
      url: response.config.url,
      method: response.config.method?.toUpperCase(),
      data: response.data
    });
    return response;
  },
  (error) => {
    console.error('❌ API Response Error:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: error.config?.url,
      method: error.config?.method?.toUpperCase(),
      data: error.response?.data,
      
      // Детальная информация об ошибке
      errorType: error.code,
      isNetworkError: error.message === 'Network Error',
      isCorsError: error.message.includes('CORS'),
      isTimeoutError: error.code === 'ECONNABORTED',
      
      // Для отладки CORS
      requestHeaders: error.config?.headers,
      responseHeaders: error.response?.headers,
    });
    
    // Улучшенная обработка ошибок
    if (error.message === 'Network Error') {
      console.error('🚨 Сетевая ошибка: Проверьте что backend запущен на http://66.151.43.24:8000');
    }
    
    if (error.code === 'ECONNABORTED') {
      console.error('⏰ Таймаут: Запрос занял больше 30 секунд');
    }
    
    return Promise.reject(error);
  }
);

// НЕ добавляем токен для избежания CORS проблем пока
// API.interceptors.request.use((config) => {
//   const token = localStorage.getItem('token');
//   if (token) {
//     config.headers.Authorization = `Bearer ${token}`;
//   }
//   return config;
// });

// Дополнительные утилиты для отладки
API.testConnection = async () => {
  try {
    console.log('🧪 Тестируем подключение к API...');
    const response = await API.get('/reports');
    console.log('✅ Подключение успешно:', response.data.length, 'отчетов');
    return true;
  } catch (error) {
    console.error('❌ Подключение не удалось:', error.message);
    return false;
  }
};

export default API;