# prior-auth-agent

Monorepo de la aplicacion, organizado en dos workspaces:

- `client`: interfaz React, Tailwind y shadcn/ui.
- `server`: API y servidor Bun.

## Requisitos

- [Bun](https://bun.com) 1.3 o superior.

## Configuracion inicial

Desde la raiz del repositorio, instala todas las dependencias:

```bash
bun install
```

## Desarrollo

Para iniciar cliente y servidor al mismo tiempo:

```bash
bun run dev
```

Tambien puedes iniciar cada workspace por separado:

```bash
bun run dev:client
bun run dev:server
```

El cliente se sirve con HMR y el servidor queda disponible en el puerto que Bun asigne.

## Comandos

| Comando | Descripcion |
| --- | --- |
| `bun run dev` | Inicia cliente y servidor. |
| `bun run dev:client` | Inicia solo el cliente. |
| `bun run dev:server` | Inicia solo el servidor. |
| `bun run build` | Genera el build de produccion del cliente. |
| `bun run start` | Inicia el servidor en modo produccion. |
| `bun run typecheck` | Comprueba los tipos de ambos workspaces. |

## Dependencias por workspace

Para agregar una dependencia al cliente:

```bash
cd client
bun add nombre-del-paquete
```

Para agregar una dependencia al servidor:

```bash
cd server
bun add nombre-del-paquete
```

Despues de instalar una dependencia, ejecuta `bun install` desde la raiz si necesitas sincronizar el lockfile.
