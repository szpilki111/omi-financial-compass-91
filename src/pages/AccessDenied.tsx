
import React from 'react';
import { Link } from 'react-router-dom';

const AccessDenied = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-omi-gray-100">
      <div className="bg-white p-8 rounded-md shadow-md w-full max-w-md text-center">
        <h1 className="text-2xl font-bold text-omi-500 mb-2">Dostęp zabroniony</h1>
        <p className="text-omi-gray-600 mb-6">
          Nie posiadasz wymaganych uprawnień do wyświetlenia tej strony.
        </p>
        <Link to="/" className="omi-btn omi-btn-primary">
          Powrót do strony głównej
        </Link>
      </div>
    </div>
  );
};

export default AccessDenied;
