import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Search, RefreshCw, AlertCircle } from 'lucide-react';

interface LoginEvent {
  id: string;
  user_id: string | null;
  email: string;
  success: boolean;
  error_message: string | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
  profile?: {
    name: string;
    email: string;
    role: string;
    location_id: string | null;
  };
}

const LoginEventsManagement = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all');

  // Fetch locations for filter
  const { data: locations, error: locationsError } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data;
    },
    retry: 2,
    staleTime: 10000,
  });

  const { data: loginEvents, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['login-events'],
    queryFn: async () => {
      // Pobierz wszystkie zdarzenia logowania
      const { data: events, error: eventsError } = await supabase
        .from('user_login_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      
      if (eventsError) throw eventsError;

      // Pobierz profile użytkowników (tylko dla tych z user_id)
      const userIds = [...new Set(events.filter(e => e.user_id).map(e => e.user_id!))];
      let profiles = [];
      
      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, name, email, role, location_id')
          .in('id', userIds);
        
        if (profilesError) throw profilesError;
        profiles = profilesData || [];
      }

      // Połącz dane
      const eventsWithProfiles = events.map(event => ({
        ...event,
        profile: event.user_id ? profiles.find(p => p.id === event.user_id) : undefined
      }));

      return eventsWithProfiles as LoginEvent[];
    },
    refetchInterval: 30000,
    retry: 2,
    staleTime: 10000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center">Ładowanie zdarzeń logowania...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p>Błąd podczas ładowania danych.</p>
            </div>
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Spróbuj ponownie
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Filtrowanie
  const filteredEvents = loginEvents?.filter(event => {
    const matchesSearch = 
      event.profile?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.profile?.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.ip?.includes(searchTerm);
    
    const matchesStatus = 
      statusFilter === 'all' ||
      (statusFilter === 'success' && event.success) ||
      (statusFilter === 'failed' && !event.success);
    
    const matchesLocation = 
      selectedLocationId === 'all' ||
      event.profile?.location_id === selectedLocationId;
    
    return matchesSearch && matchesStatus && matchesLocation;
  });

  // Statystyki
  const stats = {
    total: loginEvents?.length || 0,
    successful: loginEvents?.filter(e => e.success).length || 0,
    failed: loginEvents?.filter(e => !e.success).length || 0,
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Rejestr logowań</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            title="Odśwież dane"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <div className="flex gap-4 mt-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Szukaj po nazwie, email lub IP..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Placówka" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie placówki</SelectItem>
              {locations?.map((location) => (
                <SelectItem key={location.id} value={location.id}>
                  {location.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie ({stats.total})</SelectItem>
              <SelectItem value="success">Udane ({stats.successful})</SelectItem>
              <SelectItem value="failed">Nieudane ({stats.failed})</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {!filteredEvents?.length ? (
          <p className="text-center text-gray-500">Brak zdarzeń logowania.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data i czas</TableHead>
                  <TableHead>Użytkownik</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rola</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Błąd</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Przeglądarka</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvents.map((event) => (
                  <TableRow key={event.id} className={!event.success ? 'bg-red-50' : ''}>
                    <TableCell className="font-medium text-sm">
                      {new Date(event.created_at).toLocaleString('pl-PL', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </TableCell>
                    <TableCell>{event.profile?.name || 'Nieznany użytkownik'}</TableCell>
                    <TableCell className="text-sm">{event.email || event.profile?.email || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {event.profile?.role || '-'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {event.success ? (
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="text-sm font-medium">Udane</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-red-600">
                          <XCircle className="h-4 w-4" />
                          <span className="text-sm font-medium">Nieudane</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-red-600 max-w-xs truncate">
                      {event.error_message || '-'}
                    </TableCell>
                    <TableCell className="text-sm font-mono">{event.ip || '-'}</TableCell>
                    <TableCell className="text-sm text-gray-600 max-w-xs truncate" title={event.user_agent || ''}>
                      {event.user_agent ? 
                        event.user_agent.includes('Chrome') ? 'Chrome' :
                        event.user_agent.includes('Firefox') ? 'Firefox' :
                        event.user_agent.includes('Safari') ? 'Safari' :
                        event.user_agent.includes('Edge') ? 'Edge' :
                        'Inna'
                        : '-'
                      }
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LoginEventsManagement;
