import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface LimpiarSolicitudProps {
  solicitudId: string;
  disabled?: boolean;
  onLimpiada: () => void;
  onError: (mensaje: string) => void;
}

export function LimpiarSolicitud({
  solicitudId,
  disabled,
  onLimpiada,
  onError,
}: LimpiarSolicitudProps) {
  const [limpiando, setLimpiando] = useState(false);
  const enCurso = useRef(false);

  const limpiar = async () => {
    if (enCurso.current) return;
    enCurso.current = true;
    setLimpiando(true);
    try {
      const res = await fetch(`/api/solicitudes/${solicitudId}/limpiar`, {
        method: "POST",
        mode: "same-origin",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
          data?.error ??
            `No se pudo limpiar la solicitud (HTTP ${res.status}).`,
        );
      }
      onLimpiada();
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : "No se pudo limpiar la solicitud.",
      );
    } finally {
      enCurso.current = false;
      setLimpiando(false);
    }
  };

  return (
    <Button disabled={disabled || limpiando} onClick={limpiar}>
      {limpiando ? "Limpiando..." : "Limpiar"}
    </Button>
  );
}
