#![cfg_attr(
  all(not(debug_assertions), target_os = "android"),
  allow(unused_imports)
)]

use tauri::{Manager, State};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_sql::{DbInstances, DbPool, Migration, MigrationKind};
use tauri_plugin_store::StoreExt;

const DB_URL: &str = "sqlite:hourglass.db";

// Device ID management: stable, per-device identifier stored in the app data
// directory. Used to pair two phones together.
#[tauri::command]
async fn get_or_create_device_id(app: tauri::AppHandle) -> Result<String, String> {
  let store = app.store("device.json").map_err(|e| e.to_string())?;

  if let Some(device_id) = store.get("device_id") {
    if let Some(id) = device_id.as_str() {
      return Ok(id.to_string());
    }
  }

  let device_id = format!("device_{}", uuid::Uuid::new_v4().simple());
  store.set("device_id", serde_json::Value::String(device_id.clone()));
  store.save().map_err(|e| e.to_string())?;

  Ok(device_id)
}

/// Fire a one-off notification at `unix` (seconds since epoch).
///
/// On mobile the OS keeps the schedule alive; on desktop the plugin has no
/// persistent scheduler, so a background thread sleeps until the time and
/// fires it - this only works while the app is running.
fn schedule_at(
  app: &tauri::AppHandle,
  unix: i64,
  title: &str,
  body: String,
) {
  #[cfg(mobile)]
  {
    use tauri_plugin_notification::Schedule;
    if let Ok(at) = time::OffsetDateTime::from_unix_timestamp(unix) {
      let _ = app
        .notification()
        .builder()
        .title(title)
        .body(body)
        .schedule(Schedule::At {
          date: at,
          repeating: false,
          allow_while_idle: true,
        })
        .show();
    }
  }

  #[cfg(desktop)]
  {
    let app = app.clone();
    let title = title.to_string();
    std::thread::spawn(move || {
      let wait = (unix - chrono::Utc::now().timestamp()).max(0) as u64;
      std::thread::sleep(std::time::Duration::from_secs(wait));
      let _ = app.notification().builder().title(title).body(body).show();
    });
  }
}

#[tauri::command]
async fn schedule_period_reminder(
  app: tauri::AppHandle,
  days_before: i64,
  period_start: String,
) -> Result<(), String> {
  let date = chrono::NaiveDate::parse_from_str(&period_start, "%Y-%m-%d")
    .map_err(|e| e.to_string())?;
  let at = date - chrono::Duration::days(days_before) + chrono::Duration::hours(9);

  let unix = at.and_utc().timestamp();
  if unix <= chrono::Utc::now().timestamp() {
    return Ok(()); // reminder date already passed
  }

  schedule_at(
    &app,
    unix,
    "Period Reminder",
    format!("Your period is expected to start in {} day(s)", days_before),
  );

  Ok(())
}

#[tauri::command]
async fn schedule_milestone_reminder(
  app: tauri::AppHandle,
  days_before: i64,
  milestone_date: String,
  title: String,
) -> Result<(), String> {
  let date = chrono::NaiveDate::parse_from_str(&milestone_date, "%Y-%m-%d")
    .map_err(|e| e.to_string())?;
  let at = date - chrono::Duration::days(days_before) + chrono::Duration::hours(9);

  let unix = at.and_utc().timestamp();
  if unix <= chrono::Utc::now().timestamp() {
    return Ok(()); // reminder date already passed
  }

  schedule_at(
    &app,
    unix,
    "Upcoming Milestone",
    format!("{} is in {} day(s)", title, days_before),
  );

  Ok(())
}

#[tauri::command]
async fn cancel_notifications(app: tauri::AppHandle) -> Result<(), String> {
  #[cfg(mobile)]
  {
    app.notification().cancel_all().map_err(|e| e.to_string())?;
  }

  #[cfg(desktop)]
  {
    app.notification().remove_all_active().map_err(|e| e.to_string())?;
  }

  Ok(())
}

/// Run a batch of `(sql, params)` statements inside a single transaction.
/// Either every statement applies or none of them does - use this for
/// multi-step writes such as a full data import.
#[tauri::command]
async fn execute_transaction(
  instances: State<'_, DbInstances>,
  queries: Vec<(String, Vec<serde_json::Value>)>,
) -> Result<(), String> {
  let instances = instances.0.read().await;
  let pool = instances.get(DB_URL).ok_or("Database not initialized")?;
  let DbPool::Sqlite(pool) = pool else {
    return Err("Unsupported database driver".into());
  };

  let mut conn = pool.acquire().await.map_err(|e| e.to_string())?;
  let mut tx = conn.begin().await.map_err(|e| e.to_string())?;

  for (sql, params) in queries {
    let mut query = sqlx::query(&sql);
    for param in params {
      query = match param {
        serde_json::Value::Null => query.bind(Option::<String>::None),
        serde_json::Value::Bool(b) => query.bind(b),
        serde_json::Value::Number(n) => {
          if let Some(i) = n.as_i64() {
            query.bind(i)
          } else if let Some(f) = n.as_f64() {
            query.bind(f)
          } else {
            query
          }
        }
        serde_json::Value::String(s) => query.bind(s),
        other => query.bind(other.to_string()),
      };
    }
    query.execute(&mut *tx).await.map_err(|e| e.to_string())?;
  }

  tx.commit().await.map_err(|e| e.to_string())?;
  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(
      tauri_plugin_sql::Builder::default()
        .add_migrations(
          DB_URL,
          vec![
            Migration {
              version: 1,
              description: "create_initial_tables",
              sql: include_str!("../migrations/001_initial.sql"),
              kind: MigrationKind::Up,
            },
            Migration {
              version: 2,
              description: "add_milestone_indexes",
              sql: include_str!("../migrations/002_add_indexes.sql"),
              kind: MigrationKind::Up,
            },
          ],
        )
        .build(),
    )
    .plugin(tauri_plugin_notification::init())
    .plugin(tauri_plugin_store::Builder::default().build())
    .plugin(tauri_plugin_clipboard_manager::init())
    .invoke_handler(tauri::generate_handler![
      get_or_create_device_id,
      schedule_period_reminder,
      schedule_milestone_reminder,
      cancel_notifications,
      execute_transaction,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
