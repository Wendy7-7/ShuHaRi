mod ai;
mod db;
mod files;
mod judge;
mod langpack;
mod sandbox;
mod portable;
mod pty;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 崩溃日志：panic 时把现场写入 数据目录/crash.log（便携版在 U 盘里，换机也能带走）
    std::panic::set_hook(Box::new(|info| {
        use std::io::Write;
        let dir = crate::portable::data_dir();
        let _ = std::fs::create_dir_all(&dir);
        let ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        let msg = format!("[unix:{ts}] {info}\n");
        if let Ok(mut f) = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(dir.join("crash.log"))
        {
            let _ = f.write_all(msg.as_bytes());
        }
    }));

    // 确保数据目录存在（便携模式落在 exe 同目录 Data/）
    let db_path = db::resolve_db_path();
    db::maybe_backup(&db_path);
    let conn = db::open(&db_path).expect("初始化数据库失败");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(pty::PtyState::default())
        .manage(db::Db(std::sync::Mutex::new(conn)))
        .invoke_handler(tauri::generate_handler![
            pty::pty_start,
            pty::pty_write,
            pty::pty_resize,
            files::read_file,
            files::save_file,
            files::list_dir,
            files::rename_file,
            files::delete_file,
            db::kv_set,
            db::kv_get,
            db::upsert_question,
            db::list_questions,
            db::import_bank,
            db::create_exam,
            db::save_exam_result,
            db::list_exam_results,
            db::add_mistake,
            db::list_mistakes,
            db::resolve_mistake,
            db::resolve_mistake_by_question,
            judge::judge,
            judge::check_toolchain,
            portable::app_info,
            ai::ai_chat,
            ai::ai_chat_stream,
            langpack::list_langpacks,
            langpack::list_custom_langs,
            langpack::install_langpack,
            langpack::uninstall_langpack
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
