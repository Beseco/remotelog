-- RustDesk custom server configuration on Organization
ALTER TABLE "Organization" ADD COLUMN "rustdeskIdServer" TEXT;
ALTER TABLE "Organization" ADD COLUMN "rustdeskRelay"    TEXT;
ALTER TABLE "Organization" ADD COLUMN "rustdeskKey"      TEXT;
