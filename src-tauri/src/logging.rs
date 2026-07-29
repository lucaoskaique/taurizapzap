// Copyright (c) 2022 Eray Erdin
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

use std::fs;
use std::path::PathBuf;

fn get_log_dir() -> PathBuf {
    let mut path = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("taurizapzap");
    path.push("logs");
    path
}

pub fn setup_logger() -> Result<(), fern::InitError> {
    // Create logs directory
    let log_dir = get_log_dir();
    fs::create_dir_all(&log_dir).ok();

    // Setup rotating log file
    let log_file = log_dir.join("taurizapzap.log");

    // Delete old log if it's larger than 10MB
    if let Ok(metadata) = fs::metadata(&log_file) {
        if metadata.len() > 10_000_000 {
            fs::remove_file(&log_file).ok();
        }
    }

    fern::Dispatch::new()
        .format(|out, message, record| {
            out.finish(format_args!(
                "{}[{}][{}] {}",
                chrono::Local::now().format("[%Y-%m-%d][%H:%M:%S]"),
                record.target(),
                record.level(),
                message
            ))
        })
        .level(log::LevelFilter::Info)
        .chain(fern::log_file(&log_file)?)
        .apply()?;

    log::info!("Logger initialized. Log file: {:?}", log_file);
    Ok(())
}
