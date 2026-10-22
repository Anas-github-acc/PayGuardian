# Supabase local/project configuration

This directory reserves the Supabase project boundary for PostgreSQL and Auth.

The migrations have been applied to the configured remote Supabase project through the Supabase CLI. The local Supabase stack is optional for this environment: Docker is installed and the daemon runs, but the sandbox blocks Docker network creation with `operation not permitted`.

When Docker and the Supabase CLI are available:

```bash
supabase start
supabase status
```

Do not commit project keys, service-role keys, database passwords, or generated secret values. The Fastify server uses the service-role key; browser and agent runtimes must never receive it.
