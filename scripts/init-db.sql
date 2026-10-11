CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Clients: id, name, timezone and address
-- ============================================================
CREATE TABLE IF NOT EXISTS clients (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       VARCHAR(100) NOT NULL,
  timezone   VARCHAR(64)  NOT NULL,
  address    VARCHAR(200) NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Vehicles: id, VIN, license plate, color, year, model
-- ============================================================
CREATE TABLE IF NOT EXISTS vehicles (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id    UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  vin          VARCHAR(17) NOT NULL UNIQUE,
  license_plate VARCHAR(10) NOT NULL,
  color        VARCHAR(40) NOT NULL,
  year         INTEGER NOT NULL CHECK (year >= 1900 AND year <= 2100),
  model        VARCHAR(60) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Appointments: id, date, time, comments, vehicle, status, timestamps
-- ============================================================
CREATE TABLE IF NOT EXISTS appointments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  vehicle_id  UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  time        TIME NOT NULL,
  comments    TEXT,
  status      VARCHAR(20) NOT NULL DEFAULT 'ENABLED'
              CHECK (status IN ('ENABLED', 'DISABLED')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Business rule at database level: a slot cannot hold two ENABLED
-- appointments (prevents race conditions).
CREATE UNIQUE INDEX IF NOT EXISTS uq_appointments_slot_enabled
  ON appointments (date, time) WHERE status = 'ENABLED';

CREATE INDEX IF NOT EXISTS idx_appointments_date      ON appointments (date);
CREATE INDEX IF NOT EXISTS idx_vehicles_client        ON vehicles (client_id);

-- ============================================================
-- Reusable trigger to keep updated_at fresh
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_clients_updated_at ON clients;
CREATE TRIGGER trg_clients_updated_at
BEFORE UPDATE ON clients
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_vehicles_updated_at ON vehicles;
CREATE TRIGGER trg_vehicles_updated_at
BEFORE UPDATE ON vehicles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_appointments_updated_at ON appointments;
CREATE TRIGGER trg_appointments_updated_at
BEFORE UPDATE ON appointments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Sample data
-- ============================================================
INSERT INTO clients (id, name, timezone, address) VALUES
  ('11111111-1111-4111-8111-111111111111', 'Ana Lopez', 'America/Bogota', 'Calle 1 # 2-3, Bogota'),
  ('33333333-3333-4333-8333-333333333333', 'Carlos Ruiz', 'America/Mexico_City', 'Av. Reforma 100, CDMX')
ON CONFLICT (id) DO NOTHING;

INSERT INTO vehicles (id, client_id, vin, license_plate, color, year, model) VALUES
  ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', '1HGCM82633A004352', 'ABC123', 'Rojo', 2020, 'Civic'),
  ('44444444-4444-4444-8444-444444444444', '33333333-3333-4333-8333-333333333333', '5YJ3E1EA7JF000337', 'XYZ789', 'Blanco', 2022, 'Model 3')
ON CONFLICT (id) DO NOTHING;