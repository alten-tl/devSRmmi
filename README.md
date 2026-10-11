# 🚘 sam-appointments-crud-ts

Appointments CRUD (clients, vehicles and appointments) built with **AWS SAM**, **Node.js 20** and **TypeScript**, using hexagonal architecture per aggregate: **one Lambda per bounded context** (no monolith) and object-oriented code following SOLID.

## 📋 Requirements

- Node.js >= 20 (macOS: `brew install node@20`)
- AWS SAM CLI >= 1.120 (`brew tap aws/tap && brew install aws-sam-cli`)
- Docker + Docker Compose
- esbuild as a project dependency (already in `devDependencies`)

## 📁 Project structure

```
src/
├── domain/
│   ├── entities/          # Client, Vehicle, Appointment
│   ├── value-objects/     # Name, Address, Timezone, Vin, LicensePlate, VehicleYear, ...
│   └── errors/            # AppError + NotFoundError / ConflictError / ValidationError
├── application/
│   ├── ports/             # IClientRepository, IVehicleRepository, IAppointmentRepository, ILogger, IValidator
│   └── services/          # ClientService, VehicleService, AppointmentService
├── infrastructure/
│   ├── repositories/      # Postgres*Repository
│   ├── validators/        # AjvValidator
│   ├── container/         # Container (DI)
│   ├── db/                # Database (pg pool)
│   └── logging/           # PinoLogger
├── shared/                # middleware/http/utils
└── handlers/              # Lambda facades
```

## 📚 Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 (ARM64) |
| Framework | AWS SAM + API Gateway (REST) |
| Bundling | esbuild (`BuildMethod: makefile`) |
| Database | PostgreSQL 16 (Docker for local) |
| Validation | AJV with JSON schemas |
| Testing | Vitest (unit) |
| Logging | Pino (JSON, sensitive data redaction) |
| Security | WAF (SQLi, XSS, known-bad-inputs), Secrets Manager, parameterized queries |

## 🏛️ Architecture

```
/api-gateway ──► ClientsFunction ──► ClientService ──► IClientRepository ──► PostgresClientRepository
             │   VehiclesFunction ─► VehicleService ─► IVehicleRepository ─► PostgresVehicleRepository
             │   AppointmentsFunction ► AppointmentService ───► IAppointmentRepository ─► PostgresAppointmentRepository
             └── HealthFunction ────► Database (pg pool) ────┐
                                                            └──► PostgreSQL (appointments-db)
```

Layered separation:

- `domain/` – entities, value objects and business errors (`AppError` and subclasses).
- `application/` – ports (interfaces) and services holding the business rules.
- `infrastructure/` – adapters: PostgreSQL repositories, Pino logger, AJV validator, `Container` (DI) and `Database`.
- `shared/` – cross-cutting components: `BaseHandler`, `ErrorMiddleware`, `RequestParser`, `ResponseBuilder`, utilities (`sanitize`, `uuid`, `datetime`).
- `handlers/` – HTTP facades orchestrating service + validation + responses (no business logic).

Each handler only publishes its self-contained bundle to the artifact (`dist/handlers/<name>.js`).

## 📥/📤  Endpoints

| Method | Route | Lambda | Description |
|---|---|---|---|
| GET | `/health` | `HealthFunction` | Healthcheck with DB ping |
| POST | `/clients` | `ClientsFunction` | Create client |
| GET | `/clients/{id}` | `ClientsFunction` | Get client |
| POST | `/vehicles` | `VehiclesFunction` | Create vehicle |
| GET | `/vehicles/{id}` | `VehiclesFunction` | Get vehicle |
| GET | `/clients/{id}/vehicles` | `VehiclesFunction` | Vehicles of a client |
| GET | `/appointments?date=YYYY-MM-DD` | `AppointmentsFunction` | Appointments of a date |
| POST | `/appointments` | `AppointmentsFunction` | Create appointment (validates free slot and vehicle ownership) |
| PUT | `/appointments/{id}` | `AppointmentsFunction` | Reschedule date/time (validates slot) |
| PATCH | `/appointments/{id}/cancel` | `AppointmentsFunction` | Cancel (status -> `DISABLED`) |

Payload formats validated with AJV:

- `client`: `{ name (2-100), timezone (IANA), address (5-200) }`
- `vehicle`: `{ clientId uuid, vin (17 alphanumeric), licensePlate (2-10), color, year (1900-2100), model }`
- `appointment`: `{ clientId uuid, vehicleId uuid, date YYYY-MM-DD, time HH:MM(:SS), comments? }`


## 🎉 Local setup

```bash
# 1. Install dependencies
npm install

# 2. Start PostgreSQL (creates schema, trigger, unique index and seed)
npm run db:up            # docker compose up -d

# 3. Compile the esbuild bundles
npm run build

# 4. Validate template and SAM build
npm run validate         # sam validate
sam build

# 5. Local API on the Docker network where postgres lives
npm run dev              # sam local start-api --docker-network sam-appointments-net
```

The API is available at `http://127.0.0.1:3000`.

### 🧪 Manual smoke test

```bash
# Health (checks DB connectivity)
curl http://127.0.0.1:3000/health

# List appointments by date (requires ?date=YYYY-MM-DD)
curl "http://127.0.0.1:3000/appointments?date=2026-10-20"

# Create an appointment (client and vehicle come from the seed)
curl -X POST http://127.0.0.1:3000/appointments \
  -H "Content-Type: application/json" \
  -d '{"clientId":"11111111-1111-4111-8111-111111111111","vehicleId":"22222222-2222-4222-8222-222222222222","date":"2026-10-20","time":"10:00","comments":"Oil change"}'

# Reschedule (PUT) and cancel (PATCH) use the {id} returned on creation
curl -X PUT http://127.0.0.1:3000/appointments/{id} \
  -H "Content-Type: application/json" \
  -d '{"date":"2026-10-21","time":"11:30","comments":"Rescheduled"}'
curl -X PATCH http://127.0.0.1:3000/appointments/{id}/cancel
```

Alternative with the JSON events in `events/`:

```bash
sam local invoke AppointmentsFunction --event events/list-appointments.json --docker-network sam-appointments-net
```

## 🛢️ Database

`scripts/init-db.sql` runs automatically when the container is created (`initdb`):

- Tables `clients`, `vehicles`, `appointments` with cascading FKs and `updated_at` triggers.
- **Partial unique index** `uq_appointments_slot_enabled ON appointments (date, time) WHERE status='ENABLED'`: guarantees at the DB level that a slot cannot hold two active appointments (defense against race conditions).
- Seed: 2 clients and 2 vehicles.

Connection (config in `src/config/index.ts`):

| Variable | Local (`.env`) |
|---|---|
| `DB_HOST` | `appointments-db` (Docker service name) |
| `DB_PORT` | `5432` internal; `HOST_DB_PORT=5434` published on the host |
| `DB_USER` / `DB_PASSWORD` | `app_user` / `app_password` |
| `DB_NAME` | `appointments_db` |

In production Secrets Manager is used: credentials are read from the secret referenced by `DbSecretArn` (the `secretsmanager:GetSecretValue` permission is already granted to every Lambda).

## 🔍 Logging and observability

- Pino in JSON format; `requestId` propagated in request, response and logs.
- `BaseHandler` logs the incoming request and per-invocation duration.
- API Gateway: Access Logs to `ApiLogsGroup` (14 days) + CloudWatch metrics.
- X-Ray: `Tracing: Active` in Globals.

## 🧪 Testing

```bash
npm test                  # vitest run (99 tests)
npm run typecheck         # tsc --noEmit
npm run test:coverage
```

The tests cover services (appointment rules), AJV validators, handlers, repositories (with a `Database` mock), domain/VOs, HTTP/errors and the logger.

## 🚀 Deployment

```bash
sam build
sam deploy --guided --region us-east-1   # or: npm run deploy
```

Notable template parameters:

- `Stage` (`dev`/`staging`/`prod`) – controls alias, API stage and resource names.
- `DbHost`, `DbPort`, `DbName` – point to RDS/another cloud service.
- `DbSecretArn` – secret with `username`/`password` for production (empty in local).
- `LogLevel` – Pino log level.

Relevant stack outputs: `ApiUrl`, and the ARNs of every function.