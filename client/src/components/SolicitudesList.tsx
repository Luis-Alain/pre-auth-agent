import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DescargarDocumentos } from "@/components/DescargarDocumentos";
import { LimpiarSolicitud } from "@/components/LimpiarSolicitud";

const ESTADO_COLOR: Record<string, string> = {
  "Pre Aprobada": "text-green-700 bg-green-100 border-green-300",
  "Rechazada": "text-red-700 bg-red-100 border-red-300",
  "Documentos Faltantes": "text-amber-700 bg-amber-100 border-amber-300",
  "En revision": "text-sky-700 bg-sky-100 border-sky-300",
};

const ESTADOS_FINALES = ["Pre Aprobada", "Rechazada", "Documentos Faltantes"];

type PasoProceso = "descarga" | "extracción" | "análisis" | "actualización en Notion";

const PROGRESO: Record<PasoProceso, { texto: string; porcentaje: number }> = {
  descarga: { texto: "Descargando documentos", porcentaje: 15 },
  extracción: { texto: "Extrayendo datos de los documentos", porcentaje: 40 },
  análisis: { texto: "Analizando la solicitud con IA", porcentaje: 70 },
  "actualización en Notion": { texto: "Guardando el resultado en Notion", porcentaje: 90 },
};

type Pestana = "pendientes" | "procesadas";

const PESTANAS: { valor: Pestana; titulo: string; vacio: string }[] = [
  { valor: "pendientes", titulo: "Pendientes", vacio: "No hay solicitudes pendientes." },
  { valor: "procesadas", titulo: "Procesadas", vacio: "No hay solicitudes procesadas." },
];

interface Solicitud {
  id: string;
  numero: number;
  titular: string;
  status: string | null;
  respuesta: string;
  informeMedico: { nombre: string; url: string }[];
  poliza: { nombre: string; url: string }[];
  createdTime: string;
  url: string;
}

type EventoProceso =
  | { paso: PasoProceso }
  | { resultado: { status: string; respuesta: string } }
  | { error: string };

async function leerJson(res: Response) {
  if (!res.headers.get("content-type")?.includes("application/json")) {
    throw new Error("El backend no respondio. Comprueba que el servidor esta en marcha.");
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Error HTTP ${res.status}`);
  return data;
}

async function* leerEventos(body: ReadableStream<Uint8Array>): AsyncGenerator<EventoProceso> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pendiente = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) {
      pendiente += decoder.decode();
      break;
    }
    pendiente += decoder.decode(value, { stream: true });
    const lineas = pendiente.split("\n");
    pendiente = lineas.pop() ?? "";
    for (const linea of lineas) {
      if (linea.trim()) yield JSON.parse(linea);
    }
  }
  if (pendiente.trim()) yield JSON.parse(pendiente);
}

const mensaje = (e: unknown) => (e instanceof Error ? e.message : String(e));

const esFinalizada = (s: Solicitud) => s.status !== null && ESTADOS_FINALES.includes(s.status);

interface SolicitudCardProps {
  solicitud: Solicitud;
  enCurso: boolean;
  hayProceso: boolean;
  progreso: { texto: string; porcentaje: number };
  error: string | undefined;
  onProcesar: (id: string) => void;
  onLimpiada: (id: string) => void;
  onErrorLimpiar: (id: string, mensaje: string) => void;
}

function SolicitudCard({
  solicitud: s,
  enCurso,
  hayProceso,
  progreso,
  error,
  onProcesar,
  onLimpiada,
  onErrorLimpiar,
}: SolicitudCardProps) {
  const finalizada = esFinalizada(s);
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          #{s.numero} · {s.titular || "Sin titular"}
        </CardTitle>
        <CardDescription>
          Creada el {new Date(s.createdTime).toLocaleString("es")} · {s.informeMedico.length} informe(s) medico(s)
          · {s.poliza.length} poliza(s)
        </CardDescription>
        <CardAction>
          <span
            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
              ESTADO_COLOR[s.status ?? ""] ?? "text-muted-foreground"
            }`}
          >
            {s.status ?? "Sin estado"}
          </span>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {s.respuesta && <p className="whitespace-pre-line text-sm">{s.respuesta}</p>}
        {enCurso && (
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{progreso.texto}...</span>
              <span>{progreso.porcentaje}%</span>
            </div>
            <div
              role="progressbar"
              aria-label="Progreso del proceso"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progreso.porcentaje}
              className="h-2 w-full overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full animate-pulse rounded-full bg-primary transition-[width] duration-700 ease-out"
                style={{ width: `${progreso.porcentaje}%` }}
              />
            </div>
          </div>
        )}
        {error && (
          <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          {!finalizada && (
            <Button onClick={() => onProcesar(s.id)} disabled={hayProceso}>
              {enCurso ? "Procesando..." : "Procesar solicitud"}
            </Button>
          )}
          {finalizada && (
            <LimpiarSolicitud
              solicitudId={s.id}
              disabled={hayProceso}
              onLimpiada={() => onLimpiada(s.id)}
              onError={(m) => onErrorLimpiar(s.id, m)}
            />
          )}
          <DescargarDocumentos solicitudId={s.id} informeMedico={s.informeMedico} poliza={s.poliza} />
        </div>
      </CardContent>
    </Card>
  );
}

export function SolicitudesList() {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [tablaUrl, setTablaUrl] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);
  const [paso, setPaso] = useState<PasoProceso | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [pestana, setPestana] = useState<Pestana>("pendientes");
  const bloqueado = useRef(false);
  const botonesPestana = useRef<Record<Pestana, HTMLButtonElement | null>>({ pendientes: null, procesadas: null });

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [data, tabla]: [Solicitud[], { url: string }] = await Promise.all([
        fetch("/api/solicitudes", { mode: "same-origin" }).then(leerJson),
        fetch("/api/solicitudes/tabla", { mode: "same-origin" }).then(leerJson),
      ]);
      setSolicitudes([...data].reverse());
      setTablaUrl(tabla.url);
    } catch (e) {
      setError(mensaje(e));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  function quitarError(id: string) {
    setErrores((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function marcarLimpiada(id: string) {
    setSolicitudes((prev) => prev.map((s) => (s.id === id ? { ...s, status: "En revision", respuesta: "" } : s)));
    quitarError(id);
  }

  async function procesar(id: string) {
    if (bloqueado.current) return;
    bloqueado.current = true;
    setProcesandoId(id);
    setPaso(null);
    quitarError(id);
    try {
      const res = await fetch(`/api/solicitudes/${id}/process`, { method: "POST", mode: "same-origin" });
      if (!res.ok) await leerJson(res);
      if (!res.body) throw new Error("El servidor no devolvio el progreso del proceso.");

      let terminado = false;
      for await (const evento of leerEventos(res.body)) {
        if ("paso" in evento) {
          setPaso(evento.paso);
        } else if ("error" in evento) {
          throw new Error(evento.error);
        } else {
          const { status, respuesta } = evento.resultado;
          setSolicitudes((prev) => prev.map((s) => (s.id === id ? { ...s, status, respuesta } : s)));
          setPestana("procesadas");
          terminado = true;
        }
      }
      if (!terminado) throw new Error("La conexion con el servidor se corto antes de terminar.");
    } catch (e) {
      setErrores((prev) => ({ ...prev, [id]: mensaje(e) }));
    } finally {
      bloqueado.current = false;
      setProcesandoId(null);
      setPaso(null);
    }
  }

  function moverPestana(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const siguiente = pestana === "pendientes" ? "procesadas" : "pendientes";
    setPestana(siguiente);
    botonesPestana.current[siguiente]?.focus();
  }

  const hayProceso = procesandoId !== null;
  const progreso = paso ? PROGRESO[paso] : { texto: "Iniciando proceso", porcentaje: 5 };
  const grupos: Record<Pestana, Solicitud[]> = {
    pendientes: solicitudes.filter((s) => !esFinalizada(s)),
    procesadas: solicitudes.filter(esFinalizada),
  };
  const visibles = grupos[pestana];
  const pestanaActiva = PESTANAS.find((p) => p.valor === pestana)!;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold">Solicitudes</h2>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {tablaUrl && (
            <a
              href={tablaUrl}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Ver en Notion
            </a>
          )}
          <Button variant="outline" size="sm" onClick={() => void cargar()} disabled={cargando || hayProceso}>
            {cargando ? "Cargando..." : "Actualizar"}
          </Button>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Estado de las solicitudes"
        onKeyDown={moverPestana}
        className="flex w-fit gap-1 rounded-lg bg-muted p-1"
      >
        {PESTANAS.map(({ valor, titulo }) => {
          const activa = pestana === valor;
          return (
            <button
              key={valor}
              ref={(el) => {
                botonesPestana.current[valor] = el;
              }}
              type="button"
              role="tab"
              id={`pestana-${valor}`}
              aria-selected={activa}
              aria-controls={`panel-${valor}`}
              tabIndex={activa ? 0 : -1}
              onClick={() => setPestana(valor)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                activa ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {titulo} ({grupos[valor].length})
            </button>
          );
        })}
      </div>

      {error && (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div
        role="tabpanel"
        id={`panel-${pestana}`}
        aria-labelledby={`pestana-${pestana}`}
        className="flex flex-col gap-4"
      >
        {!cargando && !error && visibles.length === 0 && (
          <p className="text-sm text-muted-foreground">{pestanaActiva.vacio}</p>
        )}

        {visibles.map((s) => (
          <SolicitudCard
            key={s.id}
            solicitud={s}
            enCurso={procesandoId === s.id}
            hayProceso={hayProceso}
            progreso={progreso}
            error={errores[s.id]}
            onProcesar={(id) => void procesar(id)}
            onLimpiada={marcarLimpiada}
            onErrorLimpiar={(id, m) => setErrores((prev) => ({ ...prev, [id]: m }))}
          />
        ))}
      </div>
    </div>
  );
}
