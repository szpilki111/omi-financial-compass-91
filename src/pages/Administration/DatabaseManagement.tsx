import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Download, Upload, Database, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const DatabaseManagement = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();

  const handleExportDatabase = async () => {
    setIsExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('export-database', {
        body: {}
      });

      if (error) throw error;

      // Create and download the backup file
      const blob = new Blob([JSON.stringify(data, null, 2)], { 
        type: 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `database-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Sukces",
        description: "Kopia zapasowa bazy danych została utworzona i pobrana."
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Błąd",
        description: "Nie udało się utworzyć kopii zapasowej bazy danych.",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setSelectedFile(file || null);
  };

  const handleImportDatabase = async () => {
    if (!selectedFile) {
      toast({
        title: "Błąd",
        description: "Proszę wybrać plik kopii zapasowej.",
        variant: "destructive"
      });
      return;
    }

    setIsImporting(true);
    try {
      const fileContent = await selectedFile.text();
      let backupData;
      
      try {
        backupData = JSON.parse(fileContent);
      } catch (parseError) {
        throw new Error('Nieprawidłowy format pliku JSON. Plik może być uszkodzony.');
      }

      // Validate backup data structure
      if (!backupData || typeof backupData !== 'object') {
        throw new Error('Nieprawidłowy format danych kopii zapasowej.');
      }
      
      if (!backupData.tables || !Array.isArray(backupData.tables)) {
        throw new Error('Plik kopii zapasowej nie zawiera poprawnych danych tabel.');
      }

      if (backupData.tables.length === 0) {
        throw new Error('Plik kopii zapasowej jest pusty - brak danych do przywrócenia.');
      }

      console.log('Backup validation successful:', {
        timestamp: backupData.timestamp,
        tablesCount: backupData.tables.length,
        totalRecords: backupData.metadata?.totalRecords || 'unknown'
      });

      const { data, error } = await supabase.functions.invoke('import-database', {
        body: { backupData }
      });

      if (error) throw error;

      toast({
        title: "Sukces",
        description: "Baza danych została przywrócona z kopii zapasowej."
      });
      
      // Clear the selected file
      setSelectedFile(null);
      const input = document.getElementById('backup-file') as HTMLInputElement;
      if (input) input.value = '';
      
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: "Błąd",
        description: "Nie udało się przywrócić bazy danych z kopii zapasowej.",
        variant: "destructive"
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-omi-900 mb-2">Zarządzanie bazą danych</h2>
        <p className="text-omi-gray-600">
          Tworzenie i przywracanie kopii zapasowych bazy danych
        </p>
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Uwaga:</strong> Operacje na bazie danych są nieodwracalne. 
          Zaleca się regularne tworzenie kopii zapasowych i ostrożne przywracanie danych.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Export Database */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Eksport bazy danych
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-omi-gray-600">
              Utwórz kopię zapasową wszystkich danych z bazy danych. 
              Plik zostanie pobrany w formacie JSON.
            </p>
            <Button
              onClick={handleExportDatabase}
              disabled={isExporting}
              className="w-full"
            >
              <Database className="h-4 w-4 mr-2" />
              {isExporting ? 'Eksportowanie...' : 'Utwórz kopię zapasową'}
            </Button>
          </CardContent>
        </Card>

        {/* Import Database */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Import bazy danych
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-omi-gray-600">
              Przywróć bazę danych z wcześniej utworzonej kopii zapasowej. 
              <strong> Uwaga: To nadpisze wszystkie obecne dane!</strong>
            </p>
            <div className="space-y-2">
              <Label htmlFor="backup-file">Wybierz plik kopii zapasowej:</Label>
              <Input
                id="backup-file"
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                disabled={isImporting}
              />
            </div>
            <Button
              onClick={handleImportDatabase}
              disabled={isImporting || !selectedFile}
              variant="destructive"
              className="w-full"
            >
              <Upload className="h-4 w-4 mr-2" />
              {isImporting ? 'Importowanie...' : 'Przywróć z kopii zapasowej'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DatabaseManagement;