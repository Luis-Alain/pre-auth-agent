# Client

Cliente React del monorepo `prior-auth-agent`.

## Configuracion

Desde la raiz del repositorio:

```bash
bun install
```

O, si trabajas dentro de este workspace:

```bash
bun install
```

## Scripts

Desde `client/` puedes ejecutar:

```bash
bun run dev
bun run build
bun run start
bun run typecheck
```

Desde la raiz, los equivalentes son:

```bash
bun run dev:client
bun run build:client
bun run typecheck:client
```

`bun run dev` inicia el cliente con HMR. `bun run build` genera los archivos optimizados en `client/dist`.
