ALTER TABLE users
  ADD COLUMN rol VARCHAR(20) NOT NULL DEFAULT 'admin'
    CHECK (rol IN ('admin', 'mesero', 'cocina', 'caja')),
  ADD COLUMN owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN activo BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE users
  ADD CONSTRAINT users_rol_owner_chk CHECK (
    (rol = 'admin' AND owner_id IS NULL) OR (rol <> 'admin' AND owner_id IS NOT NULL)
  );

CREATE INDEX idx_users_owner ON users (owner_id);