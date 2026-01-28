"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, RefreshCw } from "lucide-react";

type TestResult = {
  success: boolean;
  config?: {
    username: string;
    apiUrl: string;
    companyProgramId: string;
    apiTokenLength: number;
    apiTokenFirst4: string;
  };
  tests?: {
    network: {
      success: boolean;
      error: string;
    };
    api: {
      success: boolean;
      response: string;
      error: string;
    };
  };
  recommendations?: string[];
  error?: string;
  missing?: string[];
  message?: string;
};

export default function SaldeoTestPage() {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const runTest = async () => {
    setTesting(true);
    setResult(null);

    try {
      const response = await fetch("/api/saldeo/test-connection");
      const data = await response.json();
      setResult(data);
    } catch (err) {
      setResult({
        success: false,
        error: err instanceof Error ? err.message : "Nieznany błąd",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Test połączenia Saldeo API</h1>
        <p className="text-muted-foreground">
          Narzędzie diagnostyczne do sprawdzania konfiguracji i połączenia z Saldeo
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Diagnostyka</CardTitle>
          <CardDescription>
            Kliknij przycisk, aby przetestować połączenie z Saldeo API
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={runTest} disabled={testing}>
            {testing ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Testowanie...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Uruchom test
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <>
          {/* Status główny */}
          <Alert variant={result.success ? "default" : "destructive"}>
            {result.success ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertTitle>
              {result.success ? "✅ Połączenie działa!" : "❌ Problem z połączeniem"}
            </AlertTitle>
            <AlertDescription>
              {result.success
                ? "Konfiguracja Saldeo API jest poprawna i działa."
                : result.message || result.error || "Sprawdź szczegóły poniżej"}
            </AlertDescription>
          </Alert>

          {/* Brakująca konfiguracja */}
          {result.missing && result.missing.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-red-600">Brakująca konfiguracja</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-2">Następujące zmienne środowiskowe nie są ustawione:</p>
                <ul className="list-disc list-inside space-y-1">
                  {result.missing.map((item) => (
                    <li key={item} className="font-mono text-sm">
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-sm text-muted-foreground">
                  Dodaj te zmienne do pliku <code>.env.local</code>
                </p>
              </CardContent>
            </Card>
          )}

          {/* Konfiguracja */}
          {result.config && (
            <Card>
              <CardHeader>
                <CardTitle>Konfiguracja</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="font-medium">Username:</div>
                  <div className="font-mono">{result.config.username}</div>

                  <div className="font-medium">API URL:</div>
                  <div className="font-mono break-all">{result.config.apiUrl}</div>

                  <div className="font-medium">Company ID:</div>
                  <div className="font-mono">{result.config.companyProgramId}</div>

                  <div className="font-medium">API Token:</div>
                  <div className="font-mono">
                    {result.config.apiTokenFirst4} ({result.config.apiTokenLength} znaków)
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Testy */}
          {result.tests && (
            <Card>
              <CardHeader>
                <CardTitle>Wyniki testów</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Test sieci */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium">Test połączenia sieciowego</h3>
                    <Badge variant={result.tests.network.success ? "default" : "destructive"}>
                      {result.tests.network.success ? "Sukces" : "Błąd"}
                    </Badge>
                  </div>
                  {result.tests.network.error && (
                    <p className="text-sm text-red-600">{result.tests.network.error}</p>
                  )}
                </div>

                {/* Test API */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium">Test API Saldeo</h3>
                    <Badge variant={result.tests.api.success ? "default" : "destructive"}>
                      {result.tests.api.success ? "Sukces" : "Błąd"}
                    </Badge>
                  </div>
                  {result.tests.api.error && (
                    <p className="text-sm text-red-600 mb-2">{result.tests.api.error}</p>
                  )}
                  {result.tests.api.response && (
                    <details className="text-sm">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        Pokaż odpowiedź API
                      </summary>
                      <pre className="mt-2 p-3 bg-muted rounded-lg overflow-x-auto text-xs">
                        {result.tests.api.response}
                      </pre>
                    </details>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Rekomendacje */}
          {result.recommendations && result.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Rekomendacje</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {result.recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-lg">{rec.split(" ")[0]}</span>
                      <span className="text-sm">{rec.substring(rec.indexOf(" ") + 1)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Pomoc */}
          <Card>
            <CardHeader>
              <CardTitle>Najczęstsze problemy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-1">
                  🔴 "fetch failed" lub "Network error"
                </h4>
                <p className="text-sm text-muted-foreground">
                  Sprawdź <code>SALDEO_API_URL</code> w pliku .env.local:
                </p>
                <ul className="list-disc list-inside text-sm text-muted-foreground ml-4 mt-1">
                  <li>
                    Testowe: <code>https://api-test.saldeosmart.pl</code>
                  </li>
                  <li>
                    Produkcyjne: <code>https://api.saldeosmart.pl</code>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium mb-1">
                  🔴 "User does not exist" (kod 4302)
                </h4>
                <p className="text-sm text-muted-foreground">
                  Dane logowania są nieprawidłowe lub używasz złego środowiska:
                </p>
                <ul className="list-disc list-inside text-sm text-muted-foreground ml-4 mt-1">
                  <li>Sprawdź czy username i token są poprawne</li>
                  <li>Upewnij się, że używasz właściwego URL (test vs produkcja)</li>
                  <li>Zweryfikuj COMPANY_PROGRAM_ID</li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium mb-1">✅ Jak powinno wyglądać?</h4>
                <p className="text-sm text-muted-foreground">
                  Przykładowa konfiguracja w <code>.env.local</code>:
                </p>
                <pre className="mt-2 p-3 bg-muted rounded-lg text-xs overflow-x-auto">
{`SALDEO_USERNAME=twoj-login
SALDEO_API_TOKEN=twoj-token-api
SALDEO_COMPANY_PROGRAM_ID=TWOJA_FIRMA_ID
SALDEO_API_URL=https://api-test.saldeosmart.pl`}
                </pre>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
