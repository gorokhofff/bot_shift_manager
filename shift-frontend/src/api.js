import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://66.151.43.24:8000";

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Единый перехватчик для обработки ошибок или добавления токенов
api.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default api;