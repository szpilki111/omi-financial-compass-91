
import React from 'react';
import { Link } from 'react-router-dom';

const AccessDenied = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-omi-gray-100">
      <div className="bg-white p-8 rounded-md shadow-md w-full max-w-md text-center">
        <h1 className="text-2xl font-bold text-red-500 mb-2">Dostęp zabroniony</h1>
        <p className="text-gray-600 mb-6">
          Nie masz uprawnień do przeglądania tej strony.
        </p>
        <Link to="/dashboard" className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition-colors">
          Powrót do głównej strony
        </Link>
      </div>
    </div>
  );
};

export default AccessDenied;
