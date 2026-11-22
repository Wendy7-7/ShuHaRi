// 语言包：工具链 + 题库按语言独立打包，装哪个用哪个（GitHub Releases 分发）
use crate::db::Db;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct JudgeSpec {
    /// 自定义语言标识（题目 lang 字段用这个值）
    pub lang: String,
    /// 语言下拉显示名
    pub display: String,
    /// 编译命令模板（可空；{src} 源文件 {out} 输出文件）
    #[serde(default)]
    pub compile: Option<String>,
    /// 运行命令模板（必填；{src} 源文件；经空白拆分，不走 shell）
    pub run: String,
    /// 判题额外超时余量（毫秒）
    #[serde(default)]
    pub timeout_bonus_ms: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LangPackManifest {
    /// 插件规范版本（当前为 1，主程序不认识的一律拒装）
    #[serde(default)]
    pub spec_version: u32,
    pub id: String,
    pub name: String,
    pub version: String,
    /// 第三方判题执行器声明：让新语言不改主程序即可接入
    #[serde(default)]
    pub judge: Option<JudgeSpec>,
    /// Runtime/ 下的子目录（如 ["python"]），卸载时整目录删除
    #[serde(default)]
    pub runtime_dirs: Vec<String>,
    /// zip 中 bank/ 目录下的题目文件 → 解压到 workspace/bank
    #[serde(default)]
    pub bank_langs: Vec<String>,
    /// 提示信息
    #[serde(default)]
    pub description: String,
    /// 安装时写入 bank 的文件名（卸载时物理删除，防重启自动重导入）
    #[serde(default)]
    pub bank_files: Vec<String>,
}

#[derive(Serialize)]
pub struct LangPackInfo {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub questions: i64,
    pub runtime_present: bool,
    pub runtime_mb: u64,
}

fn runtime_root() -> std::path::PathBuf {
    let exe = std::env::current_exe().unwrap_or_default();
    let dir = exe.parent().unwrap_or(&exe).to_path_buf();
    let portable = dir.join(".portable");
    if portable.exists() {
        dir.join("Runtime")
    } else {
        dir.join("Runtime")
    }
}

fn dir_size(p: &std::path::Path) -> u64 {
    let mut total = 0;
    if let Ok(entries) = std::fs::read_dir(p) {
        for e in entries.flatten() {
            let path = e.path();
            if path.is_dir() {
                total += dir_size(&path);
            } else if let Ok(m) = e.metadata() {
                total += m.len();
            }
        }
    }
    total
}

fn kv_put(db: &Db, key: &str, value: &str) -> Result<(), String> {
    let guard = db.0.lock().unwrap_or_else(|p| p.into_inner());
    guard
        .execute(
            "INSERT INTO kv(key,value) VALUES(?1,?2) ON CONFLICT(key) DO UPDATE SET value=?2",
            [key, value],
        )
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn kv_get(db: &Db, key: &str) -> Option<String> {
    let guard = db.0.lock().unwrap_or_else(|p| p.into_inner());
    guard
        .query_row("SELECT value FROM kv WHERE key=?1", [key], |r| {
            r.get::<_, String>(0)
        })
        .ok()
}

/// 列出已安装语言包（以 kv 里的 manifest 为准）
#[tauri::command]
pub fn list_langpacks(db: State<'_, Db>) -> Result<Vec<LangPackInfo>, String> {
    let guard = db.0.lock().unwrap_or_else(|p| p.into_inner());
    let mut out = Vec::new();
    let rows: Vec<(String, String)> = guard
        .prepare("SELECT key,value FROM kv WHERE key LIKE 'langpack:%'")
        .map_err(|e| e.to_string())?
        .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    for (_k, v) in rows {
        if let Ok(m) = serde_json::from_str::<LangPackManifest>(&v) {
            let placeholders = m
                .bank_langs
                .iter()
                .map(|_| "?".to_string())
                .collect::<Vec<_>>()
                .join(",");
            let count = if m.bank_langs.is_empty() {
                0
            } else {
                let mut stmt = guard
                    .prepare(&format!(
                        "SELECT COUNT(*) FROM questions WHERE lang IN ({placeholders})"
                    ))
                    .map_err(|e| e.to_string())?;
                let params: Vec<&str> = m.bank_langs.iter().map(|s| s.as_str()).collect();
                stmt.query_row(rusqlite::params_from_iter(params), |r| r.get::<_, i64>(0))
                    .unwrap_or(0)
            };
            let rt = runtime_root().join(m.runtime_dirs.first().map(|s| s.as_str()).unwrap_or(""));
            out.push(LangPackInfo {
                id: m.id,
                name: m.name,
                version: m.version,
                description: m.description,
                questions: count,
                runtime_present: rt.exists(),
                runtime_mb: if rt.exists() { dir_size(&rt) / 1024 / 1024 } else { 0 },
            });
        }
    }
    Ok(out)
}

/// 从 zip 安装语言包：runtime/* → Runtime/，bank/* → workspace/bank，workspace/* → workspace/
#[tauri::command]
pub fn install_langpack(db: State<'_, Db>, zip_path: String) -> Result<serde_json::Value, String> {
    let file = std::fs::File::open(&zip_path).map_err(|e| format!("打开语言包失败: {}", e))?;
    let mut zip = zip::ZipArchive::new(file).map_err(|e| format!("读取 zip 失败: {}", e))?;

    // 1. 先找 manifest
    let mut manifest: Option<LangPackManifest> = None;
    for i in 0..zip.len() {
        let mut f = zip
            .by_index(i)
            .map_err(|e| format!("读取 manifest 失败: {}", e))?;
        let name = f.name().map_err(|e| e.to_string())?.replace('\\', "/");
        if name == "manifest.json" || name.ends_with("/manifest.json") {
            let mut buf = String::new();
            std::io::Read::read_to_string(&mut f, &mut buf).map_err(|e| e.to_string())?;
            manifest = Some(serde_json::from_str(&buf).map_err(|e| format!("manifest 格式错误: {}", e))?);
            break;
        }
    }
    let mut manifest = manifest.ok_or("语言包缺少 manifest.json")?;

    // —— 规范校验：不合规的包直接拒装（框架对第三方包的第一道闸）
    if manifest.spec_version != 1 {
        return Err(format!("语言包 spec_version={} 不受支持（本程序兼容 spec 1），请更新程序或换包", manifest.spec_version));
    }
    if manifest.id.is_empty()
        || manifest.id.len() > 32
        || !manifest.id.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
    {
        return Err(format!("语言包 id 「{}」不合法（仅小写字母/数字/连字符，≤32 字符）", manifest.id));
    }

    // 2. 目标目录
    let exe = std::env::current_exe().unwrap_or_default();
    let base = exe.parent().unwrap_or(&exe).to_path_buf();
    let (runtime_dir, workspace) = if base.join(".portable").exists() {
        (base.join("Runtime"), base.join("workspace"))
    } else {
        // 桌面版：工作区在用户目录 learn-workspace，工具链放安装目录 Runtime（或依赖 PATH）
        (base.join("Runtime"), crate::portable::default_workspace())
    };
    std::fs::create_dir_all(&runtime_dir).map_err(|e| e.to_string())?;
    std::fs::create_dir_all(workspace.join("bank")).map_err(|e| e.to_string())?;

    // 3. 解压
    let mut questions = 0usize;
    let mut files = 0usize;
    let mut bank_files: Vec<String> = Vec::new();
    for i in 0..zip.len() {
        let mut entry = zip.by_index(i).map_err(|e| e.to_string())?;
        let name = entry.name().map_err(|e| e.to_string())?.replace('\\', "/");
        if entry.is_dir() || name == "manifest.json" {
            continue;
        }
        // 统一路径分隔，取 zip 内相对路径
        let rel = name.trim_start_matches('/');
        let target = if let Some(rest) = rel.strip_prefix("runtime/") {
            runtime_dir.join(rest)
        } else if let Some(rest) = rel.strip_prefix("bank/") {
            if rest.ends_with(".json") {
                questions += 1;
                bank_files.push(rest.to_string());
            }
            workspace.join("bank").join(rest)
        } else if let Some(rest) = rel.strip_prefix("workspace/") {
            workspace.join(rest)
        } else {
            continue; // 未知顶层文件跳过
        };
        if let Some(parent) = target.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let mut out = std::fs::File::create(&target).map_err(|e| format!("写入 {} 失败: {}", target.display(), e))?;
        std::io::copy(&mut entry, &mut out).map_err(|e| e.to_string())?;
        files += 1;
    }

    // 4. 题目入库（容错：个别坏 JSON 跳过，不毁整个安装）
    let (imported, skipped, errors) = crate::db::import_bank_lenient(&db, workspace.join("bank").to_string_lossy().to_string())?;
    if errors.len() > 0 {
        eprintln!("[langpack] 题目文件告警: {:?}", errors);
    }

    // 5. 第三方判题执行器注册（文件系统注册表，判题器不依赖 DB）
    if let Some(j) = manifest.judge.clone() {
        let langs_dir = base.join("langs");
        std::fs::create_dir_all(&langs_dir).map_err(|e| e.to_string())?;
        let reg = serde_json::to_string(&j).unwrap_or_default();
        std::fs::write(langs_dir.join(format!("{}.json", j.lang)), reg).map_err(|e| e.to_string())?;
    }

    // 6. 记录 manifest 供卸载（含物理文件清单）
    let mut manifest = manifest;
    manifest.bank_files = bank_files;
    kv_put(
        &db,
        &format!("langpack:{}", manifest.id),
        &serde_json::to_string(&manifest).unwrap_or_default(),
    )?;

    Ok(serde_json::json!({
        "id": manifest.id,
        "name": manifest.name,
        "files": files,
        "bankJson": questions,
        "imported": imported,
        "skipped": skipped,
    }))
}

/// 卸载语言包：删除工具链目录 + 该语言题目与错题（学习资料保留）
#[tauri::command]
pub fn uninstall_langpack(db: State<'_, Db>, pack_id: String) -> Result<serde_json::Value, String> {
    let key = format!("langpack:{}", pack_id);
    let raw = kv_get(&db, &key).ok_or("该语言包未安装（或不是通过语言包安装的）")?;
    let m: LangPackManifest = serde_json::from_str(&raw).map_err(|e| e.to_string())?;

    // 删工具链
    let mut removed_mb = 0u64;
    for d in &m.runtime_dirs {
        let dir = runtime_root().join(d);
        if dir.exists() {
            removed_mb += dir_size(&dir);
            std::fs::remove_dir_all(&dir).map_err(|e| format!("删除 {} 失败: {}", dir.display(), e))?;
        }
    }
    // 删第三方判题注册 + 物理删除 bank 里的题目文件（防止重启空库时自动重导入）
    let exe_u = std::env::current_exe().unwrap_or_default();
    let base_u = exe_u.parent().unwrap_or(&exe_u).to_path_buf();
    if let Some(j) = &m.judge {
        let _ = std::fs::remove_file(base_u.join("langs").join(format!("{}.json", j.lang)));
    }
    let ws_u = if base_u.join(".portable").exists() { base_u.join("workspace") } else { crate::portable::default_workspace() };
    for f in &m.bank_files {
        let _ = std::fs::remove_file(ws_u.join("bank").join(f));
    }
    // 删题目与错题
    let removed_questions = crate::db::delete_questions_by_langs(&db, m.bank_langs.clone())?;
    // 清 manifest 记录
    let guard = db.0.lock().unwrap_or_else(|p| p.into_inner());
    guard.execute("DELETE FROM kv WHERE key=?1", [&key]).map_err(|e| e.to_string())?;

    Ok(serde_json::json!({
        "id": m.id,
        "removedQuestions": removed_questions,
        "freedMb": removed_mb / 1024 / 1024,
    }))
}

/// 列出已注册的第三方语言（语言包安装时写入 langs/，供前端下拉动态追加）
#[tauri::command]
pub fn list_custom_langs() -> Result<Vec<serde_json::Value>, String> {
    let exe = std::env::current_exe().unwrap_or_default();
    let dir = exe.parent().unwrap_or(&exe).join("langs");
    let mut out = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&dir) {
        for e in entries.flatten() {
            if let Ok(text) = std::fs::read_to_string(e.path()) {
                if let Ok(j) = serde_json::from_str::<JudgeSpec>(&text) {
                    out.push(serde_json::json!({ "lang": j.lang, "display": j.display }));
                }
            }
        }
    }
    Ok(out)
}
