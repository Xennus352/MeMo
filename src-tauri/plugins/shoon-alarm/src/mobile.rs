use serde::de::DeserializeOwned;
use tauri::{
    plugin::{PluginApi, PluginHandle},
    AppHandle, Runtime,
};

use crate::models::*;

// initializes the Kotlin plugin class
pub fn init<R: Runtime, C: DeserializeOwned>(
  _app: &AppHandle<R>,
  api: PluginApi<R, C>,
) -> crate::Result<ShoonAlarm<R>> {
  let handle = api.register_android_plugin("app.tauri.shoonalarm", "ShoonAlarmPlugin")?;
  Ok(ShoonAlarm(handle))
}

/// Access to the shoon-alarm APIs.
pub struct ShoonAlarm<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> ShoonAlarm<R> {
    /// Schedule an alarm that wakes the process and speaks the reminder — even locked / app closed.
    pub fn schedule_alarm(&self, payload: ShoonAlarmRequest) -> crate::Result<()> {
        self.0.run_mobile_plugin("scheduleAlarm", payload).map_err(Into::into)
    }

    /// Speak `text` aloud through the device's own TTS (Burmese if available).
    pub fn speak_text(&self, text: &str) -> crate::Result<()> {
        self.0.run_mobile_plugin("speakText", serde_json::json!({ "text": text })).map_err(Into::into)
    }

    /// Open the app's system notification settings page.
    pub fn open_notification_settings(&self) -> crate::Result<()> {
        self.0.run_mobile_plugin("openNotificationSettings", ()).map_err(Into::into)
    }

    /// Remove every Shoon alarm.
    pub fn cancel_all(&self) -> crate::Result<()> {
        self.0.run_mobile_plugin("cancelAll", ()).map_err(Into::into)
    }
}
