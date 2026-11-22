use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Mutex;

/// 便携模式：exe 同目录存在 .portable 标记时，数据库存到 exe 旁的 Data/
pub fn resolve_db_path() -> std::path::PathBuf {
    crate::portable::data_dir().join("learn.db")
}

/// 启动时自动备份：距上次备份超过 24 小时且数据库有内容时，复制 db/wal/shm 三件套
pub fn maybe_backup(db_path: &std::path::Path) {
    if !db_path.exists() {
        return;
    }
    // WAL 模式下数据主要在 -wal 文件里，体积按三件套合计算
    let mut total: u64 = std::fs::metadata(db_path).map(|m| m.len()).unwrap_or(0);
    for ext in ["-wal", "-shm"] {
        let p = std::path::PathBuf::from(format!("{}{}", db_path.display(), ext));
        total += std::fs::metadata(&p).map(|m| m.len()).unwrap_or(0);
    }
    if total < 20_000 {
        return; // 空库/新库不备份
    }
    let bak = db_path.with_extension("db.bak");
    if std::fs::metadata(&bak).is_ok() {
        if let Ok(bm) = std::fs::metadata(&bak) {
            if let Ok(modified) = bm.modified() {
                if modified.elapsed().map(|d| d.as_secs() < 86400).unwrap_or(false) {
                    return; // 24 小时内已备份
                }
            }
        }
        // 超过 24 小时的旧备份允许覆盖，继续往下走
    }
    // 冷启动时 WAL 可能还有数据，三件套一起拷保证一致性
    let _ = std::fs::copy(db_path, &bak);
    for ext in ["-wal", "-shm"] {
        let src = std::path::PathBuf::from(format!("{}{}", db_path.display(), ext));
        if src.exists() {
            let dst = std::path::PathBuf::from(format!("{}{}", bak.display(), ext));
            let _ = std::fs::copy(src, dst);
        }
    }
}

pub struct Db(pub Mutex<Connection>);

pub fn open(path: &Path) -> Result<Connection, String> {
    let conn = Connection::open(path).map_err(|e| e.to_string())?;
    conn.execute_batch(
        "PRAGMA journal_mode=WAL;
         CREATE TABLE IF NOT EXISTS kv(key TEXT PRIMARY KEY, value TEXT NOT NULL);
         CREATE TABLE IF NOT EXISTS questions(
            id TEXT PRIMARY KEY, lang TEXT NOT NULL, title TEXT NOT NULL,
            difficulty INTEGER DEFAULT 1, statement_md TEXT DEFAULT '',
            starter_code TEXT DEFAULT '', hints TEXT DEFAULT '[]',
            editorial_md TEXT DEFAULT '', test_cases TEXT DEFAULT '[]',
            variant_cases TEXT DEFAULT '[]',
            tags TEXT DEFAULT '[]', source TEXT DEFAULT 'import');
         CREATE TABLE IF NOT EXISTS exams(
            id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, lang TEXT,
            duration_min INTEGER, question_ids TEXT, created_at TEXT);
         CREATE TABLE IF NOT EXISTS exam_results(
            id INTEGER PRIMARY KEY AUTOINCREMENT, exam_id INTEGER, title TEXT,
            score INTEGER, total INTEGER, detail TEXT, finished_at TEXT);
         CREATE TABLE IF NOT EXISTS mistakes(
            id INTEGER PRIMARY KEY AUTOINCREMENT, question_id TEXT UNIQUE,
            reason TEXT, created_at TEXT, resolved INTEGER DEFAULT 0);",
    )
    .map_err(|e| e.to_string())?;
    // 老库迁移：v1.4 新增 variant_cases 列（重复执行容错）
    let _ = conn.execute("ALTER TABLE questions ADD COLUMN variant_cases TEXT DEFAULT '[]'", []);
    Ok(conn)
}

fn with_db<T>(db: &Db, f: impl FnOnce(&Connection) -> Result<T, rusqlite::Error>) -> Result<T, String> {
    let guard = db.0.lock().unwrap_or_else(|p| p.into_inner());
    f(&guard).map_err(|e| e.to_string())
}

// ---------- kv（设置 + 阅读进度等） ----------

#[tauri::command]
pub fn kv_set(db: tauri::State<Db>, key: String, value: String) -> Result<(), String> {
    with_db(&db, |c| {
        c.execute(
            "INSERT INTO kv(key,value) VALUES(?1,?2) ON CONFLICT(key) DO UPDATE SET value=?2",
            params![key, value],
        )?;
        Ok(())
    })
}

#[tauri::command]
pub fn kv_get(db: tauri::State<Db>, key: String) -> Result<Option<String>, String> {
    with_db(&db, |c| {
        let mut stmt = c.prepare("SELECT value FROM kv WHERE key=?1")?;
        let mut rows = stmt.query(params![key])?;
        if let Some(row) = rows.next()? {
            Ok(Some(row.get(0)?))
        } else {
            Ok(None)
        }
    })
}

// ---------- 题库 ----------

#[derive(Serialize, Deserialize, Clone)]
pub struct ExpectFile {
    /// 相对判题沙盒的路径，如 figures/year_line.png
    pub path: String,
    #[serde(default)]
    pub min_bytes: Option<u64>,
    /// 要求的 DPI（仅 PNG，读 pHYs chunk）
    #[serde(default)]
    pub dpi: Option<u32>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct TestCase {
    pub stdin: String,
    pub expected_stdout: String,
    #[serde(default = "default_timeout")]
    pub timeout_ms: u64,
    /// 匹配模式：默认 exact（规范化后完全相等）；contains（输出包含期望子串，pandas 类题目用）
    #[serde(default)]
    pub match_mode: Option<String>,
    /// 文件产物检查：matplotlib 等"保存图片"型任务用
    #[serde(default)]
    pub expect_file: Option<ExpectFile>,
    /// SQL 题专用：建库建表与插入数据的初始化脚本
    #[serde(default)]
    pub setup_sql: Option<String>,
}
fn default_timeout() -> u64 {
    3000
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Question {
    pub id: String,
    pub lang: String,
    pub title: String,
    #[serde(default = "default_difficulty")]
    pub difficulty: i64,
    #[serde(default)]
    pub statement_md: String,
    #[serde(default)]
    pub starter_code: String,
    #[serde(default)]
    pub hints: Vec<String>,
    #[serde(default)]
    pub editorial_md: String,
    #[serde(default)]
    pub test_cases: Vec<TestCase>,
    /// 变体用例：错题"变体重做"时使用（换数字防背答案），为空则退回 test_cases
    #[serde(default)]
    pub variant_cases: Vec<TestCase>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub source: String,
}
fn default_difficulty() -> i64 {
    1
}

fn save_question(c: &Connection, q: &Question) -> rusqlite::Result<()> {
    c.execute(
        "INSERT INTO questions(id,lang,title,difficulty,statement_md,starter_code,hints,editorial_md,test_cases,variant_cases,tags,source)
         VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)
         ON CONFLICT(id) DO UPDATE SET lang=?2,title=?3,difficulty=?4,statement_md=?5,
           starter_code=?6,hints=?7,editorial_md=?8,test_cases=?9,variant_cases=?10,tags=?11,source=?12",
        params![
            q.id, q.lang, q.title, q.difficulty, q.statement_md, q.starter_code,
            serde_json::to_string(&q.hints).unwrap_or_default(),
            q.editorial_md,
            serde_json::to_string(&q.test_cases).unwrap_or_default(),
            serde_json::to_string(&q.variant_cases).unwrap_or_default(),
            serde_json::to_string(&q.tags).unwrap_or_default(),
            q.source
        ],
    )?;
    Ok(())
}

fn row_to_question(row: &rusqlite::Row) -> rusqlite::Result<Question> {
    Ok(Question {
        id: row.get("id")?,
        lang: row.get("lang")?,
        title: row.get("title")?,
        difficulty: row.get("difficulty")?,
        statement_md: row.get("statement_md")?,
        starter_code: row.get("starter_code")?,
        hints: serde_json::from_str(&row.get::<_, String>("hints")?).unwrap_or_default(),
        editorial_md: row.get("editorial_md")?,
        test_cases: serde_json::from_str(&row.get::<_, String>("test_cases")?).unwrap_or_default(),
        variant_cases: serde_json::from_str(&row.get::<_, String>("variant_cases").unwrap_or_default()).unwrap_or_default(),
        tags: serde_json::from_str(&row.get::<_, String>("tags")?).unwrap_or_default(),
        source: row.get("source")?,
    })
}

#[tauri::command]
pub fn upsert_question(db: tauri::State<Db>, question: Question) -> Result<(), String> {
    with_db(&db, |c| save_question(c, &question))
}

#[tauri::command]
pub fn list_questions(
    db: tauri::State<Db>,
    lang: Option<String>,
) -> Result<Vec<Question>, String> {
    with_db(&db, |c| {
        let mut stmt = c.prepare("SELECT * FROM questions ORDER BY difficulty, id")?;
        let rows = stmt.query_map([], row_to_question)?;
        let mut out: Vec<Question> = rows.filter_map(|r| r.ok()).collect();
        if let Some(l) = lang {
            out.retain(|q| q.lang == l);
        }
        Ok(out)
    })
}

/// 导入题库文件夹：每个 .json 文件可以是单题或题目数组
#[tauri::command]
pub fn import_bank(db: tauri::State<Db>, dir: String) -> Result<usize, String> {
    import_dir_questions(&db, dir)
}

/// 核心导入：遍历目录把题目 JSON 入库（import_bank 与语言包安装共用）
pub fn import_dir_questions(db: &Db, dir: String) -> Result<usize, String> {
    let mut count = 0usize;
    for entry in std::fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        let text = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let parsed: Result<Question, _> = serde_json::from_str(&text);
        let questions: Vec<Question> = match parsed {
            Ok(q) => vec![q],
            Err(_) => serde_json::from_str(&text).map_err(|e| {
                format!("{} 解析失败: {}（需为单题对象或题目数组）", path.display(), e)
            })?,
        };
        with_db(db, |c| {
            for q in &questions {
                let mut q = q.clone();
                if q.source.is_empty() {
                    q.source = "import".into();
                }
                save_question(c, &q)?;
                count += 1;
            }
            Ok(())
        })?;
    }
    Ok(count)
}

// ---------- 试卷 ----------

#[derive(Serialize)]
pub struct Exam {
    pub id: i64,
    pub title: String,
    pub lang: String,
    pub duration_min: i64,
    pub question_ids: Vec<String>,
}

/// 加权抽题：未解决错题数越多权重越高（weight = 1 + 2*mistakes）
#[tauri::command]
pub fn create_exam(
    db: tauri::State<Db>,
    lang: String,
    count: i64,
    duration_min: i64,
    title: String,
    created_at: String,
) -> Result<Exam, String> {
    let lang_for_err = lang.clone();
    let exam = with_db(&db, |c| {
        let mut stmt = c.prepare("SELECT * FROM questions WHERE lang=?1")?;
        let all: Vec<Question> = stmt
            .query_map(params![lang], row_to_question)?
            .filter_map(|r| r.ok())
            .collect();
        if all.is_empty() {
            return Err(rusqlite::Error::InvalidQuery);
        }

        let mut weights: Vec<(usize, f64)> = Vec::new();
        for (i, q) in all.iter().enumerate() {
            let mut stmt = c
                .prepare("SELECT COUNT(*) FROM mistakes WHERE question_id=?1 AND resolved=0")?;
            let m: i64 = stmt.query_row(params![q.id], |r| r.get(0)).unwrap_or(0);
            weights.push((i, 1.0 + 2.0 * m as f64));
        }

        // 简易 xorshift 随机（按时间播种）
        let mut seed = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos() as u64)
            .unwrap_or(88172645463325252);
        let mut rng = move || {
            seed ^= seed << 13;
            seed ^= seed >> 7;
            seed ^= seed << 17;
            seed
        };

        let n = count.min(all.len() as i64) as usize;
        let mut chosen: Vec<usize> = Vec::new();
        let mut pool = weights.clone();
        for _ in 0..n {
            let total: f64 = pool.iter().map(|(_, w)| *w).sum();
            if total <= 0.0 {
                break;
            }
            let mut pick = (rng() % 100_000) as f64 / 100_000.0 * total;
            let mut idx = 0usize;
            for (pos, (_, w)) in pool.iter().enumerate() {
                pick -= *w;
                if pick <= 0.0 {
                    idx = pos;
                    break;
                }
            }
            chosen.push(pool[idx].0);
            pool.remove(idx);
            if pool.is_empty() {
                break;
            }
        }

        let qids: Vec<String> = chosen.iter().map(|&i| all[i].id.clone()).collect();
        let exam_title = if title.is_empty() {
            format!("{} 模拟考", lang)
        } else {
            title
        };
        c.execute(
            "INSERT INTO exams(title,lang,duration_min,question_ids,created_at) VALUES(?1,?2,?3,?4,?5)",
            params![
                exam_title,
                lang,
                duration_min,
                serde_json::to_string(&qids).unwrap_or_default(),
                created_at
            ],
        )?;
        Ok(Exam {
            id: c.last_insert_rowid(),
            title: exam_title,
            lang,
            duration_min,
            question_ids: qids,
        })
    })
    .map_err(|e: String| if e.contains("empty") || e.contains("Query") {
        format!("题库中没有 {} 语言的题目，请先导入题库", lang_for_err)
    } else {
        e
    })?;
    Ok(exam)
}

// ---------- 成绩与错题 ----------

#[derive(Serialize, Deserialize, Clone)]
pub struct JudgeDetail {
    pub question_id: String,
    pub passed: bool,
    pub cases_passed: i64,
    pub cases_total: i64,
}

#[tauri::command]
pub fn save_exam_result(
    db: tauri::State<Db>,
    exam_id: i64,
    title: String,
    score: i64,
    total: i64,
    detail: Vec<JudgeDetail>,
    finished_at: String,
) -> Result<(), String> {
    with_db(&db, |c| {
        c.execute(
            "INSERT INTO exam_results(exam_id,title,score,total,detail,finished_at) VALUES(?1,?2,?3,?4,?5,?6)",
            params![
                exam_id,
                title,
                score,
                total,
                serde_json::to_string(&detail).unwrap_or_default(),
                finished_at
            ],
        )?;
        Ok(())
    })
}

#[derive(Serialize)]
pub struct ExamResultRow {
    pub id: i64,
    pub exam_id: i64,
    pub title: String,
    pub score: i64,
    pub total: i64,
    pub finished_at: String,
    pub detail: String,
}

#[tauri::command]
pub fn list_exam_results(db: tauri::State<Db>) -> Result<Vec<ExamResultRow>, String> {
    with_db(&db, |c| {
        let mut stmt = c.prepare(
            "SELECT id,exam_id,title,score,total,finished_at,detail FROM exam_results ORDER BY id DESC LIMIT 100",
        )?;
        let rows = stmt.query_map([], |r| {
            Ok(ExamResultRow {
                id: r.get(0)?,
                exam_id: r.get(1)?,
                title: r.get(2)?,
                score: r.get(3)?,
                total: r.get(4)?,
                finished_at: r.get(5)?,
                detail: r.get::<_, Option<String>>(6)?.unwrap_or_default(),
            })
        })?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    })
}

#[tauri::command]
pub fn add_mistake(
    db: tauri::State<Db>,
    question_id: String,
    reason: String,
    created_at: String,
) -> Result<(), String> {
    with_db(&db, |c| {
        c.execute(
            "INSERT OR IGNORE INTO mistakes(question_id,reason,created_at,resolved) VALUES(?1,?2,?3,0)",
            params![question_id, reason, created_at],
        )?;
        Ok(())
    })
}

#[derive(Serialize)]
pub struct MistakeRow {
    pub id: i64,
    pub question_id: String,
    pub reason: String,
    pub created_at: String,
    pub resolved: i64,
    pub question: Option<Question>,
}

#[tauri::command]
pub fn list_mistakes(db: tauri::State<Db>) -> Result<Vec<MistakeRow>, String> {
    with_db(&db, |c| {
        let mut stmt = c.prepare(
            "SELECT m.id, m.question_id, m.reason, m.created_at, m.resolved, q.id
             FROM mistakes m LEFT JOIN questions q ON q.id = m.question_id
             ORDER BY m.resolved ASC, m.id DESC",
        )?;
        let rows = stmt.query_map([], |r| {
            Ok((
                r.get::<_, i64>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
                r.get::<_, i64>(4)?,
                r.get::<_, Option<String>>(5)?,
            ))
        })?;
        let mut out = Vec::new();
        for r in rows.filter_map(|r| r.ok()) {
            let question = if r.5.is_some() {
                let mut qstmt =
                    c.prepare("SELECT * FROM questions WHERE id=?1")?;
                qstmt
                    .query_row(params![r.1], row_to_question)
                    .ok()
            } else {
                None
            };
            out.push(MistakeRow {
                id: r.0,
                question_id: r.1,
                reason: r.2,
                created_at: r.3,
                resolved: r.4,
                question,
            });
        }
        Ok(out)
    })
}

#[tauri::command]
pub fn resolve_mistake(db: tauri::State<Db>, id: i64) -> Result<(), String> {
    with_db(&db, |c| {
        c.execute("UPDATE mistakes SET resolved=1 WHERE id=?1", params![id])?;
        Ok(())
    })
}

/// 做对题目时自动解除该题的错题记录
#[tauri::command]
pub fn resolve_mistake_by_question(db: tauri::State<Db>, question_id: String) -> Result<(), String> {
    with_db(&db, |c| {
        c.execute(
            "UPDATE mistakes SET resolved=1 WHERE question_id=?1 AND resolved=0",
            params![question_id],
        )?;
        Ok(())
    })
}

/// 容错批量导入：第三方语言包里个别坏 JSON 不应毁掉整个安装
pub fn import_bank_lenient(db: &Db, dir: String) -> Result<(usize, usize, Vec<String>), String> {
    let mut imported = 0usize;
    let mut skipped = 0usize;
    let mut errors: Vec<String> = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("json") {
                continue;
            }
            let text = match std::fs::read_to_string(&path) {
                Ok(t) => t,
                Err(e) => { skipped += 1; errors.push(format!("{}: {}", path.display(), e)); continue; }
            };
            let questions: Vec<Question> = match serde_json::from_str(&text) {
                Ok(q) => vec![q],
                Err(_) => match serde_json::from_str(&text) {
                    Ok(v) => v,
                    Err(e) => { skipped += 1; errors.push(format!("{}: {}", path.display(), e)); continue; }
                },
            };
            with_db(db, |c| {
                for q in &questions {
                    if q.id.trim().is_empty() { continue; }
                    save_question(c, q)?;
                }
                Ok(())
            }).unwrap_or_else(|e| { skipped += questions.len(); errors.push(e); });
            imported += questions.len();
        }
    }
    Ok((imported, skipped, errors))
}

/// 按语言删除题目及其错题（语言包卸载用）
pub fn delete_questions_by_langs(db: &Db, langs: Vec<String>) -> Result<usize, String> {
    if langs.is_empty() {
        return Ok(0);
    }
    let placeholders = langs.iter().map(|_| "?".to_string()).collect::<Vec<_>>().join(",");
    with_db(db, |c| {
        c.execute(
            &format!("DELETE FROM mistakes WHERE question_id IN (SELECT id FROM questions WHERE lang IN ({placeholders}))"),
            rusqlite::params_from_iter(langs.iter()),
        )?;
        let n = c.execute(
            &format!("DELETE FROM questions WHERE lang IN ({placeholders})"),
            rusqlite::params_from_iter(langs.iter()),
        )?;
        Ok(n as usize)
    })
}
