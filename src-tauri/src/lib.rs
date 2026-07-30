use std::{
    fs,
    io::ErrorKind,
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Manager};

const MAX_DESIGN_FILE_SIZE: u64 = 10 * 1024 * 1024;
const RECOVERY_FILE_NAME: &str = "recovery.perfboard.json";

fn read_utf8_file(path: &Path, description: &str) -> Result<String, String> {
    let metadata =
        fs::metadata(path).map_err(|error| format!("{description}を確認できません: {error}"))?;

    if metadata.len() > MAX_DESIGN_FILE_SIZE {
        return Err(format!(
            "{description}が大きすぎます。10MB以下のファイルを選択してください。"
        ));
    }

    fs::read_to_string(path)
        .map_err(|error| format!("{description}をUTF-8として読み込めません: {error}"))
}

fn write_utf8_file(path: &Path, contents: &str, description: &str) -> Result<(), String> {
    if contents.len() as u64 > MAX_DESIGN_FILE_SIZE {
        return Err(format!("{description}が大きすぎるため保存できません。"));
    }

    fs::write(path, contents).map_err(|error| format!("{description}を書き込めません: {error}"))
}

fn recovery_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|directory| directory.join(RECOVERY_FILE_NAME))
        .map_err(|error| format!("復旧データの保存場所を取得できません: {error}"))
}

#[tauri::command]
fn read_design_file(file_path: String) -> Result<String, String> {
    read_utf8_file(Path::new(&file_path), "設計ファイル")
}

#[tauri::command]
fn write_design_file(file_path: String, contents: String) -> Result<(), String> {
    write_utf8_file(Path::new(&file_path), &contents, "設計ファイル")
}

#[tauri::command]
fn write_svg_file(file_path: String, contents: String) -> Result<(), String> {
    write_utf8_file(Path::new(&file_path), &contents, "SVGファイル")
}

#[tauri::command]
fn read_recovery_file(app: AppHandle) -> Result<Option<String>, String> {
    let path = recovery_file_path(&app)?;

    match fs::metadata(&path) {
        Ok(metadata) => {
            if metadata.len() > MAX_DESIGN_FILE_SIZE {
                return Err("復旧データが大きすぎます。10MB以下である必要があります。".to_string());
            }
            fs::read_to_string(path)
                .map(Some)
                .map_err(|error| format!("復旧データをUTF-8として読み込めません: {error}"))
        }
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!("復旧データを確認できません: {error}")),
    }
}

#[tauri::command]
fn write_recovery_file(app: AppHandle, contents: String) -> Result<(), String> {
    let path = recovery_file_path(&app)?;
    let directory = path
        .parent()
        .ok_or_else(|| "復旧データの保存場所が正しくありません。".to_string())?;

    fs::create_dir_all(directory)
        .map_err(|error| format!("復旧データの保存場所を作成できません: {error}"))?;
    write_utf8_file(&path, &contents, "復旧データ")
}

#[tauri::command]
fn delete_recovery_file(app: AppHandle) -> Result<(), String> {
    let path = recovery_file_path(&app)?;

    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("復旧データを削除できません: {error}")),
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            read_design_file,
            write_design_file,
            write_svg_file,
            read_recovery_file,
            write_recovery_file,
            delete_recovery_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
