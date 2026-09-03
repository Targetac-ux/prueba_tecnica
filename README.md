# Event Logger

Sistema de ingesta y visualización de eventos: una API que recibe eventos de
log estructurados y un dashboard que los muestra en tiempo real, con filtros,
paginación por cursor, gráfico agregado por hora y autenticación por clave
compartida.

**Demo en vivo:** `https://d31p4f635dtzjf.cloudfront.net`
**API:** `https://d1fz0dq26fxyum.cloudfront.net`

## Stack

- **API:** Node.js 20, TypeScript, Express, PostgreSQL (`pg`), Zod para
  validación, corrida con `tsx` (ver [DECISIONS.md](./DECISIONS.md), sección 1).
- **Frontend:** React 18, Vite, Recharts, CSS Modules.
- **Compartido:** `packages/shared` — esquema Zod y tipos usados por ambos
  lados, fuente única de verdad del contrato de datos.
- **Infraestructura:** RDS PostgreSQL, Lightsail (API), S3 + CloudFront
  (frontend y HTTPS de la API), GitHub Actions (CI/CD).

## Cómo correrlo en local

Requiere Docker y Node 20+.

```bash
git clone <url-del-repo>
cd event-logger
npm install
docker-compose up -d
npm run migrate --workspace=api
npm run dev
```

La API queda en `http://localhost:3000`, el frontend en `http://localhost:5173`.
Sin `API_KEY` configurada en el entorno, la API no exige autenticación (ver
tabla de variables abajo).

Para tener datos de ejemplo:

```bash
npm run seed --workspace=api
```

## Variables de entorno

| Variable | Dónde | Ejemplo | Descripción |
|---|---|---|---|
| `DATABASE_URL` | API | `postgres://user:pass@host:5432/events` | Cadena de conexión a Postgres |
| `PORT` | API | `3000` | Puerto de escucha |
| `NODE_ENV` | API | `production` | Habilita SSL en la conexión a Postgres cuando es `production` |
| `LOG_LEVEL` | API | `info` | Nivel mínimo de log |
| `LOG_FILE_PATH` | API | `/var/log/event-logger/app.log` | Ruta del archivo de log |
| `RATE_LIMIT_MAX` | API | `100` | Peticiones permitidas por ventana en `POST /events` |
| `RATE_LIMIT_WINDOW_MS` | API | `60000` | Duración de la ventana |
| `CORS_ORIGIN` | API | `https://d31p4f635dtzjf.cloudfront.net` | Origen(es) permitidos del frontend, separados por coma si son varios |
| `API_KEY` | API | *(generado, no en el repo)* | Secreto compartido para autenticación. `openssl rand -hex 32` |
| `VITE_API_URL` | Web | `https://d1fz0dq26fxyum.cloudfront.net` | URL base de la API |

El valor real de `API_KEY` no va en ningún archivo del repo, ni en
`.env.example` — se genera una vez y se comparte por un canal privado (ver
[DEPLOYMENT.md](./DEPLOYMENT.md)).

## Contrato de la API

- `POST /events` — crea un evento. Requiere `Authorization: Bearer <API_KEY>`.
- `GET /events` — lista eventos con filtros (`level`, `source`, `from`, `to`,
  `q`) y paginación por cursor (`cursor`, `limit`).
- `GET /events/stats` — conteos por hora y nivel, respeta los mismos filtros.
- `GET /health` — único endpoint sin autenticación. Verifica conexión a DB.

Detalle completo de parámetros, formato de error y ejemplos de respuesta en
[DEPLOYMENT.md](./DEPLOYMENT.md).

## Probar la API

```bash
curl -X POST https://d1fz0dq26fxyum.cloudfront.net/events \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "level": "error",
    "message": "Connection to payment gateway timed out",
    "source": "checkout-service",
    "metadata": { "userId": "u_1234", "retries": 3 }
  }'
```

Sin el header `Authorization`, este mismo `curl` devuelve `401`.

## Tests

```bash
npm test --workspace=api   # 30 tests, ~72% de cobertura
npm test --workspace=web   # 3 tests de componente
```

## Decisiones de diseño

El razonamiento detrás de cada elección de arquitectura — por qué dos
timestamps, cursor en vez de offset, polling en vez de WebSocket, los bugs
reales encontrados en producción y cómo se resolvieron — está en
[DECISIONS.md](./DECISIONS.md).
