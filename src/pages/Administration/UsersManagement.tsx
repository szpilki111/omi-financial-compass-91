
import React from 'react';
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

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  location_id: string | null;
  created_at: string;
  location?: {
    name: string;
  };
}

const getRoleBadgeProps = (role: string) => {
  switch (role) {
    case 'admin':
      return { variant: 'destructive' as const, className: 'bg-red-100 text-red-800 border-red-200' };
    case 'prowincjal':
      return { variant: 'outline' as const, className: 'bg-blue-100 text-blue-800 border-blue-200' };
    case 'ekonom':
      return { variant: 'outline' as const, className: 'bg-green-100 text-green-800 border-green-200' };
    default:
      return { variant: 'outline' as const, className: 'bg-gray-100 text-gray-800 border-gray-200' };
  }
};

const getRoleLabel = (role: string) => {
  switch (role) {
    case 'admin': return 'Administrator';
    case 'prowincjal': return 'Prowincjał';
    case 'ekonom': return 'Ekonom';
    default: return role;
  }
};

const UsersManagement = () => {
  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          location:locations(name)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as UserProfile[];
    }
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center">Ładowanie użytkowników...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Zarządzanie użytkownikami</CardTitle>
      </CardHeader>
      <CardContent>
        {!users?.length ? (
          <p className="text-center text-omi-gray-500">Brak użytkowników w systemie.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Imię i nazwisko</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rola</TableHead>
                <TableHead>Placówka</TableHead>
                <TableHead>Data utworzenia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge {...getRoleBadgeProps(user.role)}>
                      {getRoleLabel(user.role)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.location?.name || '-'}
                  </TableCell>
                  <TableCell>
                    {new Date(user.created_at).toLocaleDateString('pl-PL')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default UsersManagement;
