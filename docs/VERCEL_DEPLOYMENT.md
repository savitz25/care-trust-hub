# Future Vercel web deployment

Deployment is not approved yet. When approved, deploy only the Next.js application in `apps/web`; `services/ingest` remains a separately operated Python process and must not be packaged with the web deployment.

Recommended monorepo settings:

- repository root: repository root, preserving npm workspace resolution;
- install command: `npm install`;
- build command: `npm run build --workspace=@care/web`;
- application/runtime: Next.js Node runtime, not Edge, because the server-only read model uses PostgreSQL TCP connections;
- required secret: `CARE_DATABASE_URL` only in server-side environment configuration;
- TLS policy: `CARE_DATABASE_SSL=verify-full` where the provider chain validates, or reviewed encrypted `require` mode for a managed pooler whose chain is not available to the runtime;
- public inspection: keep `CARE_ENABLE_DEVELOPMENT_DATA` unset/false. Production code also returns 404 regardless of that value.

Do not create `NEXT_PUBLIC_DATABASE_URL`, expose database credentials, or add Supabase browser credentials. Confirm pooled connection limits and the managed database’s serverless guidance before deployment. Shared workspace packages are resolved by npm workspaces from the repository root.
