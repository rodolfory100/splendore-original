-- P3: campos foto e LGPD em responsaveis
ALTER TABLE responsaveis ADD COLUMN foto_url text;
ALTER TABLE responsaveis ADD COLUMN consentimento_lgpd integer DEFAULT 0;

-- P4: snapshot_url em cameras
ALTER TABLE cameras ADD COLUMN snapshot_url text;
