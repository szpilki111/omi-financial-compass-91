
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { verifyPhase1Implementation, quickPhase1Test } from '@/utils/phase1Verification';
import { Play, CheckCircle, XCircle, Loader2 } from 'lucide-react';

const Phase1TestPanel: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);

  const runFullVerification = async () => {
    setIsRunning(true);
    setTestResults(null);

    try {
      const results = await verifyPhase1Implementation(user?.location);
      setTestResults(results);
      
      toast({
        title: results.success ? "Weryfikacja zakończona pomyślnie" : "Wykryto problemy",
        description: results.summary,
        variant: results.success ? "default" : "destructive",
      });
    } catch (error) {
      console.error('Błąd weryfikacji:', error);
      toast({
        title: "Błąd weryfikacji",
        description: "Wystąpił błąd podczas weryfikacji Fazy 1",
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const runQuickTest = async () => {
    setIsRunning(true);
    
    try {
      const success = await quickPhase1Test();
      toast({
        title: success ? "Szybki test OK" : "Szybki test błąd",
        description: success ? "Podstawowe funkcje działają" : "Wykryto problemy",
        variant: success ? "default" : "destructive",
      });
    } catch (error) {
      toast({
        title: "Błąd testu",
        description: "Wystąpił błąd podczas szybkiego testu",
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: boolean) => {
    return status ? (
      <CheckCircle className="h-4 w-4 text-green-600" />
    ) : (
      <XCircle className="h-4 w-4 text-red-600" />
    );
  };

  const getStatusBadge = (status: boolean) => {
    return (
      <Badge variant={status ? "default" : "destructive"}>
        {status ? "PASS" : "FAIL"}
      </Badge>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="h-5 w-5" />
          Panel Testowy Fazy 1
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={runFullVerification}
            disabled={isRunning}
            className="flex items-center gap-2"
          >
            {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Pełna weryfikacja
          </Button>
          
          <Button 
            variant="outline"
            onClick={runQuickTest}
            disabled={isRunning}
            className="flex items-center gap-2"
          >
            {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Szybki test
          </Button>
        </div>

        {testResults && (
          <div className="space-y-4 mt-6">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold">Wynik ogólny:</h3>
              <div className="flex items-center gap-2">
                {getStatusIcon(testResults.success)}
                {getStatusBadge(testResults.success)}
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Szczegóły testów:</h4>
              
              <div className="space-y-1">
                <div className="flex items-center justify-between p-2 bg-white border rounded">
                  <span className="text-sm">Zmiana terminologii (Bilans → Saldo)</span>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(testResults.results.terminologyCheck)}
                    {getStatusBadge(testResults.results.terminologyCheck)}
                  </div>
                </div>

                <div className="flex items-center justify-between p-2 bg-white border rounded">
                  <span className="text-sm">Obsługa typów kont w imporcie CSV</span>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(testResults.results.accountTypeHandling)}
                    {getStatusBadge(testResults.results.accountTypeHandling)}
                  </div>
                </div>

                <div className="flex items-center justify-between p-2 bg-white border rounded">
                  <span className="text-sm">Obliczenia salda początkowego</span>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(testResults.results.openingBalanceCalculation)}
                    {getStatusBadge(testResults.results.openingBalanceCalculation)}
                  </div>
                </div>

                <div className="flex items-center justify-between p-2 bg-white border rounded">
                  <span className="text-sm">Integracja komponentu podsumowania</span>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(testResults.results.summaryIntegration)}
                    {getStatusBadge(testResults.results.summaryIntegration)}
                  </div>
                </div>

                <div className="flex items-center justify-between p-2 bg-white border rounded">
                  <span className="text-sm">Design responsywny</span>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(testResults.results.responsiveDesign)}
                    {getStatusBadge(testResults.results.responsiveDesign)}
                  </div>
                </div>
              </div>
            </div>

            {testResults.results.errors.length > 0 && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <h4 className="font-medium text-red-800 mb-2">Wykryte błędy:</h4>
                <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                  {testResults.results.errors.map((error: string, index: number) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-800 mb-2">Instrukcje testowania:</h4>
          <ol className="list-decimal list-inside text-sm text-blue-700 space-y-1">
            <li>Użyj "Szybki test" aby sprawdzić podstawowe funkcje</li>
            <li>Uruchom "Pełna weryfikacja" aby przetestować wszystkie elementy Fazy 1</li>
            <li>Sprawdź konsolę przeglądarki dla szczegółowych logów</li>
            <li>Sprawdź responsywność na różnych urządzeniach</li>
            <li>Przetestuj import CSV z różnymi typami kont</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
};

export default Phase1TestPanel;
