
import React from 'react';

interface PageTitleProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

const PageTitle = ({ title, subtitle, actions }: PageTitleProps) => {
  return (
    <div className="mb-6 md:flex md:items-center md:justify-between">
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-medium leading-7 text-omi-gray-800 sm:truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-omi-gray-500">{subtitle}</p>
        )}
      </div>
      {actions && <div className="mt-4 flex md:mt-0 md:ml-4">{actions}</div>}
    </div>
  );
};

export default PageTitle;
