import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TITULAR_MUESTRA = "Jose Manuel Camarena Castano";
const INFORME_MUESTRA = { nombre: "informe_medico_jose_camarena.pdf", url: "/api/simulacion/archivos/informe-medico.pdf" };
const POLIZA_MUESTRA = { nombre: "poliza_jose_camarena.pdf", url: "/api/simulacion/archivos/poliza.pdf" };
const CINCO_MINUTOS_MS = 5 * 60 * 1000;

const ESTADO_COLOR: Record<string, string> = {
  "Pre Aprobada": "text-green-700 bg-green-100 border-green-300",
  "Rechazada": "text-red-700 bg-red-100 border-red-300",
  "Documentos Faltantes": "text-amber-700 bg-amber-100 border-amber-300",
  "En revision": "text-sky-700 bg-sky-100 border-sky-300",
};

interface Resultado {
  status: string;
  respuesta: string;
  url: string;
}

export function SimulationForm() {
  const [titular, setTitular] = useState(TITULAR_MUESTRA);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        body: JSON.stringify({ titular }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al procesar la simulacion.");
      setResultado({
        status: data.status,
        respuesta: data.respuesta,
        url: data.solicitud.url,
      });
    } catch (e) {
      if (e instanceof Error) setError(e.message);
      else setError(String(e));
    } finally {
      setProcesando(false);
    }
  }, [limpiar, titular]);

  useEffect(() => {
    if (!resultado) return;
    const timer = setTimeout(() => {
      void limpiar();
    }, CINCO_MINUTOS_MS);
    return () => clearTimeout(timer);
  }, [resultado, limpiar]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Simulacion de solicitud</CardTitle>
        <CardDescription>
          Prototipo: los archivos de muestra estan precargados. El sistema crea la fila en Notion, extrae los datos,
          los analiza con IA y muestra el resultado.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="titular">Titular (paciente)</Label>
          <Input id="titular" value={titular} onChange={(e) => setTitular(e.target.value)} />
        </div>

        <div className="flex flex-col gap-2">
          <Label>Documentos (PDF de muestra precargados)</Label>
          <div className="flex flex-col gap-2">
            {[INFORME_MUESTRA, POLIZA_MUESTRA].map((archivo) => (
              <div key={archivo.nombre} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <span className="font-mono">{archivo.nombre}</span>
                <span className="text-xs text-muted-foreground">(muestra)</span>
                <a href={archivo.url} target="_blank" rel="noreferrer" className="ml-auto text-blue-600 hover:underline">
                  ver PDF
                </a>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={cargar} disabled={procesando}>
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