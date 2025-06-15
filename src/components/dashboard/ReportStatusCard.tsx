import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText } from 'lucide-react';

const ReportStatusCard: React.FC = () => {
  const { user } = useAuth();
  
  // Pobierz najnowszy raport dla bieżącego miesiąca
  const { data: currentReport, isLoading } = useQuery({
    queryKey: ['currentMonthReport', user?.location?.id],
    queryFn: async () => {
      if (!user?.location?.id) return null;
      
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1;
      const currentYear = currentDate.getFullYear();
      
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('location_id', user.location.id)
        .eq('month', currentMonth)
        .eq('year', currentYear)
        .maybeSingle();
        
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      return data;
    },
    enabled: !!user?.location?.id
  });

  const getStatusMessage = (status: string | undefined) => {
    if (!status) {
      const currentDate = new Date();
      const monthName = currentDate.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
      return `Raport za ${monthName} nie został utworzony`;
    }
    
    switch (status) {
      case 'draft':
        return 'Utworzono wersję roboczą';
      case 'submitted':
        return 'Złożono, oczekiwanie na akceptację';
      case 'approved':
        return 'Złożono, zaakceptowany';
      case 'to_be_corrected':
        return 'Złożono, wymagane poprawki';
      default:
        return `Status: ${status}`;
    }
  };

  const getStatusBadgeProps = (status: string | undefined) => {
    if (!status) {
      return { variant: 'secondary' as const, className: 'bg-gray-100 text-gray-800' };
    }
    
    switch (status) {
      case 'draft':
        return { variant: 'secondary' as const, className: 'bg-yellow-100 text-yellow-800' };
      case 'submitted':
        return { variant: 'outline' as const, className: 'bg-blue-100 text-blue-800 border-blue-200' };
      case 'approved':
        return { variant: 'outline' as const, className: 'bg-green-100 text-green-800 border-green-200' };
      case 'to_be_corrected':
        return { variant: 'outline' as const, className: 'bg-orange-100 text-orange-800 border-orange-200' };
      default:
        return { variant: 'secondary' as const };
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Status raportu za miesiąc</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-lg font-bold">Ładowanie...</div>
        </CardContent>
      </Card>
    );
  }

  const currentDate = new Date();
  const monthName = currentDate.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Status raportu za miesiąc</CardTitle>
        <FileText className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-lg font-bold">{monthName}</div>
        <div className="mt-2">
          <Badge {...getStatusBadgeProps(currentReport?.status)}>
            {getStatusMessage(currentReport?.status)}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};

export default ReportStatusCard;
