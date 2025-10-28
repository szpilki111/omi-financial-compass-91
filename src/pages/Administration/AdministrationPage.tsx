import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MainLayout from '@/components/layout/MainLayout';
import LocationsManagement from './LocationsManagement';
import LocationAccountsManagement from './LocationAccountsManagement';
import UsersManagement from './UsersManagement';
import AccountsManagement from './AccountsManagement';
import AccountRestrictionsManagement from './AccountRestrictionsManagement';
import DatabaseManagement from './DatabaseManagement';
import ErrorReportsManagement from './ErrorReportsManagement';
import LoginEventsManagement from './LoginEventsManagement';
import EmailTestManagement from './EmailTestManagement';
import ProjectFeaturesManagement from './ProjectFeaturesManagement';

const AdministrationPage = () => {
  const { user } = useAuth();

  // Sprawdź czy użytkownik ma uprawnienia
  if (!user || (user.role !== 'admin' && user.role !== 'prowincjal')) {
    return (
      <MainLayout>
        <div className="p-6">
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-omi-gray-500">
                Brak uprawnień do tej sekcji.
              </p>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-omi-900">Administracja</h1>
          <p className="text-omi-gray-600">
            Zarządzanie systemem finansowym domów zakonnych OMI
          </p>
        </div>

      <Tabs defaultValue="locations" className="w-full">
        <TabsList className="grid w-full grid-cols-10">
          <TabsTrigger value="locations">Placówki</TabsTrigger>
          <TabsTrigger value="accounts">Konta placówek</TabsTrigger>
          <TabsTrigger value="manage-accounts">Zarządzanie kontami</TabsTrigger>
          <TabsTrigger value="account-restrictions">Ograniczenia kont</TabsTrigger>
          {(user.role === 'admin' || user.role === 'prowincjal') && (
            <TabsTrigger value="users">Użytkownicy</TabsTrigger>
          )}
          {(user.role === 'admin' || user.role === 'prowincjal') && (
            <TabsTrigger value="login-events">Logowania</TabsTrigger>
          )}
          {user.role === 'admin' && (
            <TabsTrigger value="email-test">Test Email</TabsTrigger>
          )}
          {user.role === 'admin' && (
            <TabsTrigger value="database">Baza danych</TabsTrigger>
          )}
          {(user.role === 'admin' || user.role === 'prowincjal') && (
            <TabsTrigger value="error-reports">Zgłoszenia błędów</TabsTrigger>
          )}
          {(user.role === 'admin' || user.role === 'prowincjal') && (
            <TabsTrigger value="project-features">Postęp projektu</TabsTrigger>
          )}
        </TabsList>

          <TabsContent value="locations" className="space-y-4">
            <LocationsManagement />
          </TabsContent>

          <TabsContent value="accounts" className="space-y-4">
            <LocationAccountsManagement />
          </TabsContent>

          <TabsContent value="manage-accounts" className="space-y-4">
            <AccountsManagement />
          </TabsContent>

          <TabsContent value="account-restrictions" className="space-y-4">
            <AccountRestrictionsManagement />
          </TabsContent>

          {(user.role === 'admin' || user.role === 'prowincjal') && (
            <TabsContent value="users" className="space-y-4">
              <UsersManagement />
            </TabsContent>
          )}

        {(user.role === 'admin' || user.role === 'prowincjal') && (
          <TabsContent value="login-events" className="space-y-4">
            <LoginEventsManagement />
          </TabsContent>
        )}

        {user.role === 'admin' && (
          <TabsContent value="email-test" className="space-y-4">
            <EmailTestManagement />
          </TabsContent>
        )}

        {user.role === 'admin' && (
          <TabsContent value="database" className="space-y-4">
            <DatabaseManagement />
          </TabsContent>
        )}

        {(user.role === 'admin' || user.role === 'prowincjal') && (
          <TabsContent value="error-reports" className="space-y-4">
            <ErrorReportsManagement />
          </TabsContent>
        )}

        {(user.role === 'admin' || user.role === 'prowincjal') && (
          <TabsContent value="project-features" className="space-y-4">
            <ProjectFeaturesManagement />
          </TabsContent>
        )}
      </Tabs>
    </div>
  </MainLayout>
);
};

export default AdministrationPage;
