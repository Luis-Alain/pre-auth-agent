import { buttonVariants } from "@/components/ui/button";

interface Documento {
  nombre: string;
}

interface DescargarDocumentosProps {
  solicitudId: string;
  informeMedico: Documento[];
  poliza: Documento[];
}

export function DescargarDocumentos({ solicitudId, informeMedico, poliza }: DescargarDocumentosProps) {
  const grupos = [
    { tipo: "informe-medico", etiqueta: "Informe médico", documentos: informeMedico },
    { tipo: "poliza", etiqueta: "Póliza", documentos: poliza },
  ];

  if (informeMedico.length === 0 && poliza.length === 0) return null;

  return (
    <>
      {grupos.flatMap(({ tipo, etiqueta, documentos }) =>
        documentos.map((documento, i) => (
          <a
            key={`${tipo}-${i}`}
            href={`/api/solicitudes/${encodeURIComponent(solicitudId)}/documentos/${tipo}/${i}`}
            download
            title={documento.nombre}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {i === 0 ? etiqueta : `${etiqueta} ${i + 1}`}
          </a>
        )),
      )}
    </>
  );
}
