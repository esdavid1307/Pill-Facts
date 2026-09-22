-- The walking skeleton's proof that the application reads from Postgres.
-- Not a domain table: Postgres is a cache (ADR-0003) and holds no schema of its own yet.
create table service_status (
    id      integer primary key,
    status  text not null
);

insert into service_status (id, status) values (1, 'ready');
