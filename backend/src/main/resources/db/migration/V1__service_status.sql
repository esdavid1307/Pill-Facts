-- The walking skeleton's proof that the application reads from Postgres.
--
-- Not a domain table, and a deliberate exception to ADR-0003, which says Postgres holds
-- resolved concepts and Label payloads and nothing else. It exists only because the
-- skeleton had to read something and no cache schema existed yet. #14 deletes it once
-- #8 adds the real one.
create table service_status (
    id      integer primary key,
    status  text not null
);

insert into service_status (id, status) values (1, 'ready');
