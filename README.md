# RemoteLog

Self-hosted Open-Source Web-App (AGPL-3.0) für IT-Dienstleister zur Verwaltung von Remote-Verbindungen, Tätigkeitsnachweisen, Zeiterfassung und Wake on LAN.

## Features

- **Sitzungserfassung** — Remote-, Vor-Ort- und Telefon-Einsätze erfassen, mit Dauer, Techniker, Gerät und Kontakt
- **Kundenverwaltung** — Kunden mit Kontakten, Adresse, E-Mail, Telefon, Website und Kundennummer
- **Geräteverwaltung** — Geräte mit Remote-IDs (RustDesk, TeamViewer, AnyDesk, RDP, …), Gruppen und Wake on LAN
- **Berichte** — Tätigkeitsnachweise und Zeitauswertungen pro Kunde, Zeitraum und Techniker
- **Gruppen** — Hierarchische Gerätegruppen mit granularen Benutzerrechten
- **Schnellsuche** — Volltextsuche über Kunden, Geräte und Sitzungen
- **API-Keys** — Maschinenlesbare API für externe Integrationen (Read-only & Full-Access)
- **Rollen** — Admin, Techniker, Readonly
- **Addons** — Erweiterbare Integrationen zu externen Systemen (Zammad, Invoice Ninja, …)

---

## Addons

Addons werden unter **Einstellungen → Administration → Addons** aktiviert und konfiguriert. Jedes Addon speichert seine Konfiguration (URL, API-Token) verschlüsselt in der Datenbank. Addons sind pro Organisation unabhängig konfigurierbar.

### Zammad

Synchronisiert Zammad-Organisationen als RemoteLog-Kunden und deren Mitglieder als Kontakte. Die Synchronisation ist **bidirektional**: Zammad-Organisationen werden in RemoteLog importiert und RemoteLog-Kunden werden als Zammad-Organisationen exportiert.

**Voraussetzungen:**
- Zammad-Instanz (Self-hosted oder Cloud)
- API-Token: Zammad → Profil → Token-Zugang → neues Token mit den Berechtigungen `admin.organization` und `ticket.agent`

**Konfiguration:**

| Feld | Beschreibung |
|------|-------------|
| Zammad-URL | URL deiner Zammad-Instanz (z.B. `https://zammad.example.com`) |
| API-Token | Zammad Benutzer-API-Token |

**Funktionen:**
- **Sync (Zammad → RemoteLog):** Alle aktiven Zammad-Organisationen werden als Kunden importiert. Bereits vorhandene Kunden werden per Name verknüpft (kein Duplikat). Mitglieder der Organisation werden als Kontakte übernommen (Name, E-Mail, Telefon, Mobil). Inaktive Organisationen werden übersprungen.
- **Sync (RemoteLog → Zammad):** RemoteLog-Kunden ohne Zammad-Verknüpfung werden als neue Organisationen in Zammad erstellt. Bestehend verknüpfte Kunden werden aktualisiert.
- **Tickets anzeigen:** Auf der Kundendetailseite werden die letzten Zammad-Tickets der Organisation angezeigt (Status-Badge, Link zu Zammad).
- **Zammad-Link:** Direktlink zur Zammad-Organisation auf der Kundendetailseite.
- **Sidebar-Link:** Bei aktiviertem Addon erscheint Zammad als direkter Link in der Navigation.

---

### Invoice Ninja

Synchronisiert RemoteLog-Kunden (inkl. Kontakte, Adresse, E-Mail, Telefon) nach Invoice Ninja. Die Synchronisation ist **bidirektional**: Invoice-Ninja-Clients werden importiert und RemoteLog-Kunden nach Invoice Ninja exportiert. Die Kundennummer kommt immer aus Invoice Ninja (Single Source of Truth).

**Voraussetzungen:**
- Invoice Ninja v5 (Self-hosted oder Cloud)
- API-Token: Invoice Ninja → Einstellungen → API-Token → Token erstellen

**Konfiguration:**

| Feld | Beschreibung |
|------|-------------|
| Invoice Ninja URL | URL deiner Invoice-Ninja-Instanz (z.B. `https://invoicing.example.com`) |
| API-Token | Invoice Ninja API-Token |

**Funktionen:**
- **Sync (Invoice Ninja → RemoteLog):** Alle Invoice-Ninja-Clients werden importiert. Bestehende Kunden werden per Name verknüpft. Kundennummer und Kontakte werden übernommen. Die Kundennummer aus Invoice Ninja überschreibt immer die lokale.
- **Sync (RemoteLog → Invoice Ninja):** RemoteLog-Kunden werden als Clients in Invoice Ninja erstellt oder aktualisiert. Kontakte werden als eingebettete IN-Kontakte mitübertragen.
- **Rechnungen anzeigen:** Auf der Kundendetailseite werden die letzten Rechnungen aus Invoice Ninja angezeigt (Status, Betrag, Saldo, Datum, direkter Link zur Rechnung).
- **Sitzungen übertragen:** Abgeschlossene Sitzungen können als Zeiterfassungs-Tasks nach Invoice Ninja übertragen werden. Pro Sitzung wird ein Task mit Start- und Endzeit erstellt. Bereits übertragene Sitzungen werden markiert (grünes Häkchen) und können nicht doppelt übertragen werden.
- **Invoice-Ninja-Link:** Direktlink zum Client-Datensatz in Invoice Ninja auf der Kundendetailseite.
- **Sidebar-Link:** Bei aktiviertem Addon erscheint Invoice Ninja als direkter Link in der Navigation.

---

### Kunden zusammenführen

Nicht direkt ein Addon, aber nützlich nach einem ersten Sync: Unter **Kunden → ⋮ → Zusammenführen** können zwei Kundendatensätze zusammengeführt werden. Alle Sitzungen, Geräte, Kontakte und Gruppen werden auf den primären Datensatz verschoben, der sekundäre wird gelöscht. In Invoice Ninja oder Zammad wird nichts verändert.

---

## Tech Stack

- **Frontend:** Next.js 16 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **ORM:** Prisma 7 + PostgreSQL
- **Auth:** NextAuth.js v5 (Credentials + JWT)
- **WoL:** API Route + wakeonlan npm package
- **Lizenz:** AGPL-3.0

---

## Lokale Entwicklung

### Voraussetzungen

- Node.js 20+
- Docker + Docker Compose

### Setup

```bash
# 1. Repository klonen
git clone https://github.com/Beseco/remotelog.git
cd remotelog
git checkout dev

# 2. Abhängigkeiten installieren
npm install

# 3. Umgebungsvariablen konfigurieren
cp .env.example .env.local
# .env.local editieren — Werte anpassen:
#   NEXTAUTH_SECRET=$(openssl rand -base64 32)
#   REMOTELOG_API_KEY_SECRET=$(openssl rand -base64 32)
#   NEXTAUTH_URL=http://localhost:3000

# 4. Datenbank + Migrations + Seed
docker compose up db -d
npx prisma migrate dev
npx prisma db seed

# 5. Entwicklungsserver
npm run dev
```

App: http://localhost:3000  
Erster Start: http://localhost:3000/setup (Admin im Assistenten anlegen)

```bash
# Prisma Studio
npx prisma studio
```

---

## Deployment mit Docker Compose

Für einen frischen Server (neu aufsetzen):

```bash
git clone https://github.com/Beseco/remotelog.git
cd remotelog
git checkout dev

cp .env.example .env
# .env befüllen:
#   NEXTAUTH_SECRET
#   REMOTELOG_API_KEY_SECRET
#   NEXTAUTH_URL (z. B. http://SERVER-IP:3000)

docker compose down -v --remove-orphans
docker compose build --no-cache
docker compose up -d
```

Danach:

```bash
docker compose ps
docker compose logs migrate --tail=200
docker compose logs app --tail=200
```

Setup-Assistent im Browser öffnen: `http://<server>:3000/setup`

- Schritt 1: Admin anlegen (Pflicht)
- Schritt 2: SMTP konfigurieren/testen (optional, überspringbar)
- Schritt 3: RustDesk-Server konfigurieren/testen (optional, überspringbar)

**Konfigurationsprinzip:** SMTP/RustDesk werden primär in der Datenbank gespeichert; `.env` wird als Fallback verwendet.

---

## Deployment mit Coolify

### Schritte

1. **Neue Applikation** in Coolify anlegen
   - Source: GitHub → dieses Repository, Branch: `dev`
   - Build Pack: **Dockerfile**
   - Domain konfigurieren

2. **Umgebungsvariablen** setzen:

   | Variable | Wert |
   |----------|------|
   | `DATABASE_URL` | PostgreSQL Connection String (Coolify-interne DB) |
   | `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
   | `NEXTAUTH_URL` | `https://deine-domain.example.com` |
   | `REMOTELOG_API_KEY_SECRET` | `openssl rand -base64 32` |

3. **Auto-Deploy** via GitHub Webhook einrichten:
   - Coolify: Application → Settings → Webhook Secret kopieren
   - GitHub: Repository → Settings → Webhooks → Add webhook
     - Payload URL: `https://<coolify>/api/v1/webhooks/deploy?uuid=<app-uuid>&secret=<secret>`
     - Content type: `application/json`
     - Trigger: Just the `push` event
   - Ab jetzt deployt jeder Push auf `dev` automatisch

4. **Ersten Deploy** in Coolify manuell starten

> **Hinweis:** `DATABASE_URL` wird von Coolify automatisch als Build-ARG übergeben.
> Migrationen und Seed laufen dadurch **während des Docker-Builds** — kein manueller Schritt nötig.
> Beim ersten Aufruf danach den Setup-Assistenten unter `/setup` durchlaufen.

---

## Umgebungsvariablen

| Variable | Beschreibung | Pflicht |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL Connection String | ✅ |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` | ✅ |
| `NEXTAUTH_URL` | Öffentliche App-URL | ✅ |
| `REMOTELOG_API_KEY_SECRET` | Secret für API-Key-Signierung | ✅ |

---

## Lizenz

[AGPL-3.0](LICENSE)
