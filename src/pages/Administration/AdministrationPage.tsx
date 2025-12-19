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
import ProjectFeaturesManagement from './ProjectFeaturesManagement';
import RemindersManagement from './RemindersManagement';
import SecuritySettingsManagement from './SecuritySettingsManagement';

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
    <MainLayout fullWidth>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-omi-900">Administracja</h1>
          <p className="text-omi-gray-600">
            Zarządzanie systemem finansowym domów zakonnych OMI
          </p>
        </div>

      <Tabs defaultValue="locations" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1 p-1 justify-start">
          <TabsTrigger value="locations" className="flex-shrink-0">Placówki</TabsTrigger>
          <TabsTrigger value="accounts" className="flex-shrink-0">Konta placówek</TabsTrigger>
          <TabsTrigger value="manage-accounts" className="flex-shrink-0">Zarządzanie kontami</TabsTrigger>
          <TabsTrigger value="account-restrictions" className="flex-shrink-0">Ograniczenia kont</TabsTrigger>
          {(user.role === 'admin' || user.role === 'prowincjal') && (
            <TabsTrigger value="users" className="flex-shrink-0">Użytkownicy</TabsTrigger>
          )}
          {(user.role === 'admin' || user.role === 'prowincjal') && (
            <TabsTrigger value="login-events" className="flex-shrink-0">Logowania</TabsTrigger>
          )}
          {(user.role === 'admin' || user.role === 'prowincjal') && (
            <TabsTrigger value="security" className="flex-shrink-0">Bezpieczeństwo</TabsTrigger>
          )}
          {user.role === 'admin' && (
            <TabsTrigger value="database" className="flex-shrink-0">Baza danych</TabsTrigger>
          )}
          {(user.role === 'admin' || user.role === 'prowincjal') && (
            <TabsTrigger value="reminders" className="flex-shrink-0">Przypomnienia</TabsTrigger>
          )}
          {(user.role === 'admin' || user.role === 'prowincjal') && (
            <TabsTrigger value="error-reports" className="flex-shrink-0">Zgłoszenia błędów</TabsTrigger>
          )}
          {(user.role === 'admin' || user.role === 'prowincjal') && (
            <TabsTrigger value="project-features" className="flex-shrink-0">Postęp projektu</TabsTrigger>
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

        {(user.role === 'admin' || user.role === 'prowincjal') && (
          <TabsContent value="security" className="space-y-4">
            <SecuritySettingsManagement />
          </TabsContent>
        )}

        {user.role === 'admin' && (
          <TabsContent value="database" className="space-y-4">
            <DatabaseManagement />
          </TabsContent>
        )}

        {(user.role === 'admin' || user.role === 'prowincjal') && (
          <TabsContent value="reminders" className="space-y-4">
            <RemindersManagement />
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
