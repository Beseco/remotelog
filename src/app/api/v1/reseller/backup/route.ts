import { NextRequest, NextResponse } from "next/server";
import { createBackup } from "@/addons/reseller/backup/backup";

/**
 * GET /api/v1/reseller/backup?token=SECRET[&orgId=xxx]
 *
 * Protected by BACKUP_TOKEN env variable.
 * Returns a JSON backup of all organizations (or a specific one).
 *
 * Coolify cron setup:
 *   curl -s "https://your-app.com/api/v1/reseller/backup?token=$BACKUP_TOKEN" \
 *     -o /backups/remotelog-$(date +%Y%m%d).json
 */
export async function GET(req: NextRequest) {
  if (!process.env.RESELLER_MODE) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const backupToken = process.env.BACKUP_TOKEN;
  if (!backupToken) {
    return NextResponse.json({ error: "Backup not configured" }, { status: 503 });
  }

  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (token !== backupToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = searchParams.get("orgId") ?? undefined;

  try {
    const backup = await createBackup(orgId);
    const date = new Date().toISOString().slice(0, 10);
    const filename = orgId
      ? `remotelog-backup-${orgId}-${date}.json`
      : `remotelog-backup-${date}.json`;

    return new NextResponse(JSON.stringify(backup, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("Backup error:", err);
    return NextResponse.json({ error: "Backup failed" }, { status: 500 });
  }
}
