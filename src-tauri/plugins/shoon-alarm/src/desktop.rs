use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

use crate::models::*;

pub fn init<R: Runtime, C: DeserializeOwned>(
  app: &AppHandle<R>,
  _api: PluginApi<R, C>,
) -> crate::Result<ShoonAlarm<R>> {
  Ok(ShoonAlarm(app.clone()))
}

/// Desktop stub — MeMo desktop keeps the in-app voice flow; alarms and TTS are Android-only.
pub struct ShoonAlarm<R: Runtime>(#[allow(dead_code)] AppHandle<R>);

impl<R: Runtime> ShoonAlarm<R> {
    pub fn schedule_alarm(&self, _payload: ShoonAlarmRequest) -> crate::Result<()> {
        Ok(())
    }

    pub fn speak_text(&self, _text: &str) -> crate::Result<()> {
        Ok(())
    }

    pub fn open_notification_settings(&self) -> crate::Result<()> {
        Ok(())
    }

    pub fn cancel_all(&self) -> crate::Result<()> {
        Ok(())
    }
}
