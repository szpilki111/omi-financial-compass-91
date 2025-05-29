
import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import LocationsManagement from './LocationsManagement';
import UsersManagement from './UsersManagement';

const AdministrationPage = () => {
  const { user } = useAuth();

  // Sprawdź czy użytkownik ma uprawnienia
  if (!user || (user.role !== 'admin' && user.role !== 'prowincjal')) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-omi-gray-500">
              Brak uprawnień do tej sekcji.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-omi-900">Administracja</h1>
        <p className="text-omi-gray-600">
          Zarządzanie systemem finansowym domów zakonnych OMI
        </p>
      </div>

      <Tabs defaultValue="locations" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="locations">Placówki</TabsTrigger>
          {user.role === 'admin' && (
            <TabsTrigger value="users">Użytkownicy</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="locations" className="space-y-4">
          <LocationsManagement />
        </TabsContent>

        {user.role === 'admin' && (
          <TabsContent value="users" className="space-y-4">
            <UsersManagement />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default AdministrationPage;
