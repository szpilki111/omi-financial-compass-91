
import React from 'react';
import ReportAccountsBreakdown from './ReportAccountsBreakdown';

interface YearToDateAccountsBreakdownProps {
  locationId: string;
  month: number;
  year: number;
}

const months = [
  { value: '1', label: 'Styczeń' },
  { value: '2', label: 'Luty' },
  { value: '3', label: 'Marzec' },
  { value: '4', label: 'Kwiecień' },
  { value: '5', label: 'Maj' },
  { value: '6', label: 'Czerwiec' },
  { value: '7', label: 'Lipiec' },
  { value: '8', label: 'Sierpień' },
  { value: '9', label: 'Wrzesień' },
  { value: '10', label: 'Październik' },
  { value: '11', label: 'Listopad' },
  { value: '12', label: 'Grudzień' }
];

const YearToDateAccountsBreakdown: React.FC<YearToDateAccountsBreakdownProps> = ({ 
  locationId, 
  month, 
  year 
}) => {
  return (
    <div className="bg-blue-50 p-4 rounded-lg">
      <h3 className="text-lg font-semibold mb-4">
        Szczegółowa rozpiska kont od początku {year} roku do końca {months.find(m => m.value === month.toString())?.label}
      </h3>
      
      <ReportAccountsBreakdown
        reportId=""
        locationId={locationId}
        month={12} // Ustawiamy na 12, aby pobrać cały rok
        year={year}
        dateRange={{
          from: `${year}-01-01`,
          to: (() => {
            const lastDay = new Date(year, month, 0);
            return `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
          })()
        }}
      />
    </div>
  );
};

export default YearToDateAccountsBreakdown;
