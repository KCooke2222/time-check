import { useState } from 'react';
import { authAPI } from '../services/api';

function Login({ onLoginSuccess }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await authAPI.login();
      // Redirect to Google OAuth
      window.location.href = response.authorization_url;
    } catch (err) {
      console.error('Login failed:', err);
      setError('Failed to initiate login. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
      <div className="bg-white p-8 rounded-lg shadow-2xl max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Time Track</h1>
          <p className="text-gray-600">
            Track your time with intensity-based metrics
          </p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={isLoading}
          className={`w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold text-lg transition duration-200 ${
            isLoading
              ? 'opacity-50 cursor-not-allowed'
              : 'hover:bg-blue-700 hover:shadow-lg'
          }`}
        >
          {isLoading ? 'Redirecting...' : 'Login with Google'}
        </button>

        <div className="mt-6 text-sm text-gray-600 text-center">
          <p>By logging in, you authorize this app to:</p>
          <ul className="mt-2 space-y-1">
            <li>Access your Google Calendar (read-only)</li>
            <li>Track event duration and colors</li>
            <li>Generate time reports</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default Login;
