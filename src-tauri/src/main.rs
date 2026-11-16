#![cfg_attr(
  all(not(debug_assertions), target_os = "android"),
  allow(unused_imports)
)]

fn main() {
  hourglass_lib::run();
}
