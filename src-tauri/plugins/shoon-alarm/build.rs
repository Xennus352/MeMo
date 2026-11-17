fn main() {
  tauri_plugin::Builder::new(&[
    "schedule_shoon_alarm",
    "speak_text",
    "open_notification_settings",
    "cancel_all_shoon_alarms",
  ])
  .android_path("android")
  .build();
}
