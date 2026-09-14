export type UUID = string;
export type ISODateString = string;

export interface RichTextAnnotations {
  bold: boolean;
  italic: boolean;
  strikethrough: boolean;
  underline: boolean;
  code: boolean;
}

export interface RichTextItem {
  type: "text" | "mention" | "equation";
  text?: {
    content: string;
    link: { url: string } | null;
  };
  annotations: RichTextAnnotations;
  plain_text: string;
  href: string | null;
}

export interface NotionUserRef {
  object: "user";
  id: UUID;
}

export type NotionFileObject =
  | {
      name: string;
      type: "file";
      file: {
        url: string;
        expiry_time: ISODateString;
      };
    }
  | {
      name: string;
      type: "external";
      external: {
        url: string;
      };
    };

export interface NotionEmojiIcon {
  type: "emoji";
  emoji: string;
}
export interface NotionExternalIcon {
  type: "external";
  external: { url: string };
}
export interface NotionFileIcon {
  type: "file";
  file: { url: string; expiry_time: ISODateString };
}
export type NotionIcon =
  | NotionEmojiIcon
  | NotionExternalIcon
  | NotionFileIcon
  | null;

export interface NotionCover {
  type: "external" | "file";
  external?: { url: string };
  file?: { url: string; expiry_time: ISODateString };
}

export type NotionParent =
  | { type: "database_id"; database_id: UUID }
  | { type: "data_source_id"; data_source_id: UUID; database_id: UUID }
  | { type: "page_id"; page_id: UUID }
  | { type: "workspace"; workspace: true };

export interface TitlePropertyValue {
  id: string;
  type: "title";
  title: RichTextItem[];
}

export interface RichTextPropertyValue {
  id: string;
  type: "rich_text";
  rich_text: RichTextItem[];
}

export interface FilesPropertyValue {
  id: string;
  type: "files";
  files: NotionFileObject[];
}

export interface StatusOption {
  id: string;
  name: string;
  description?: string | null;
}

export interface StatusPropertyValue {
  id: string;
  type: "status";
  status: StatusOption | null;
}

export interface TitlePropertySchema {
  id: string;
  name: "Titular";
  type: "title";
  title: Record<string, never>;
}

export interface FilesPropertySchema {
  id: string;
  name: "Informe Medico" | "Póliza";
  type: "files";
  files: Record<string, never>;
}

export interface StatusPropertySchemaGroup {
  id: string;
  name: string;
  option_ids: string[];
}

export interface StatusPropertySchema {
  id: string;
  name: "Status";
  type: "status";
  status: {
    options: StatusOption[];
    groups: StatusPropertySchemaGroup[];
  };
}

export interface RichTextPropertySchema {
  id: string;
  name: "Respuesta";
  type: "rich_text";
  rich_text: Record<string, never>;
}

export interface SolicitudPreAutorizacionSchema {
  Titular: TitlePropertySchema;
  "Informe Medico": FilesPropertySchema;
  Póliza: FilesPropertySchema;
  Status: StatusPropertySchema;
  Respuesta: RichTextPropertySchema;
}

export interface SolicitudPreAutorizacionDataSource {
  object: "data_source" | "database";
  id: UUID;
  created_time: ISODateString;
  last_edited_time: ISODateString;
  title: RichTextItem[];
  description: RichTextItem[];
  icon: NotionIcon;
  cover: NotionCover | null;
  parent: NotionParent;
  properties: SolicitudPreAutorizacionSchema;
  is_inline?: boolean;
  in_trash: boolean;
  is_locked?: boolean;
  url?: string;
  public_url?: string | null;
  data_sources?: { id: UUID; name: string }[];
}

export interface SolicitudPreAutorizacionProperties {
  Titular: TitlePropertyValue;
  "Informe Medico": FilesPropertyValue;
  Póliza: FilesPropertyValue;
  Status: StatusPropertyValue;
  Respuesta: RichTextPropertyValue;
}

export interface SolicitudPreAutorizacionPage {
  object: "page";
  id: UUID;
  created_time: ISODateString;
  last_edited_time: ISODateString;
  created_by: NotionUserRef;
  last_edited_by: NotionUserRef;
  in_trash: boolean;
  is_archived: boolean;
  is_locked: boolean;
  icon: NotionIcon;
  cover: NotionCover | null;
  url: string;
  public_url: string | null;
  parent: Extract<NotionParent, { type: "data_source_id" }>;
  properties: SolicitudPreAutorizacionProperties;
}

export type SolicitudPreAutorizacionPropertyName =
  keyof SolicitudPreAutorizacionProperties;

export type SolicitudPreAutorizacionFilter =
  | {
      property: "Titular";
      title:
        | { equals: string }
        | { contains: string }
        | { does_not_equal: string }
        | { does_not_contain: string }
        | { starts_with: string }
        | { ends_with: string }
        | { is_empty: true }
        | { is_not_empty: true };
    }
  | {
      property: "Respuesta";
      rich_text:
        | { equals: string }
        | { contains: string }
        | { does_not_equal: string }
        | { does_not_contain: string }
        | { starts_with: string }
        | { ends_with: string }
        | { is_empty: true }
        | { is_not_empty: true };
    }
  | {
      property: "Informe Medico" | "Póliza";
      files: { is_empty: true } | { is_not_empty: true };
    }
  | {
      property: "Status";
      status:
        | { equals: string }
        | { does_not_equal: string }
        | { is_empty: true }
        | { is_not_empty: true };
    }
  | { and: SolicitudPreAutorizacionFilter[] }
  | { or: SolicitudPreAutorizacionFilter[] };

export interface SolicitudPreAutorizacionSort {
  property?: SolicitudPreAutorizacionPropertyName;
  timestamp?: "created_time" | "last_edited_time";
  direction: "ascending" | "descending";
}

export interface QueryDataSourceRequest {
  filter?: SolicitudPreAutorizacionFilter;
  sorts?: SolicitudPreAutorizacionSort[];
  start_cursor?: string;
  page_size?: number;
}

export interface QueryDataSourceResponse {
  object: "list";
  type: "page_or_data_source";
  results: SolicitudPreAutorizacionPage[];
  next_cursor: string | null;
  has_more: boolean;
  request_status?: { type: "complete" | "in_progress" };
}

export interface SolicitudPreAutorizacionRecord {
  id: UUID;
  titular: string;
  informeMedico: { nombre: string; url: string }[];
  poliza: { nombre: string; url: string }[];
  status: string | null;
  respuesta: string;
  createdTime: ISODateString;
  lastEditedTime: ISODateString;
  url: string;
}

function fileUrl(file: NotionFileObject): string {
  return file.type === "file" ? file.file.url : file.external.url;
}

function plainText(richText: RichTextItem[]): string {
  return richText.map((item) => item.plain_text).join("");
}

export function toSolicitudPreAutorizacionRecord(
  page: SolicitudPreAutorizacionPage,
): SolicitudPreAutorizacionRecord {
  const props = page.properties;

  return {
    id: page.id,
    titular: plainText(props.Titular.title),
    informeMedico: props["Informe Medico"].files.map((f) => ({
      nombre: f.name,
      url: fileUrl(f),
    })),
    poliza: props.Póliza.files.map((f) => ({
      nombre: f.name,
      url: fileUrl(f),
    })),
    status: props.Status.status?.name ?? null,
    respuesta: plainText(props.Respuesta.rich_text),
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
    url: page.url,
  };
}
