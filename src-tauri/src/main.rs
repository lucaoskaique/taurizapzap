// Copyright (c) 2022 Eray Erdin
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use app::{logging, memory, tray, window};

fn main() {
    logging::setup_logger().expect("Could not set up loggers.");
    log::info!("Launching app...");
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Create the main window (in Rust so we can enable native drag & drop
            // and prompt-on-download). Must happen before anything that looks up
            // the "main" window below.
            window::create_main_window(app.handle()).expect("Failed to create main window");

            // Setup system tray
            tray::setup_tray(app.handle()).expect("Failed to setup system tray");

            // Setup window event handlers
            window::setup_window_handlers(app.handle());

            // Clear cache on startup
            memory::clear_webview_cache(app.handle());

            // Start memory monitoring
            memory::start_memory_monitor(app.handle().clone());

            log::info!("Memory management initialized");

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
