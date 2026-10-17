use chrono::{SecondsFormat, Utc};
use rusqlite::{params, Connection, OpenFlags};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::BTreeMap;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};

const DB_FILENAME: &str = "igroteka.sqlite3";
const BACKUP_KEEP: usize = 20;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BackupMeta {
    reason: String,
    created_at: String,
}

fn now_iso() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}

fn file_stamp() -> String {
    Utc::now().format("%Y-%m-%dT%H-%M-%S-%3fZ").to_string()
}

fn source_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap_or(Path::new(env!("CARGO_MANIFEST_DIR")))
        .to_path_buf()
}

fn portable_root() -> Option<PathBuf> {
    std::env::current_exe().ok()?.parent().map(Path::to_path_buf)
}

fn is_cargo_build_output(root: &Path) -> bool {
    let Some(profile) = root.file_name().and_then(|x| x.to_str()) else { return false; };
    if profile != "release" && profile != "debug" { return false; }
    let Some(target) = root.parent() else { return false; };
    if target.file_name().and_then(|x| x.to_str()) != Some("target") { return false; }
    let Some(src_tauri) = target.parent() else { return false; };
    src_tauri.file_name().and_then(|x| x.to_str()) == Some("src-tauri")
}

fn root_for_data() -> PathBuf {
    if let Some(root) = portable_root() {
        if root.join("data").is_dir() || root.join("seed-data").is_dir() {
            return root;
        }
        if is_cargo_build_output(&root) {
            return source_root();
        }
        return root;
    }
    source_root()
}

fn database_path() -> Result<PathBuf, String> {
    let path = root_for_data().join("data").join(DB_FILENAME);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    Ok(path)
}

fn seed_database_path() -> Option<PathBuf> {
    let root = root_for_data();
    let seed = root.join("seed-data").join(DB_FILENAME);
    seed.is_file().then_some(seed)
}

fn backup_root() -> Result<PathBuf, String> {
    let root = root_for_data().join("data").join("backups");
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    Ok(root)
}

fn meta_path() -> Result<PathBuf, String> {
    Ok(backup_root()?.join("backup-meta.json"))
}

fn integrity_path(path: &Path) -> Result<bool, String> {
    let db = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY).map_err(|e| e.to_string())?;
    let result: String = db.query_row("PRAGMA integrity_check", [], |r| r.get(0)).map_err(|e| e.to_string())?;
    Ok(result.eq_ignore_ascii_case("ok"))
}

fn has_active_wal(path: &Path) -> bool {
    fs::metadata(PathBuf::from(format!("{}-wal", path.display())))
        .map(|m| m.len() > 0)
        .unwrap_or(false)
}

fn checkpoint(path: &Path) -> Result<(), String> {
    let db = Connection::open(path).map_err(|e| e.to_string())?;
    let _ = db.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);");
    drop(db);
    if has_active_wal(path) {
        return Err(format!("SQLite WAL всё ещё активен: {}", path.display()));
    }
    Ok(())
}

fn read_catalog() -> BTreeMap<String, BackupMeta> {
    let Ok(path) = meta_path() else { return BTreeMap::new(); };
    let Ok(text) = fs::read_to_string(path) else { return BTreeMap::new(); };
    serde_json::from_str(&text).unwrap_or_default()
}

fn replace_file_cross_platform(tmp: &Path, target: &Path) -> Result<(), String> {
    if !target.exists() {
        return fs::rename(tmp, target).map_err(|e| e.to_string());
    }
    let old = target.with_file_name(format!(
        ".{}.old-{}-{}",
        target.file_name().and_then(|x| x.to_str()).unwrap_or("igroteka"),
        std::process::id(),
        Utc::now().timestamp_millis()
    ));
    fs::rename(target, &old).map_err(|e| e.to_string())?;
    match fs::rename(tmp, target) {
        Ok(()) => {
            let _ = fs::remove_file(&old);
            Ok(())
        }
        Err(error) => {
            let _ = fs::rename(&old, target);
            Err(error.to_string())
        }
    }
}

fn write_bytes_atomic(path: &Path, bytes: &[u8]) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let tmp = path.with_file_name(format!(
        ".{}.tmp-{}-{}",
        path.file_name().and_then(|x| x.to_str()).unwrap_or("igroteka"),
        std::process::id(),
        Utc::now().timestamp_millis()
    ));
    let mut file = OpenOptions::new().create_new(true).write(true).open(&tmp).map_err(|e| e.to_string())?;
    let result = (|| -> Result<(), String> {
        file.write_all(bytes).map_err(|e| e.to_string())?;
        file.sync_all().map_err(|e| e.to_string())?;
        drop(file);
        replace_file_cross_platform(&tmp, path)
    })();
    if result.is_err() { let _ = fs::remove_file(&tmp); }
    result
}

fn write_catalog(catalog: &BTreeMap<String, BackupMeta>) -> Result<(), String> {
    let data = serde_json::to_vec_pretty(catalog).map_err(|e| e.to_string())?;
    write_bytes_atomic(&meta_path()?, &data)
}

fn copy_verified(source: &Path, target: &Path) -> Result<(), String> {
    if has_active_wal(source) {
        return Err(format!("Нельзя копировать SQLite с активным WAL: {}", source.display()));
    }
    if !integrity_path(source)? {
        return Err(format!("SQLite не прошла проверку целостности: {}", source.display()));
    }
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::copy(source, target).map_err(|e| e.to_string())?;
    if !integrity_path(target)? {
        let _ = fs::remove_file(target);
        return Err("Созданная копия SQLite не прошла повторную проверку.".into());
    }
    Ok(())
}

fn create_backup(reason: &str) -> Result<(), String> {
    let source = database_path()?;
    if !source.is_file() { return Ok(()); }
    checkpoint(&source)?;
    if !integrity_path(&source)? {
        return Err("Нельзя создать резервную копию повреждённой базы Игротеки.".into());
    }

    let root = backup_root()?;
    let mut name = format!("igroteka_{}.sqlite3", file_stamp());
    let mut index = 1usize;
    while root.join(&name).exists() {
        name = format!("igroteka_{}_{}.sqlite3", file_stamp(), index);
        index += 1;
    }
    copy_verified(&source, &root.join(&name))?;

    let mut catalog = read_catalog();
    catalog.insert(name.clone(), BackupMeta { reason: reason.to_string(), created_at: now_iso() });
    let mut items: Vec<(String, BackupMeta)> = catalog.iter().map(|(k,v)|(k.clone(),v.clone())).collect();
    items.sort_by(|a,b| b.1.created_at.cmp(&a.1.created_at));
    for (old, _) in items.into_iter().skip(BACKUP_KEEP) {
        let _ = fs::remove_file(root.join(&old));
        catalog.remove(&old);
    }
    write_catalog(&catalog)
}

fn latest_valid_backup() -> Result<Option<PathBuf>, String> {
    let root = backup_root()?;
    let mut files: Vec<PathBuf> = fs::read_dir(&root).map_err(|e| e.to_string())?
        .filter_map(Result::ok)
        .map(|e| e.path())
        .filter(|p| p.extension().and_then(|x| x.to_str()).map(|x| x.eq_ignore_ascii_case("sqlite3")).unwrap_or(false))
        .collect();
    files.sort_by(|a,b| b.file_name().cmp(&a.file_name()));
    for path in files {
        if !has_active_wal(&path) && integrity_path(&path).unwrap_or(false) {
            return Ok(Some(path));
        }
    }
    Ok(None)
}

fn replace_live_from(source: &Path) -> Result<(), String> {
    let target = database_path()?;
    let tmp = target.with_file_name(format!("{}.restore-{}.tmp", DB_FILENAME, Utc::now().timestamp_millis()));
    copy_verified(source, &tmp)?;
    let old = target.with_file_name(format!("{}.rollback-{}", DB_FILENAME, Utc::now().timestamp_millis()));
    if target.exists() { fs::rename(&target, &old).map_err(|e| e.to_string())?; }
    match fs::rename(&tmp, &target) {
        Ok(()) => {
            if !integrity_path(&target)? {
                let _ = fs::remove_file(&target);
                if old.exists() { let _ = fs::rename(&old, &target); }
                return Err("Восстановленная база не прошла проверку целостности.".into());
            }
            let _ = fs::remove_file(&old);
            Ok(())
        }
        Err(error) => {
            if old.exists() { let _ = fs::rename(&old, &target); }
            let _ = fs::remove_file(&tmp);
            Err(error.to_string())
        }
    }
}

pub fn ensure_database() -> Result<(), String> {
    let live = database_path()?;
    if live.is_file() && integrity_path(&live).unwrap_or(false) {
        let _ = checkpoint(&live);
        return Ok(());
    }

    if live.is_file() {
        let recovery = backup_root()?.join("recovery");
        fs::create_dir_all(&recovery).map_err(|e| e.to_string())?;
        let _ = fs::copy(&live, recovery.join(format!("igroteka_corrupt_{}.sqlite3", file_stamp())));
    }

    if let Some(backup) = latest_valid_backup()? {
        return replace_live_from(&backup);
    }
    if let Some(seed) = seed_database_path() {
        return replace_live_from(&seed);
    }
    Err("Не найдена рабочая, резервная или seed-база Игротеки.".into())
}

fn open_readonly() -> Result<Connection, String> {
    let db = Connection::open_with_flags(database_path()?, OpenFlags::SQLITE_OPEN_READ_ONLY).map_err(|e| e.to_string())?;
    db.execute_batch("PRAGMA busy_timeout=5000;").map_err(|e| e.to_string())?;
    Ok(db)
}

fn open_rw() -> Result<Connection, String> {
    let db = Connection::open(database_path()?).map_err(|e| e.to_string())?;
    db.execute_batch("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;").map_err(|e| e.to_string())?;
    Ok(db)
}

fn game_array(raw: &str) -> Result<Vec<Value>, String> {
    let value: Value = serde_json::from_str(raw).map_err(|_| "Некорректный JSON списка.".to_string())?;
    value.as_array().cloned().ok_or_else(|| "Ожидался JSON-массив.".to_string())
}

fn v_string(v: &Value, key: &str) -> Option<String> { v.get(key).and_then(Value::as_str).map(ToOwned::to_owned) }
fn v_i64(v: &Value, key: &str) -> Option<i64> { v.get(key).and_then(Value::as_i64) }
fn v_bool(v: &Value, key: &str) -> bool { v.get(key).and_then(Value::as_bool).unwrap_or(false) }

pub fn persist_games(games_raw: &str, trash_raw: &str, ui_raw: Option<&str>, reason: &str, make_backup: bool) -> Result<(), String> {
    let games = game_array(games_raw)?;
    let trash = game_array(trash_raw)?;
    if make_backup { create_backup(reason)?; }

    let mut db = open_rw()?;
    let tx = db.transaction().map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM games", []).map_err(|e| e.to_string())?;
    {
        let mut stmt = tx.prepare("INSERT INTO games(id,game,rating,favorite,last_modified,last_modified_reason,extra_json) VALUES(?1,?2,?3,?4,?5,?6,?7)").map_err(|e| e.to_string())?;
        for row in games {
            let game = v_string(&row, "game").unwrap_or_default().trim().to_string();
            if game.is_empty() { continue; }
            stmt.execute(params![v_i64(&row,"id"), game, v_string(&row,"rating").unwrap_or_else(||"Запланировано".into()), if v_bool(&row,"favorite"){1}else{0}, v_string(&row,"last_modified"), v_string(&row,"last_modified_reason"), v_string(&row,"extra_json")]).map_err(|e| e.to_string())?;
        }
    }
    tx.execute("DELETE FROM trash", []).map_err(|e| e.to_string())?;
    {
        let mut stmt = tx.prepare("INSERT INTO trash(id,game,rating,favorite,deleted_at,last_modified,last_modified_reason,extra_json) VALUES(?1,?2,?3,?4,?5,?6,?7,?8)").map_err(|e| e.to_string())?;
        for row in trash {
            let game = v_string(&row, "game").unwrap_or_default().trim().to_string();
            if game.is_empty() { continue; }
            stmt.execute(params![v_i64(&row,"id"), game, v_string(&row,"rating").unwrap_or_else(||"Запланировано".into()), if v_bool(&row,"favorite"){1}else{0}, v_string(&row,"deleted_at"), v_string(&row,"last_modified"), v_string(&row,"last_modified_reason"), v_string(&row,"extra_json")]).map_err(|e| e.to_string())?;
        }
    }
    if let Some(raw) = ui_raw {
        let ui: Value = serde_json::from_str(raw).map_err(|_| "Некорректные настройки интерфейса.".to_string())?;
        if !ui.is_object() { return Err("Некорректные настройки интерфейса.".into()); }
        tx.execute("INSERT INTO settings(key,value) VALUES('uiState',?1) ON CONFLICT(key) DO UPDATE SET value=excluded.value", params![serde_json::to_string(&ui).map_err(|e|e.to_string())?]).map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

pub fn persist_ui(ui_raw: &str) -> Result<(), String> {
    let ui: Value = serde_json::from_str(ui_raw).map_err(|_| "Некорректные настройки интерфейса.".to_string())?;
    if !ui.is_object() { return Err("Некорректные настройки интерфейса.".into()); }
    let db = open_rw()?;
    db.execute("INSERT INTO settings(key,value) VALUES('uiState',?1) ON CONFLICT(key) DO UPDATE SET value=excluded.value", params![serde_json::to_string(&ui).map_err(|e|e.to_string())?]).map_err(|e| e.to_string())?;
    Ok(())
}

fn read_rows(db: &Connection, table: &str) -> Result<Value, String> {
    let sql = if table == "trash" {
        "SELECT id,game,rating,favorite,deleted_at,last_modified,last_modified_reason,extra_json FROM trash ORDER BY id"
    } else {
        "SELECT id,game,rating,favorite,NULL AS deleted_at,last_modified,last_modified_reason,extra_json FROM games ORDER BY id"
    };
    let mut stmt = db.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |r| {
        Ok(json!({
            "id": r.get::<_,i64>(0)?, "game": r.get::<_,String>(1)?, "rating": r.get::<_,String>(2)?,
            "favorite": r.get::<_,i64>(3)? != 0, "deleted_at": r.get::<_,Option<String>>(4)?,
            "last_modified": r.get::<_,Option<String>>(5)?, "last_modified_reason": r.get::<_,Option<String>>(6)?,
            "extra_json": r.get::<_,Option<String>>(7)?
        }))
    }).map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for row in rows { out.push(row.map_err(|e| e.to_string())?); }
    Ok(Value::Array(out))
}

pub fn read_state() -> Result<Value, String> {
    let db = open_readonly()?;
    let games = read_rows(&db, "games")?;
    let trash = read_rows(&db, "trash")?;
    let ui: Option<String> = db.query_row("SELECT value FROM settings WHERE key='uiState'", [], |r| r.get(0)).ok();
    Ok(json!({
        "games": serde_json::to_string(&games).map_err(|e|e.to_string())?,
        "trash": serde_json::to_string(&trash).map_err(|e|e.to_string())?,
        "ui": ui
    }))
}
