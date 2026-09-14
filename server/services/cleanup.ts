import { ESTADOS_FINALES } from "../schemas/analysis";

export function puedeLimpiar(
  solicitud: { status: string | null; lastEditedTime: string },
  soloExpiradas: boolean,
  ahora = Date.now(),
): boolean {
  return (ESTADOS_FINALES as readonly (string | null)[]).includes(solicitud.status) &&
    (!soloExpiradas || ahora - Date.parse(solicitud.lastEditedTime) >= 5 * 60_000);
}
