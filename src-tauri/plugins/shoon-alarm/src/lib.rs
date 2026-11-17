use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager, Runtime,
};

pub use models::*;

// The real implementation lives in `mobile` on Android; every other platform
// (desktop and iOS) uses the `desktop` stub.
#[cfg(target_os = "android")]
mod mobile;
#[cfg(not(target_os = "android"))]
mod desktop;

mod commands;
mod error;
mod models;

pub use error::{Error, Result};

#[cfg(target_os = "android")]
use mobile::ShoonAlarm;
#[cfg(not(target_os = "android"))]
use desktop::ShoonAlarm;

/// Extends [`tauri::App`], [`tauri::AppHandle`] and [`tauri::Window`] with the
/// shoon-alarm APIs.
pub trait ShoonAlarmExt<R: Runtime> {
    fn shoon_alarm(&self) -> &ShoonAlarm<R>;
}

impl<R: Runtime, T: Manager<R>> ShoonAlarmExt<R> for T {
    fn shoon_alarm(&self) -> &ShoonAlarm<R> {
        self.state::<ShoonAlarm<R>>().inner()
    }
}

/// Initializes the plugin.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("shoon-alarm")
        .invoke_handler(tauri::generate_handler![
            commands::schedule_shoon_alarm,
            commands::speak_text,
            commands::open_notification_settings,
            commands::cancel_all_shoon_alarms,
        ])
        .setup(|app, api| {
            #[cfg(target_os = "android")]
            let shoon_alarm = mobile::init(app, api)?;
            #[cfg(not(target_os = "android"))]
            let shoon_alarm = desktop::init(app, api)?;
            app.manage(shoon_alarm);
            Ok(())
        })
        .build()
}
