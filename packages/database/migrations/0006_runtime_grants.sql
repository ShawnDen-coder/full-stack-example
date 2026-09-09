GRANT USAGE ON SCHEMA public TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "user", "session", "account", "verification", "organization", "member", "invitation" TO app_runtime;
