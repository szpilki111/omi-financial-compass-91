
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import PageTitle from '@/components/ui/PageTitle';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { calculateFinancialSummary } from '@/utils/financeUtils';
import { useAuth } from '@/context/AuthContext';

const DataVisualizationPage = () => {
  const { user } = useAuth();
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');

  // Pobierz role użytkownika
  const { data: userRole } = useQuery({
    queryKey: ['userRole'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_user_role');
      if (error) throw error;
      return data;
    }
  });

  // Pobierz dostępne lokalizacje
  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      let query = supabase.from('locations').select('id, name').order('name');
      
      // Jeśli użytkownik to ekonom, pokaż tylko jego lokalizację
      if (userRole === 'ekonom') {
        const { data: userLocationId } = await supabase.rpc('get_user_location_id');
        if (userLocationId) {
          query = query.eq('id', userLocationId);
          setSelectedLocationId(userLocationId); // Ustaw domyślnie lokalizację ekonoma
        }
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!userRole
  });

  // Pobierz dane finansowe dla wykresu miesięcznego
  const { data: monthlyData } = useQuery({
    queryKey: ['monthlyFinancialData', selectedYear, selectedLocationId],
    queryFn: async () => {
      const months = [];
      for (let month = 1; month <= 12; month++) {
        const firstDayOfMonth = new Date(selectedYear, month - 1, 1);
        const lastDayOfMonth = new Date(selectedYear, month, 0);
        const dateFrom = firstDayOfMonth.toISOString().split('T')[0];
        const dateTo = lastDayOfMonth.toISOString().split('T')[0];
        
        const summary = await calculateFinancialSummary(
          selectedLocationId || null,
          dateFrom,
          dateTo
        );
        
        months.push({
          month: new Date(selectedYear, month - 1).toLocaleDateString('pl-PL', { month: 'short' }),
          monthNumber: month,
          przychody: summary.income,
          rozchody: summary.expense,
          saldo: summary.balance
        });
      }
      return months;
    },
    enabled: !!selectedYear
  });

  // Pobierz dane roczne dla porównania
  const { data: yearlyData } = useQuery({
    queryKey: ['yearlyFinancialData', selectedLocationId],
    queryFn: async () => {
      const currentYear = new Date().getFullYear();
      const years = [];
      
      for (let year = currentYear - 4; year <= currentYear; year++) {
        const dateFrom = `${year}-01-01`;
        const dateTo = `${year}-12-31`;
        
        const summary = await calculateFinancialSummary(
          selectedLocationId || null,
          dateFrom,
          dateTo
        );
        
        years.push({
          year: year.toString(),
          przychody: summary.income,
          rozchody: summary.expense,
          saldo: summary.balance
        });
      }
      return years;
    },
    enabled: !!selectedLocationId || userRole === 'admin' || userRole === 'prowincjal'
  });

  const currentYearData = monthlyData?.reduce((acc, month) => ({
    przychody: acc.przychody + month.przychody,
    rozchody: acc.rozchody + month.rozchody,
    saldo: acc.saldo + month.saldo
  }), { przychody: 0, rozchody: 0, saldo: 0 });

  const pieData = currentYearData ? [
    { name: 'Przychody', value: currentYearData.przychody, fill: '#10b981' },
    { name: 'Rozchody', value: Math.abs(currentYearData.rozchody), fill: '#ef4444' }
  ] : [];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - i);

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageTitle title="Wizualizacja danych finansowych" />
        
        {/* Filtry */}
        <div className="flex gap-4">
          <div className="w-48">
            <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
              <SelectTrigger>
                <SelectValue placeholder="Wybierz rok" />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {userRole !== 'ekonom' && (
            <div className="w-64">
              <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Wszystkie lokalizacje" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Wszystkie lokalizacje</SelectItem>
                  {locations?.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Podsumowanie roczne */}
        {currentYearData && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Przychody {selectedYear}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-green-600">
                  {formatCurrency(currentYearData.przychody)}
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Rozchody {selectedYear}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-red-600">
                  {formatCurrency(Math.abs(currentYearData.rozchody))}
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Saldo {selectedYear}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-3xl font-bold ${currentYearData.saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(currentYearData.saldo)}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Wykres miesięczny */}
        <Card>
          <CardHeader>
            <CardTitle>Przebieg finansowy {selectedYear} - miesięcznie</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ width: '100%', height: 400 }}>
              <ResponsiveContainer>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={formatCurrency} />
                  <Tooltip formatter={(value: any) => formatCurrency(value)} />
                  <Legend />
                  <Line type="monotone" dataKey="przychody" stroke="#10b981" name="Przychody" strokeWidth={2} />
                  <Line type="monotone" dataKey="rozchody" stroke="#ef4444" name="Rozchody" strokeWidth={2} />
                  <Line type="monotone" dataKey="saldo" stroke="#3b82f6" name="Saldo" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Wykres porównawczy - lata */}
        {yearlyData && yearlyData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Porównanie roczne - ostatnie 5 lat</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ width: '100%', height: 400 }}>
                <ResponsiveContainer>
                  <BarChart data={yearlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" />
                    <YAxis tickFormatter={formatCurrency} />
                    <Tooltip formatter={(value: any) => formatCurrency(value)} />
                    <Legend />
                    <Bar dataKey="przychody" fill="#10b981" name="Przychody" />
                    <Bar dataKey="rozchody" fill="#ef4444" name="Rozchody" />
                    <Bar dataKey="saldo" fill="#3b82f6" name="Saldo" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Wykres kołowy - struktura finansowa */}
        {currentYearData && currentYearData.przychody > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Struktura finansowa {selectedYear}</CardTitle>
            </CardHeader>
            <CardContent>
              <div style={{ width: '100%', height: 400 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${formatCurrency(value)}`}
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
};

export default DataVisualizationPage;
