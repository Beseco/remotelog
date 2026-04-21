use std::env;
use std::io::{self, Write};
use std::path::Path;
use std::process::Command;
use std::time::Duration;

const RUSTDESK_DOWNLOAD_URL_WINDOWS: &str =
    "https://github.com/rustdesk/rustdesk/releases/download/1.4.0/rustdesk-1.4.0-x86_64.exe";

#[cfg(target_os = "macos")]
const RUSTDESK_DOWNLOAD_URL_MAC: &str =
    "https://github.com/rustdesk/rustdesk/releases/download/1.4.0/rustdesk-1.4.0-x86_64.dmg";

// Magic markers patched at download time — do not change layout (each field = 10-byte marker + 90-byte value)
#[no_mangle]
static REMOTELOG_URL_BUF: [u8; 100] =
    *b"RLBASEURL:https://app.remotelog.de\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0";

#[no_mangle]
static RUSTDESK_ID_SERVER_BUF: [u8; 100] =
    *b"RDIDSERVER:\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0";

#[no_mangle]
static RUSTDESK_RELAY_BUF: [u8; 100] =
    *b"RDRELAY000:\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0";

#[no_mangle]
static RUSTDESK_KEY_BUF: [u8; 100] =
    *b"RDKEY00000:\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0";

fn read_marker(buf: &'static [u8; 100], prefix_len: usize) -> String {
    let val: Vec<u8> = (prefix_len..100_usize)
        .map(|i| unsafe { core::ptr::read_volatile(&buf[i]) })
        .collect();
    let end = val.iter().position(|&b| b == 0).unwrap_or(val.len());
    String::from_utf8_lossy(&val[..end]).into_owned()
}

fn base_url() -> String {
    read_marker(&REMOTELOG_URL_BUF, 10).trim_end_matches('/').to_string()
}
fn rustdesk_id_server() -> String { read_marker(&RUSTDESK_ID_SERVER_BUF, 11) }
fn rustdesk_relay() -> String { read_marker(&RUSTDESK_RELAY_BUF, 11) }
fn rustdesk_key() -> String { read_marker(&RUSTDESK_KEY_BUF, 11) }

fn main() {
    let session_token = extract_session_token();

    println!("=================================================");
    println!("  RemoteLog Fernwartungs-Setup");
    println!("=================================================");
    println!();

    if session_token.is_none() {
        eprintln!("Fehler: Ungueltiger Dateiname. Bitte laden Sie die Datei erneut herunter.");
        wait_and_exit(1);
    }
    let session_token = session_token.unwrap();

    println!("[1/4] RustDesk wird heruntergeladen...");
    let installer_path = match download_rustdesk() {
        Ok(p) => p,
        Err(e) => {
            eprintln!("Fehler beim Download: {}", e);
            wait_and_exit(1);
        }
    };

    println!("[2/4] RustDesk wird installiert...");
    if let Err(e) = install_rustdesk(&installer_path) {
        eprintln!("Fehler bei der Installation: {}", e);
        wait_and_exit(1);
    }

    println!("[3/4] Verbindung wird konfiguriert...");
    let password = generate_password();

    // Write custom server config if provided
    let id_server = rustdesk_id_server();
    if !id_server.is_empty() {
        if let Err(e) = write_rustdesk_config(&id_server, &rustdesk_relay(), &rustdesk_key()) {
            eprintln!("Warnung: Server-Konfiguration konnte nicht geschrieben werden: {}", e);
        }
    }

    if let Err(e) = set_rustdesk_password(&password) {
        eprintln!("Fehler beim Konfigurieren: {}", e);
        wait_and_exit(1);
    }

    std::thread::sleep(Duration::from_secs(3));

    let rustdesk_id = match get_rustdesk_id() {
        Some(id) => id,
        None => {
            eprintln!("Fehler: RustDesk-ID konnte nicht gelesen werden.");
            wait_and_exit(1);
        }
    };

    let computer_name = get_computer_name();

    println!("[4/4] Geraet wird registriert...");
    if let Err(e) = report_device(&session_token, &rustdesk_id, &password, &computer_name) {
        eprintln!("Fehler bei der Registrierung: {}", e);
        wait_and_exit(1);
    }

    println!();
    println!("=================================================");
    println!("  Installation erfolgreich abgeschlossen!");
    println!("  Ihr Techniker kann nun auf dieses Geraet");
    println!("  zugreifen wenn Sie es wuenschen.");
    println!("=================================================");
    wait_and_exit(0);
}

fn extract_session_token() -> Option<String> {
    let exe = env::current_exe().ok()?;
    let stem = exe.file_stem()?.to_str()?;
    // Expected: remotelog-setup-K7MX9P2A  or  remotelog-setup-mac-K7MX9P2A
    let parts: Vec<&str> = stem.split('-').collect();
    // Last segment is the token if it's 8 alphanum chars
    let last = parts.last()?;
    if last.len() == 8 && last.chars().all(|c| c.is_ascii_alphanumeric()) {
        Some(last.to_uppercase())
    } else {
        None
    }
}

// ── Platform-specific paths ──────────────────────────────────────────────────

#[cfg(target_os = "windows")]
fn rustdesk_exe() -> String {
    r"C:\Program Files\RustDesk\rustdesk.exe".to_string()
}

#[cfg(target_os = "macos")]
fn rustdesk_exe() -> String {
    "/Applications/RustDesk.app/Contents/MacOS/rustdesk".to_string()
}

#[cfg(target_os = "windows")]
fn rustdesk_config_path() -> Option<std::path::PathBuf> {
    let appdata = env::var("APPDATA").ok()?;
    Some(std::path::PathBuf::from(appdata).join("RustDesk").join("config").join("RustDesk2.toml"))
}

#[cfg(target_os = "macos")]
fn rustdesk_config_path() -> Option<std::path::PathBuf> {
    let home = env::var("HOME").ok()?;
    Some(std::path::PathBuf::from(home)
        .join("Library")
        .join("Application Support")
        .join("com.carriez.RustDesk")
        .join("RustDesk2.toml"))
}

// ── Download & Install ───────────────────────────────────────────────────────

#[cfg(target_os = "windows")]
fn download_rustdesk() -> Result<std::path::PathBuf, String> {
    let path = env::temp_dir().join("rustdesk-installer.exe");
    download_file(RUSTDESK_DOWNLOAD_URL_WINDOWS, &path)?;
    Ok(path)
}

#[cfg(target_os = "macos")]
fn download_rustdesk() -> Result<std::path::PathBuf, String> {
    let path = env::temp_dir().join("rustdesk-installer.dmg");
    download_file(RUSTDESK_DOWNLOAD_URL_MAC, &path)?;
    Ok(path)
}

fn download_file(url: &str, path: &Path) -> Result<(), String> {
    let resp = ureq::get(url)
        .timeout(Duration::from_secs(180))
        .call()
        .map_err(|e| e.to_string())?;
    let mut file = std::fs::File::create(path).map_err(|e| e.to_string())?;
    let mut reader = resp.into_reader();
    io::copy(&mut reader, &mut file).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(target_os = "windows")]
fn install_rustdesk(installer: &Path) -> Result<(), String> {
    let status = Command::new(installer)
        .args(["--silent-install"])
        .status()
        .map_err(|e| e.to_string())?;
    if !status.success() {
        return Err(format!("Installer exit code: {:?}", status.code()));
    }
    std::thread::sleep(Duration::from_secs(5));
    Ok(())
}

#[cfg(target_os = "macos")]
fn install_rustdesk(dmg: &Path) -> Result<(), String> {
    // Attach DMG
    let attach = Command::new("hdiutil")
        .args(["attach", "-nobrowse", "-quiet", dmg.to_str().unwrap_or("")])
        .status()
        .map_err(|e| e.to_string())?;
    if !attach.success() {
        return Err("DMG konnte nicht gemountet werden".into());
    }
    // Copy app
    let cp = Command::new("cp")
        .args(["-r", "/Volumes/RustDesk/RustDesk.app", "/Applications/"])
        .status()
        .map_err(|e| e.to_string())?;
    // Detach (ignore errors)
    let _ = Command::new("hdiutil")
        .args(["detach", "/Volumes/RustDesk", "-quiet"])
        .status();
    if !cp.success() {
        return Err("RustDesk.app konnte nicht installiert werden".into());
    }
    std::thread::sleep(Duration::from_secs(2));
    Ok(())
}

// ── RustDesk configuration ───────────────────────────────────────────────────

fn write_rustdesk_config(id_server: &str, relay: &str, key: &str) -> Result<(), String> {
    let config_path = rustdesk_config_path().ok_or("Konnte Konfigurationspfad nicht bestimmen")?;
    if let Some(parent) = config_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let mut lines = vec!["[options]".to_string()];
    if !id_server.is_empty() {
        lines.push(format!("custom-rendezvous-server = \"{}\"", id_server));
    }
    if !relay.is_empty() {
        lines.push(format!("relay-server = \"{}\"", relay));
    }
    if !key.is_empty() {
        lines.push(format!("rs-pub-key = \"{}\"", key));
    }
    lines.push(String::new());

    std::fs::write(&config_path, lines.join("\n")).map_err(|e| e.to_string())
}

fn set_rustdesk_password(password: &str) -> Result<(), String> {
    let status = Command::new(rustdesk_exe())
        .args(["--password", password])
        .status()
        .map_err(|e| e.to_string())?;
    if !status.success() {
        return Err("Konnte Passwort nicht setzen".into());
    }
    Ok(())
}

fn get_rustdesk_id() -> Option<String> {
    if let Ok(out) = Command::new(rustdesk_exe()).args(["--get-id"]).output() {
        let id = String::from_utf8_lossy(&out.stdout).trim().to_string();
        if !id.is_empty() {
            return Some(id);
        }
    }
    // Fallback: read from config file
    if let Some(config_path) = rustdesk_config_path() {
        // RustDesk.toml (not RustDesk2.toml) holds the ID
        let id_path = config_path.parent()?.join("RustDesk.toml");
        if let Ok(content) = std::fs::read_to_string(&id_path) {
            for line in content.lines() {
                if line.starts_with("id = ") {
                    return Some(line.trim_start_matches("id = ").trim_matches('"').to_string());
                }
            }
        }
    }
    None
}

fn get_computer_name() -> String {
    #[cfg(target_os = "windows")]
    return env::var("COMPUTERNAME").unwrap_or_else(|_| "Unbekannt".into());

    #[cfg(target_os = "macos")]
    {
        if let Ok(out) = Command::new("scutil").args(["--get", "ComputerName"]).output() {
            let name = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !name.is_empty() { return name; }
        }
        env::var("HOSTNAME").unwrap_or_else(|_| "Unbekannt".into())
    }
}

// ── Password generation ──────────────────────────────────────────────────────

fn generate_password() -> String {
    const CHARSET: &[u8] = b"ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    let seed = std::process::id() as u64
        ^ std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .subsec_nanos() as u64;
    let mut pw = String::with_capacity(12);
    let mut state = seed;
    for _ in 0..12 {
        state ^= state << 13;
        state ^= state >> 7;
        state ^= state << 17;
        pw.push(CHARSET[(state as usize) % CHARSET.len()] as char);
    }
    pw
}

// ── Reporting ────────────────────────────────────────────────────────────────

fn report_device(
    session_token: &str,
    rustdesk_id: &str,
    password: &str,
    computer_name: &str,
) -> Result<(), String> {
    let url = format!("{}/api/v1/install/report", base_url());
    let body = serde_json::json!({
        "sessionToken": session_token,
        "rustdeskId": rustdesk_id,
        "password": password,
        "computerName": computer_name,
    });
    ureq::post(&url)
        .set("Content-Type", "application/json")
        .timeout(Duration::from_secs(30))
        .send_json(&body)
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ── Helpers ──────────────────────────────────────────────────────────────────

fn wait_and_exit(code: i32) -> ! {
    print!("\nDruecken Sie ENTER zum Beenden...");
    io::stdout().flush().ok();
    let mut buf = String::new();
    io::stdin().read_line(&mut buf).ok();
    std::process::exit(code);
}
