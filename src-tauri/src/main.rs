#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
fn main() {
    if std::env::var_os("GIK_ASKPASS_ADDR").is_some() && std::env::args_os().len() > 1 {
        match gik_core::askpass::helper() {
            Ok(()) => (),
            Err(_) => std::process::exit(1),
        }
    } else {
        gik_core::desktop::run();
    }
}
