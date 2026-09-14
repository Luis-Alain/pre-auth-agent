import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CINCO_MINUTOS_MS = 5 * 60 * 1000;
const MODO_MANUAL = "manual";

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

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binario = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binario);
}

export function SimulationForm() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [modo, setModo] = useState<string>("");
  const [titularManual, setTitularManual] = useState("");
  const [informeFile, setInformeFile] = useState<File | null>(null);
  const [polizaFile, setPolizaFile] = useState<File | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/simulacion/casos", { mode: "same-origin" })
      .then((r) => r.json())
      .then((data: Scenario[]) => {
        setScenarios(data);
        if (data[0]) setModo(data[0].id);
      })
      .catch(() => {});
  }, []);

  const esManual = modo === MODO_MANUAL;
  const scenario = scenarios.find((s) => s.id === modo);

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

      let res: Response;
      if (esManual) {
        if (!titularManual.trim()) throw new Error("Escribe el nombre del titular.");
        if (!informeFile || !polizaFile) throw new Error("Adjunta el informe medico y la poliza.");
        res = await fetch("/api/simulacion/manual", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            titular: titularManual,
            informe: { nombre: informeFile.name, contenido: await fileToBase64(informeFile) },
            poliza: { nombre: polizaFile.name, contenido: await fileToBase64(polizaFile) },
          }),
        });
      } else {
        res = await fetch("/api/simulacion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scenario: modo }),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al procesar la simulacion.");
      setResultado({ status: data.status, respuesta: data.respuesta, url: data.solicitud.url });
    } catch (e) {
      if (e instanceof Error) setError(e.message);
      else setError(String(e));
    } finally {
      setProcesando(false);
    }
  }, [informeFile, limpiar, modo, esManual, polizaFile, titularManual]);

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
          Elige un caso de ejemplo o sube tus propios documentos (opcional). El sistema crea la fila en Notion, extrae
          los datos, los analiza con IA y muestra el resultado.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label>Caso</Label>
          <Select value={modo} onValueChange={setModo}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un caso" />
            </SelectTrigger>
            <SelectContent>
              {scenarios.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.titular} &mdash; {s.descripcion}
                </SelectItem>
              ))}
              <SelectItem value={MODO_MANUAL}>Cargar documentos propios (manual)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {!esManual && scenario && (
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

        {esManual && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Opcional, por si acaso: adjunta tus propios PDFs. Sujeto al limite anti-spam de 2 procesamientos cada 5 minutos.
            </p>
            <div className="flex flex-col gap-2">
              <Label htmlFor="titular-manual">Titular (paciente)</Label>
              <Input id="titular-manual" value={titularManual} onChange={(e) => setTitularManual(e.target.value)} placeholder="Nombre del paciente" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="informe-manual">Informe medico (PDF)</Label>
              <Input id="informe-manual" type="file" accept="application/pdf" onChange={(e) => setInformeFile(e.target.files?.[0] ?? null)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="poliza-manual">Poliza (PDF)</Label>
              <Input id="poliza-manual" type="file" accept="application/pdf" onChange={(e) => setPolizaFile(e.target.files?.[0] ?? null)} />
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={cargar} disabled={procesando || !modo}>
            {procesando ? "Procesando (esto tarda unos segundos)..." : "Procesar solicitud"}
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