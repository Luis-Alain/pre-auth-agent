import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CINCO_MINUTOS_MS = 5 * 60 * 1000;

const ESTADO_COLOR: Record<string, string> = {
  "Pre Aprobada": "text-green-700 bg-green-100 border-green-300",
  "Rechazada": "text-red-700 bg-red-100 border-red-300",
  "Documentos Faltantes": "text-amber-700 bg-amber-100 border-amber-300",
  "En revision": "text-sky-700 bg-sky-100 border-sky-300",
};

interface Scenario {
  id: string;
  titular: string;
  descripcion: string;
  archivos: { nombre: string; archivo: string }[];
}

interface Resultado {
  status: string;
  respuesta: string;
  url: string;
}

export function SimulationForm() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [scenarioId, setScenarioId] = useState<string>("");
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/simulacion/casos", { mode: "same-origin" })
      .then((r) => r.json())
      .then((data: Scenario[]) => { setScenarios(data); if (data[0]) setScenarioId(data[0].id); })
      .catch(() => {});
  }, []);

  const scenario = scenarios.find((s) => s.id === scenarioId);

  const limpiar = useCallback(async () => {
    setResultado(null);
    setError(null);
    await fetch("/api/simulacion", { method: "DELETE", mode: "same-origin" });
  }, []);

  const cargar = useCallback(async () => {
    setProcesando(true);
    setError(null);
    setResultado(null);
    try {
      await limpiar();
      const res = await fetch("/api/simulacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario: scenarioId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al procesar la simulacion.");
      setResultado({ status: data.status, respuesta: data.respuesta, url: data.solicitud.url });
    } catch (e) {
      if (e instanceof Error) setError(e.message);
      else setError(String(e));
    } finally {
      setProcesando(false);
    }
  }, [limpiar, scenarioId]);

  useEffect(() => {
    if (!resultado) return;
    const timer = setTimeout(() => { void limpiar(); }, CINCO_MINUTOS_MS);
    return () => clearTimeout(timer);
  }, [resultado, limpiar]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Simulacion de solicitud</CardTitle>
        <CardDescription>
          Selecciona un caso de ejemplo. El sistema crea la fila en Notion, extrae los datos, los analiza con IA y muestra el resultado.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label>Caso de simulacion</Label>
          <Select value={scenarioId} onValueChange={setScenarioId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un caso" />
            </SelectTrigger>
            <SelectContent>
              {scenarios.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.titular} &mdash; {s.descripcion}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {scenario && (
          <div className="flex flex-col gap-2">
            <Label>Documentos (PDF de muestra)</Label>
            <div className="flex flex-col gap-2">
              {scenario.archivos.map((archivo) => (
                <div key={archivo.nombre} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <span className="font-mono">{archivo.nombre}</span>
                  <a
                    href={`/api/simulacion/archivos/${archivo.archivo}`}
                    download
                    className="ml-auto text-blue-600 hover:underline"
                  >
                    descargar PDF
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={cargar} disabled={procesando || !scenarioId}>
            {procesando ? "Procesando (esto tarda unos segundos)..." : "Procesar simulacion"}
          </Button>
          <Button variant="outline" onClick={() => void limpiar()} disabled={procesando}>
            Limpiar
          </Button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {resultado && (
          <div className="flex flex-col gap-2 rounded-md border p-4">
            <span className={`inline-flex w-fit rounded-full border px-3 py-1 text-sm font-semibold ${ESTADO_COLOR[resultado.status] ?? ""}`}>
              {resultado.status}
            </span>
            <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 font-mono text-xs leading-relaxed">
              {resultado.respuesta}
            </pre>
            <a href={resultado.url} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">
              Ver fila en Notion
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
