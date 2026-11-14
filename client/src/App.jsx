import { useState } from 'react';
import AuthForm from './components/AuthForm';
import Dashboard from './components/Dashboard';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => Boolean(window.localStorage.getItem('token')),
  );

  function handleLogout() {
    window.localStorage.removeItem('token');
    setIsAuthenticated(false);
  }

  return isAuthenticated
    ? <Dashboard onLogout={handleLogout} />
    : <AuthForm onAuthenticated={() => setIsAuthenticated(true)} />;
}

export default App;
