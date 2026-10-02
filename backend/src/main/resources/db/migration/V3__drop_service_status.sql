-- The walking skeleton's status table goes now that cached_payload exists, leaving
-- Postgres holding only the cache ADR-0003 permits. Dropped here rather than by editing
-- V1, which databases that already ran it have recorded by checksum.
drop table service_status;
