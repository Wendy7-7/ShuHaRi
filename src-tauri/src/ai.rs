use crate::db::Db;
use futures_util::StreamExt;
use serde::Deserialize;
use tauri::ipc::Channel;
use tauri::State;

#[derive(Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

fn get_setting(db: &Db, key: &str, default: &str) -> String {
    let guard = db.0.lock().unwrap_or_else(|p| p.into_inner());
    guard
        .query_row("SELECT value FROM kv WHERE key=?1", [key], |r| {
            r.get::<_, String>(0)
        })
        .unwrap_or_else(|_| default.to_string())
}

/// OpenAI 兼容 chat/completions 调用；配置从 kv 读取（ai_base / ai_key / ai_model）
#[tauri::command]
pub async fn ai_chat(
    db: State<'_, Db>,
    messages: Vec<ChatMessage>,
) -> Result<String, String> {
    let base = get_setting(&db, "ai_base", "https://api.deepseek.com/v1");
    let key = get_setting(&db, "ai_key", "");
    let model = get_setting(&db, "ai_model", "deepseek-chat");

    if key.trim().is_empty() {
        return Err("尚未配置 AI API Key，请点击顶栏「设置」填写".into());
    }

    let url = format!("{}/chat/completions", base.trim_end_matches('/'));
    let body = serde_json::json!({
        "model": model,
        "messages": messages.iter().map(|m| serde_json::json!({
            "role": m.role, "content": m.content
        })).collect::<Vec<_>>(),
        "temperature": 0.7
    });

    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", key.trim()))
        .header("Content-Type", "application/json")
        .json(&body)
        .timeout(std::time::Duration::from_secs(90))
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(format!("API 返回 {}: {}", status, text.chars().take(300).collect::<String>()));
    }

    let v: serde_json::Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    v.pointer("/choices/0/message/content")
        .and_then(|c| c.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| format!("API 响应格式异常: {}", text.chars().take(300).collect::<String>()))
}

/// 流式版本：SSE 增量通过 Channel 推给前端，首个字出来就不再干等
#[tauri::command]
pub async fn ai_chat_stream(
    db: State<'_, Db>,
    messages: Vec<ChatMessage>,
    on_chunk: Channel<String>,
) -> Result<(), String> {
    let base = get_setting(&db, "ai_base", "https://api.deepseek.com/v1");
    let key = get_setting(&db, "ai_key", "");
    let model = get_setting(&db, "ai_model", "deepseek-chat");

    if key.trim().is_empty() {
        return Err("尚未配置 AI API Key，请点击顶栏「设置」填写".into());
    }

    let url = format!("{}/chat/completions", base.trim_end_matches('/'));
    let body = serde_json::json!({
        "model": model,
        "messages": messages.iter().map(|m| serde_json::json!({
            "role": m.role, "content": m.content
        })).collect::<Vec<_>>(),
        "temperature": 0.7,
        "stream": true
    });

    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", key.trim()))
        .header("Content-Type", "application/json")
        .json(&body)
        .timeout(std::time::Duration::from_secs(120))
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    let status = resp.status();
    if !status.is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("API 返回 {}: {}", status, text.chars().take(300).collect::<String>()));
    }

    let mut stream = resp.bytes_stream();
    let mut buf = String::new();
    let mut got_any = false;
    while let Some(chunk) = stream.next().await {
        let bytes = chunk.map_err(|e| format!("读取流失败: {}", e))?;
        buf.push_str(&String::from_utf8_lossy(&bytes));
        // 按行解析 SSE：data: {...} / data: [DONE]
        while let Some(nl) = buf.find('\n') {
            let line = buf[..nl].trim_end_matches('\r').to_string();
            buf.drain(..nl + 1);
            if let Some(data) = line.strip_prefix("data:") {
                let data = data.trim();
                if data == "[DONE]" {
                    return Ok(());
                }
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(data) {
                    if let Some(delta) = v.pointer("/choices/0/delta/content").and_then(|c| c.as_str()) {
                        if !delta.is_empty() {
                            got_any = true;
                            on_chunk.send(delta.to_string()).map_err(|e| e.to_string())?;
                        }
                    }
                }
            }
        }
    }
    if !got_any {
        return Err("API 流式返回为空（可能该模型不支持 stream，可在设置里换一个模型）".into());
    }
    Ok(())
}
