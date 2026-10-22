CREATE TABLE IF NOT EXISTS ajustes_menu (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  descuento_sin_sopa NUMERIC(10,2) NOT NULL DEFAULT 1000 CHECK (descuento_sin_sopa >= 0)
);