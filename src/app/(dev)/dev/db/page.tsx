import { requireAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

function formatValue(val: unknown): { text: string; isNull: boolean } {
  if (val === null || val === undefined) return { text: "null", isNull: true };
  if (val instanceof Date) return { text: val.toISOString().replace("T", " ").substring(0, 19), isNull: false };
  if (typeof val === "object") {
    const str = JSON.stringify(val);
    return { text: str.length > 100 ? str.substring(0, 100) + "…" : str, isNull: false };
  }
  const str = String(val);
  return { text: str.length > 100 ? str.substring(0, 100) + "…" : str, isNull: false };
}

export default async function DevDbPage() {
  await requireAdmin();

  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `;

  const tableData = await Promise.all(
    tables.map(async ({ tablename }) => {
      const [rows, countResult] = await Promise.all([
        prisma.$queryRawUnsafe(`SELECT * FROM "${tablename}" LIMIT 200`) as Promise<Record<string, unknown>[]>,
        prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM "${tablename}"`) as Promise<{ count: bigint }[]>,
      ]);
      return { tablename, rows, count: Number(countResult[0]?.count ?? 0) };
    })
  );

  return (
    <div className="max-w-full">
      {/* Header */}
      <div className="mb-6 border-b border-gray-300 pb-4">
        <h1 className="text-xl font-bold text-gray-900">🛠 Dev – Datenbankansicht</h1>
        <p className="text-xs text-orange-600 mt-1">
          ⚠ Nur sichtbar wenn NODE_ENV=development – gibt 404 in Production
        </p>
      </div>

      {/* Inhaltsverzeichnis */}
      <div className="mb-8 p-4 bg-gray-50 border border-gray-200 rounded">
        <h2 className="font-semibold text-gray-700 mb-2 text-xs uppercase tracking-wide">Tabellen</h2>
        <div className="flex flex-wrap gap-2">
          {tableData.map(({ tablename, count }) => (
            <a
              key={tablename}
              href={`#${tablename}`}
              className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-gray-300 rounded text-xs hover:bg-blue-50 hover:border-blue-400 text-blue-700"
            >
              {tablename}
              <span className="text-gray-400">({count})</span>
            </a>
          ))}
        </div>
      </div>

      {/* Tabellen */}
      <div className="space-y-10">
        {tableData.map(({ tablename, rows, count }) => {
          const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
          return (
            <div key={tablename}>
              <div className="flex items-baseline gap-3 mb-2">
                <h2
                  id={tablename}
                  className="text-base font-bold text-gray-800 scroll-mt-4"
                >
                  {tablename}
                </h2>
                <span className="text-xs text-gray-400">{count} Zeilen{count > 200 ? " (zeige erste 200)" : ""}</span>
                <a href="#top" className="text-xs text-gray-400 hover:text-blue-500 ml-auto">↑ oben</a>
              </div>

              {rows.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Keine Einträge</p>
              ) : (
                <div className="overflow-x-auto border border-gray-200 rounded">
                  <table className="text-xs border-collapse w-full">
                    <thead>
                      <tr className="bg-gray-100">
                        {columns.map((col) => (
                          <th
                            key={col}
                            className="text-left px-2 py-1 border-b border-r border-gray-200 text-gray-600 whitespace-nowrap font-semibold"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr
                          key={i}
                          className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}
                        >
                          {columns.map((col) => {
                            const { text, isNull } = formatValue(row[col]);
                            return (
                              <td
                                key={col}
                                className="px-2 py-1 border-b border-r border-gray-100 align-top whitespace-nowrap max-w-xs overflow-hidden text-ellipsis"
                                title={text}
                              >
                                {isNull ? (
                                  <span className="text-gray-300">null</span>
                                ) : (
                                  text
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
