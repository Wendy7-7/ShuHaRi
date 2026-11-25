use crate::db::{ExpectCsv, ExpectJson};
use serde_json::Value;
use std::path::{Component, Path, PathBuf};

/// 所有产物类型共用路径边界检查；不将临时目录称为完整安全沙箱。
pub(crate) fn output_path(root: &Path, relative: &str) -> Result<PathBuf, String> {
    let path = Path::new(relative);
    if path.as_os_str().is_empty()
        || relative.contains('\\')
        || relative.contains(':')
        || path.is_absolute()
        || path.components().any(|c| !matches!(c, Component::Normal(_)))
    {
        return Err(format!("判题配置错误: 输出路径必须是用例目录内的相对路径: {relative}"));
    }
    let mut cursor = root.to_path_buf();
    for component in path.components() {
        cursor.push(component.as_os_str());
        let metadata = std::fs::symlink_metadata(&cursor)
            .map_err(|e| format!("产物缺失或路径不可读 {relative}: {e}"))?;
        if metadata.file_type().is_symlink() {
            return Err(format!("输出路径不能经过符号链接: {relative}"));
        }
        #[cfg(windows)]
        {
            use std::os::windows::fs::MetadataExt;
            if metadata.file_attributes() & 0x400 != 0 {
                return Err(format!("输出路径不能经过重解析点: {relative}"));
            }
        }
    }
    if !std::fs::metadata(&cursor).map_err(|e| e.to_string())?.is_file() {
        return Err(format!("产物必须是普通文件: {relative}"));
    }
    let canonical_root = root.canonicalize()
        .map_err(|e| format!("判题配置错误: 无法解析用例目录: {e}"))?;
    let canonical_output = cursor.canonicalize()
        .map_err(|e| format!("无法解析产物路径 {relative}: {e}"))?;
    if !canonical_output.starts_with(canonical_root) {
        return Err(format!("产物越出用例目录: {relative}"));
    }
    Ok(cursor)
}

pub fn validate_json(root: &Path, spec: &ExpectJson) -> Result<(), String> {
    validate_tolerances(spec.abs_tol, spec.rel_tol)?;
    let path = output_path(root, &spec.path)?;
    let metadata = std::fs::metadata(&path).map_err(|e| format!("JSON 产物缺失或不可读 {}: {e}", spec.path))?;
    if !metadata.is_file() || metadata.len() > 10_000_000 {
        return Err(format!("JSON 产物必须是小于 10 MB 的普通文件: {}", spec.path));
    }
    let bytes = std::fs::read(&path).map_err(|e| format!("读取 JSON 产物失败: {e}"))?;
    let actual: Value = serde_json::from_slice(&bytes).map_err(|e| format!("JSON 格式错误: {e}"))?;
    compare_json(&spec.value, &actual, spec.abs_tol, spec.rel_tol, "$")
}

fn compare_json(expected: &Value, actual: &Value, abs_tol: f64, rel_tol: f64, at: &str) -> Result<(), String> {
    match (expected, actual) {
        (Value::Number(e), Value::Number(a)) => {
            // 整数必须先精确比较：>2^53 的整数转 f64 会丢精度，
            // 否则 9007199254740993 与 9007199254740992 会被判成相等。
            if let (Some(ei), Some(ai)) = (e.as_i64(), a.as_i64()) {
                if ei == ai {
                    return Ok(());
                }
                let diff = (ei as i128 - ai as i128).unsigned_abs() as f64;
                let limit = abs_tol.max(rel_tol * (ei as f64).abs());
                if limit > 0.0 && diff <= limit {
                    return Ok(());
                }
                return Err(format!("{at} 整数不符: 期望 {ei}, 实际 {ai}"));
            }
            if let (Some(eu), Some(au)) = (e.as_u64(), a.as_u64()) {
                if eu == au {
                    return Ok(());
                }
                let diff = (eu as i128 - au as i128).unsigned_abs() as f64;
                let limit = abs_tol.max(rel_tol * (eu as f64).abs());
                if limit > 0.0 && diff <= limit {
                    return Ok(());
                }
                return Err(format!("{at} 整数不符: 期望 {eu}, 实际 {au}"));
            }
            let e = e.as_f64().ok_or_else(|| format!("期望值不是有限数字: {at}"))?;
            let a = a.as_f64().ok_or_else(|| format!("实际值不是有限数字: {at}"))?;
            if !e.is_finite() || !a.is_finite() || (e - a).abs() > abs_tol.max(rel_tol * e.abs()) {
                return Err(format!("{at} 数值不符: 期望 {e}, 实际 {a}"));
            }
            Ok(())
        }
        (Value::Object(e), Value::Object(a)) => {
            if e.len() != a.len() || e.keys().any(|key| !a.contains_key(key)) {
                return Err(format!("{at} 对象字段不符"));
            }
            for (key, value) in e {
                compare_json(value, &a[key], abs_tol, rel_tol, &format!("{at}.{key}"))?;
            }
            Ok(())
        }
        (Value::Array(e), Value::Array(a)) => {
            if e.len() != a.len() { return Err(format!("{at} 数组长度不符: 期望 {}, 实际 {}", e.len(), a.len())); }
            for (i, (e, a)) in e.iter().zip(a).enumerate() {
                compare_json(e, a, abs_tol, rel_tol, &format!("{at}[{i}]"))?;
            }
            Ok(())
        }
        _ if expected == actual => Ok(()),
        _ => Err(format!("{at} 值不符: 期望 {expected}, 实际 {actual}")),
    }
}

pub fn validate_csv(root: &Path, spec: &ExpectCsv) -> Result<(), String> {
    validate_tolerances(spec.abs_tol, spec.rel_tol)?;
    if spec.columns.is_empty() {
        return Err("判题配置错误: CSV 至少需要声明一列".into());
    }
    let unique_columns: std::collections::HashSet<_> = spec.columns.iter().collect();
    if unique_columns.len() != spec.columns.len() { return Err("判题配置错误: CSV 期望列名重复".into()); }
    let unique_keys: std::collections::HashSet<_> = spec.key_columns.iter().collect();
    if unique_keys.len() != spec.key_columns.len() { return Err("判题配置错误: CSV 稳定键列重复".into()); }
    for key in &spec.key_columns {
        if !spec.columns.contains(key) { return Err(format!("判题配置错误: 稳定键列未在期望列中声明: {key}")); }
    }
    for (index, row) in spec.rows.iter().enumerate() {
        let object = row.as_object().ok_or_else(|| format!("判题配置错误: 期望 CSV 第 {} 行必须是对象", index + 1))?;
        if object.len() != spec.columns.len() || spec.columns.iter().any(|column| !object.contains_key(column)) {
            return Err(format!("判题配置错误: 期望 CSV 第 {} 行字段与 columns 不一致", index + 1));
        }
        if object.values().any(|value| value.is_array() || value.is_object()) {
            return Err(format!("判题配置错误: 期望 CSV 第 {} 行单元格必须是标量或 null", index + 1));
        }
        for key in &spec.key_columns {
            if csv_cell(&object[key]).text.trim().is_empty() {
                return Err(format!("判题配置错误: 期望 CSV 第 {} 行稳定键 {key} 缺失", index + 1));
            }
        }
    }
    if !spec.key_columns.is_empty() {
        let indexes: Vec<usize> = spec.key_columns.iter().map(|key| spec.columns.iter().position(|c| c == key).unwrap()).collect();
        let mut keys = std::collections::HashSet::new();
        for row in &spec.rows {
            let object = row.as_object().expect("CSV row shape checked above");
            let key = indexes.iter().map(|index| csv_cell(&object[&spec.columns[*index]]).text).collect::<Vec<_>>();
            if !keys.insert(key) {
                return Err("判题配置错误: 期望 CSV 稳定键重复".into());
            }
        }
    }
    let path = output_path(root, &spec.path)?;
    let metadata = std::fs::metadata(&path).map_err(|e| format!("CSV 产物缺失或不可读 {}: {e}", spec.path))?;
    if !metadata.is_file() || metadata.len() > 50_000_000 {
        return Err(format!("CSV 产物必须是小于 50 MB 的普通文件: {}", spec.path));
    }
    let mut reader = csv::Reader::from_path(&path).map_err(|e| format!("CSV 解析失败: {e}"))?;
    let headers = reader.headers().map_err(|e| format!("读取 CSV 列名失败: {e}"))?.clone();
    // 教程统一推荐 encoding="utf-8-sig"（Excel 打开不乱码），它会在文件头写 BOM，
    // csv 读取时 BOM 会粘在第一列列名上。这里剥掉，避免学生照教程做反被判「列名不符」。
    let actual_headers: Vec<&str> = headers
        .iter()
        .map(|h| h.trim_start_matches('\u{feff}'))
        .collect();
    if actual_headers != spec.columns.iter().map(String::as_str).collect::<Vec<_>>() {
        return Err(format!(
            "CSV 列名不符: 期望 {:?}, 实际 {:?}",
            spec.columns, actual_headers
        ));
    }
    let mut actual_rows: Vec<Vec<String>> = reader.records().map(|record| {
        record.map(|r| r.iter().map(str::to_owned).collect()).map_err(|e| format!("CSV 记录错误: {e}"))
    }).collect::<Result<_, _>>()?;
    if actual_rows.len() != spec.rows.len() { return Err(format!("CSV 行数不符: 期望 {}, 实际 {}", spec.rows.len(), actual_rows.len())); }
    let mut expected_rows = spec.rows.iter().map(|row| {
        let object = row.as_object().expect("CSV row shape checked above");
        spec.columns.iter().map(|column| csv_cell(&object[column])).collect::<Vec<_>>()
    }).collect::<Vec<_>>();
    if !spec.key_columns.is_empty() {
        let indexes: Vec<usize> = spec.key_columns.iter().map(|key| spec.columns.iter().position(|c| c == key).unwrap()).collect();
        let mut actual_keys = std::collections::HashSet::new();
        for row in &actual_rows {
            if indexes.iter().any(|i| row[*i].trim().is_empty()) {
                return Err("CSV 稳定键缺失，无法按唯一记录对齐".into());
            }
            let key = indexes.iter().map(|i| row[*i].clone()).collect::<Vec<_>>();
            if !actual_keys.insert(key) {
                return Err("CSV 稳定键重复，无法按唯一记录对齐".into());
            }
        }
        actual_rows.sort_by_key(|row| indexes.iter().map(|i| row[*i].clone()).collect::<Vec<_>>());
        expected_rows.sort_by_key(|row| indexes.iter().map(|i| row[*i].text.clone()).collect::<Vec<_>>());
    }
    for (r, (expected, actual)) in expected_rows.iter().zip(&actual_rows).enumerate() {
        for (c, (expected, actual)) in expected.iter().zip(actual).enumerate() {
            let label = format!("第 {} 行列 {}", r + 1, spec.columns[c]);
            if expected.text == *actual { continue; }
            if expected.numeric {
                if let (Ok(e), Ok(a)) = (expected.text.parse::<f64>(), actual.parse::<f64>()) {
                    if e.is_finite() && a.is_finite() && (e - a).abs() <= spec.abs_tol.max(spec.rel_tol * e.abs()) {
                        continue;
                    }
                }
            }
            return Err(format!("{label} 不符: 期望 {:?}, 实际 {:?}", expected.text, actual));
        }
    }
    Ok(())
}

fn validate_tolerances(abs_tol: f64, rel_tol: f64) -> Result<(), String> {
    if !abs_tol.is_finite() || !rel_tol.is_finite() || abs_tol < 0.0 || rel_tol < 0.0 {
        Err("判题配置错误: 容差必须是有限非负数".into())
    } else {
        Ok(())
    }
}

/// 期望值映射为可比较的单元格。
///
/// **缺失值政策**：JSON `null` 表示「缺失」，映射为空文本，只匹配实际 CSV 的空单元格；
/// 字面量 `NaN`、`null` 或只含空白的文本都不算缺失。CSV 本身无法区分「空字符串」与
/// 「缺失」，因此两者统一按缺失处理。
struct CsvCell {
    text: String,
    numeric: bool,
}

fn csv_cell(value: &Value) -> CsvCell {
    match value {
        Value::Null => CsvCell { text: String::new(), numeric: false },
        Value::String(s) => CsvCell { text: s.clone(), numeric: false },
        Value::Number(number) => CsvCell { text: number.to_string(), numeric: true },
        Value::Bool(value) => CsvCell { text: value.to_string(), numeric: false },
        Value::Array(_) | Value::Object(_) => CsvCell { text: value.to_string(), numeric: false },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn json_compares_nested_values_with_numeric_tolerance() {
        let expected = serde_json::json!({"rows":[{"score": 0.3, "name":"A"}]});
        let actual = serde_json::json!({"rows":[{"score": 0.30000001, "name":"A"}]});
        assert!(compare_json(&expected, &actual, 1e-6, 1e-6, "$ ").is_ok());
        assert!(compare_json(&expected, &actual, 1e-10, 1e-10, "$ ").is_err());
    }

    #[test]
    fn json_object_field_order_does_not_change_meaning() {
        let expected = serde_json::json!({"alpha":1,"beta":2});
        let actual = serde_json::json!({"beta":2,"alpha":1});
        assert!(compare_json(&expected, &actual, 0.0, 0.0, "$" ).is_ok());
    }

    #[test]
    fn json_large_integers_are_not_collapsed_by_float_conversion() {
        // 2^53 与 2^53+1 转 f64 后相等，必须靠整数精确比较区分，不能靠浮点容差。
        let expected = serde_json::json!({"id": 9007199254740993i64});
        let actual = serde_json::json!({"id": 9007199254740992i64});
        let error = compare_json(&expected, &actual, 0.0, 0.0, "$").unwrap_err();
        assert!(error.contains("整数不符"), "{error}");
        assert!(compare_json(&expected, &expected, 0.0, 0.0, "$").is_ok());
        // 整数之间显式配置的容差仍然有效。
        assert!(compare_json(&expected, &actual, 2.0, 0.0, "$").is_ok());
    }

    #[cfg(windows)]
    #[test]
    fn output_paths_reject_symlink_components_when_creatable() {
        let root = std::env::temp_dir().join(format!("data_check_symlink_{}", std::process::id()));
        let real = root.join("real");
        std::fs::create_dir_all(&real).unwrap();
        std::fs::write(real.join("out.json"), "{}").unwrap();
        let link = root.join("link");
        match std::os::windows::fs::symlink_dir(&real, &link) {
            Ok(()) => {
                let error = output_path(&root, "link/out.json").unwrap_err();
                assert!(
                    error.contains("符号链接") || error.contains("重解析点"),
                    "{error}"
                );
            }
            Err(error) => {
                // 未开启开发者模式 / 无 SeCreateSymbolicLinkPrivilege：
                // 显式记录跳过，不把"没跑"伪装成"已验证"。
                eprintln!("SKIP: 无法创建符号链接（{error}），本环境未验证该分支");
            }
        }
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn output_paths_reject_parent_escape_and_absolute_paths() {
        let root = std::env::temp_dir().join(format!("data_check_path_{}", std::process::id()));
        std::fs::create_dir_all(root.join("results")).unwrap();
        std::fs::write(root.join("results/out.json"), "{}").unwrap();
        assert!(output_path(&root, "../outside.json").is_err());
        assert!(output_path(&root, "C:/outside.json").is_err());
        assert!(output_path(&root, "results/out.json").is_ok());
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn csv_configuration_errors_are_reported_before_missing_outputs() {
        let base = ExpectCsv {
            path: "not-created.csv".into(),
            columns: vec!["id".into(), "score".into()],
            rows: vec![serde_json::json!({"id":"A", "score":1})],
            key_columns: vec!["id".into()],
            abs_tol: 0.0,
            rel_tol: 0.0,
        };
        let mut invalid_specs = Vec::new();
        let mut spec = base.clone();
        spec.columns.push("id".into());
        invalid_specs.push(spec);
        let mut spec = base.clone();
        spec.key_columns.push("id".into());
        invalid_specs.push(spec);
        let mut spec = base.clone();
        spec.key_columns = vec!["unknown".into()];
        invalid_specs.push(spec);
        let mut spec = base.clone();
        spec.rows.push(serde_json::json!({"id":"A", "score":2}));
        invalid_specs.push(spec);
        let mut spec = base.clone();
        spec.rows = vec![serde_json::json!({"id":null, "score":1})];
        invalid_specs.push(spec);
        let mut spec = base.clone();
        spec.rows = vec![serde_json::json!({"id":"A", "score":[1,2]})];
        invalid_specs.push(spec);
        let mut spec = base.clone();
        spec.rows = vec![serde_json::json!({"id":"A"})];
        invalid_specs.push(spec);
        let mut spec = base;
        spec.abs_tol = -1.0;
        invalid_specs.push(spec);
        for spec in invalid_specs {
            let error = validate_csv(Path::new("."), &spec).unwrap_err();
            assert!(error.starts_with("判题配置错误:"), "{error}");
        }
    }

    #[test]
    fn csv_rejects_missing_actual_stable_key() {
        let root = std::env::temp_dir().join(format!("data_check_missing_key_{}", std::process::id()));
        std::fs::create_dir_all(&root).unwrap();
        std::fs::write(root.join("out.csv"), "id,score\n,1\n").unwrap();
        let spec = ExpectCsv {
            path: "out.csv".into(),
            columns: vec!["id".into(), "score".into()],
            rows: vec![serde_json::json!({"id":"A", "score":1})],
            key_columns: vec!["id".into()],
            abs_tol: 0.0,
            rel_tol: 0.0,
        };
        let error = validate_csv(&root, &spec).unwrap_err();
        assert!(error.contains("稳定键缺失"));
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn csv_rejects_duplicate_actual_stable_keys() {
        let root = std::env::temp_dir().join(format!("data_check_duplicate_{}", std::process::id()));
        std::fs::create_dir_all(&root).unwrap();
        std::fs::write(root.join("out.csv"), "id,score\nA,1\nA,2\n").unwrap();
        let spec = ExpectCsv {
            path: "out.csv".into(),
            columns: vec!["id".into(), "score".into()],
            rows: vec![serde_json::json!({"id":"A", "score":1}), serde_json::json!({"id":"B", "score":2})],
            key_columns: vec!["id".into()],
            abs_tol: 0.0,
            rel_tol: 0.0,
        };
        let error = validate_csv(&root, &spec).unwrap_err();
        assert!(error.contains("稳定键重复"));
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn csv_string_identifiers_are_not_compared_as_numbers() {
        let root = std::env::temp_dir().join(format!("data_check_csv_{}", std::process::id()));
        std::fs::create_dir_all(&root).unwrap();
        std::fs::write(root.join("out.csv"), "id,score\n1,2.00000001\n").unwrap();
        let spec = ExpectCsv {
            path: "out.csv".into(),
            columns: vec!["id".into(), "score".into()],
            rows: vec![serde_json::json!({"id":"001", "score":2.0})],
            key_columns: vec![],
            abs_tol: 1e-6,
            rel_tol: 0.0,
        };
        let error = validate_csv(&root, &spec).unwrap_err();
        assert!(error.contains("id"));
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn csv_missing_values_are_empty_cells_not_literal_strings() {
        let root = std::env::temp_dir().join(format!("data_check_missing_{}", std::process::id()));
        std::fs::create_dir_all(&root).unwrap();
        let columns = vec!["id".to_string(), "score".to_string()];
        let spec_with = |actual: &str, score: serde_json::Value| {
            std::fs::write(root.join("out.csv"), actual).unwrap();
            ExpectCsv {
                path: "out.csv".into(),
                columns: columns.clone(),
                rows: vec![serde_json::json!({"id": "A", "score": score})],
                key_columns: vec![],
                abs_tol: 0.0,
                rel_tol: 0.0,
            }
        };
        // 期望 null ↔ 实际空单元格：视为缺失，匹配
        assert!(validate_csv(&root, &spec_with("id,score\nA,\n", serde_json::Value::Null)).is_ok());
        // 字面量 NaN / null 不是缺失，不能冒充空单元格
        assert!(validate_csv(&root, &spec_with("id,score\nA,NaN\n", serde_json::Value::Null)).is_err());
        assert!(validate_csv(&root, &spec_with("id,score\nA,null\n", serde_json::Value::Null)).is_err());
        // 只含空白的单元格不是缺失
        assert!(validate_csv(&root, &spec_with("id,score\nA, \n", serde_json::Value::Null)).is_err());
        // 期望数字 0 不能匹配空单元格
        assert!(validate_csv(&root, &spec_with("id,score\nA,\n", serde_json::json!(0))).is_err());
        // 期望空字符串等价于缺失（CSV 无法区分二者），与空单元格匹配
        assert!(validate_csv(&root, &spec_with("id,score\nA,\n", serde_json::json!(""))).is_ok());
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn csv_accepts_utf8_bom_in_header() {
        let root = std::env::temp_dir().join(format!("data_check_bom_{}", std::process::id()));
        std::fs::create_dir_all(&root).unwrap();
        // utf-8-sig 写出的文件以 BOM 开头；教程就是这么教的
        std::fs::write(root.join("out.csv"), "\u{feff}id,score\nA,2\n").unwrap();
        let spec = ExpectCsv {
            path: "out.csv".into(),
            columns: vec!["id".into(), "score".into()],
            rows: vec![serde_json::json!({"id": "A", "score": 2})],
            key_columns: vec!["id".into()],
            abs_tol: 1e-6,
            rel_tol: 0.0,
        };
        assert!(
            validate_csv(&root, &spec).is_ok(),
            "带 BOM 的 CSV 不应被判列名不符"
        );
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn csv_numeric_values_allow_tolerance_and_stable_order() {
        let root = std::env::temp_dir().join(format!("data_check_numeric_{}", std::process::id()));
        std::fs::create_dir_all(&root).unwrap();
        std::fs::write(root.join("out.csv"), "id,score\nB,3.0\nA,2.00000001\n").unwrap();
        let spec = ExpectCsv {
            path: "out.csv".into(),
            columns: vec!["id".into(), "score".into()],
            rows: vec![serde_json::json!({"id":"A", "score":2.0}), serde_json::json!({"id":"B", "score":3.0})],
            key_columns: vec!["id".into()],
            abs_tol: 1e-6,
            rel_tol: 0.0,
        };
        assert!(validate_csv(&root, &spec).is_ok());
        let _ = std::fs::remove_dir_all(root);
    }
}
