
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import PageTitle from '@/components/ui/PageTitle';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/hooks/use-toast';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

interface MonthlyData {
  month: string;
  year: number;
  monthNumber: number;
  income: number;
  expense: number;
  balance: number;
  period: string;
}

const chartConfig = {
  income: {
    label: "Dochody",
    color: "hsl(142, 76%, 36%)",
  },
  expense: {
    label: "Wydatki", 
    color: "hsl(0, 84%, 60%)",
  },
  balance: {
    label: "Bilans",
    color: "hsl(221, 83%, 53%)",
  },
};

const DataVisualizationPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<MonthlyData[]>([]);

  const fetchVisualizationData = async () => {
    setLoading(true);
    try {
      // Sprawdź rolę użytkownika
      const { data: userRole } = await supabase.rpc('get_user_role');
      
      let query = supabase
        .from('reports')
        .select(`
          month,
          year,
          period,
          location_id,
          report_details!inner(
            income_total,
            expense_total,
            balance
          )
        `)
        .eq('status', 'accepted');

      // Jeśli użytkownik jest ekonomem, pobierz tylko dane jego placówki
      if (userRole === 'ekonom') {
        const { data: locationId } = await supabase.rpc('get_user_location_id');
        if (locationId) {
          query = query.eq('location_id', locationId);
        }
      }

      const { data: reports, error } = await query.order('year', { ascending: true }).order('month', { ascending: true });

      if (error) {
        throw error;
      }

      console.log('Pobrane raporty:', reports);

      // Grupuj dane według miesięcy i sumuj wartości
      const monthlyDataMap = new Map<string, MonthlyData>();

      reports?.forEach((report: any) => {
        const key = `${report.year}-${report.month.toString().padStart(2, '0')}`;
        const monthName = format(new Date(report.year, report.month - 1, 1), 'LLLL yyyy', { locale: pl });
        
        if (monthlyDataMap.has(key)) {
          const existing = monthlyDataMap.get(key)!;
          existing.income += Number(report.report_details.income_total) || 0;
          existing.expense += Number(report.report_details.expense_total) || 0;
          existing.balance += Number(report.report_details.balance) || 0;
        } else {
          monthlyDataMap.set(key, {
            month: monthName,
            year: report.year,
            monthNumber: report.month,
            income: Number(report.report_details.income_total) || 0,
            expense: Number(report.report_details.expense_total) || 0,
            balance: Number(report.report_details.balance) || 0,
            period: report.period
          });
        }
      });

      // Konwertuj mapę na tablicę i posortuj chronologicznie
      const sortedData = Array.from(monthlyDataMap.values()).sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.monthNumber - b.monthNumber;
      });

      setChartData(sortedData);

    } catch (error) {
      console.error('Błąd podczas pobierania danych wizualizacji:', error);
      toast({
        title: "Błąd",
        description: "Nie udało się pobrać danych do wizualizacji",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVisualizationData();
  }, [user]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex justify-center items-center h-64">
          <Spinner size="lg" />
        </div>
      </MainLayout>
    );
  }

  if (!chartData.length) {
    return (
      <MainLayout>
        <PageTitle 
          title="Wizualizacja danych" 
          subtitle="Analiza finansowa na podstawie zaakceptowanych raportów"
        />
        <div className="bg-white p-8 rounded-lg shadow-sm text-center">
          <p className="text-omi-gray-500">Brak danych do wyświetlenia. Upewnij się, że istnieją zaakceptowane raporty.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageTitle 
          title="Wizualizacja danych" 
          subtitle="Analiza finansowa na podstawie zaakceptowanych raportów"
        />

        {/* Wykres liniowy - Trendy czasowe */}
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Trendy finansowe w czasie</h2>
          <ChartContainer config={chartConfig} className="h-96 w-full">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="month" 
                angle={-45}
                textAnchor="end"
                height={80}
                fontSize={12}
              />
              <YAxis 
                tickFormatter={formatCurrency}
                fontSize={12}
              />
              <ChartTooltip 
                content={<ChartTooltipContent 
                  formatter={(value: number, name: string) => [
                    formatCurrency(value), 
                    chartConfig[name as keyof typeof chartConfig]?.label || name
                  ]}
                />} 
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="income" 
                stroke="var(--color-income)" 
                strokeWidth={3}
                name="Dochody"
                dot={{ r: 4 }}
              />
              <Line 
                type="monotone" 
                dataKey="expense" 
                stroke="var(--color-expense)" 
                strokeWidth={3}
                name="Wydatki"
                dot={{ r: 4 }}
              />
              <Line 
                type="monotone" 
                dataKey="balance" 
                stroke="var(--color-balance)" 
                strokeWidth={3}
                name="Bilans"
                dot={{ r: 4 }}
              />
            </LineChart>
          </ChartContainer>
        </div>

        {/* Podsumowanie statystyk */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold text-green-600 mb-2">Łączne dochody</h3>
            <p className="text-3xl font-bold">
              {formatCurrency(chartData.reduce((sum, item) => sum + item.income, 0))}
            </p>
            <p className="text-sm text-omi-gray-500 mt-1">
              Za okres {chartData.length} miesięcy
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold text-red-600 mb-2">Łączne wydatki</h3>
            <p className="text-3xl font-bold">
              {formatCurrency(chartData.reduce((sum, item) => sum + item.expense, 0))}
            </p>
            <p className="text-sm text-omi-gray-500 mt-1">
              Za okres {chartData.length} miesięcy
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold text-blue-600 mb-2">Bilans końcowy</h3>
            <p className="text-3xl font-bold">
              {formatCurrency(chartData.reduce((sum, item) => sum + item.balance, 0))}
            </p>
            <p className="text-sm text-omi-gray-500 mt-1">
              Za okres {chartData.length} miesięcy
            </p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default DataVisualizationPage;
