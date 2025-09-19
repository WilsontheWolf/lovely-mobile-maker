use std::io::Cursor;

use mbf_zip::{signing, FileCompression, ZipFile};
use wasm_bindgen::prelude::wasm_bindgen;

fn res_fix<T, U: ToString>(res: Result<T, U>) -> Result<T, String> {
    res.map_err(|e| e.to_string())
}

#[wasm_bindgen]
pub fn zip_open(buf: &[u8]) -> Result<ZipFile, String> {
    let cursor = Cursor::new(buf.to_vec());
    res_fix(ZipFile::open(cursor))
}

#[wasm_bindgen]
pub fn zip_read_file(zip: &mut ZipFile, name: &str) -> Result<Vec<u8>, String> {
    res_fix(zip.read_file(name))
}

#[wasm_bindgen]
pub fn zip_extract_file_to(zip: &mut ZipFile, name: &str, to: &str) -> Result<(), String> {
    res_fix(zip.extract_file_to(name, to))
}

#[wasm_bindgen]
pub fn zip_save_and_sign_v2(mut zip: ZipFile, pem_data: &[u8]) -> Result<Vec<u8>, String> {
    let (cert, priv_key) = signing::load_cert_and_priv_key(pem_data);
    res_fix(zip.save_and_sign_v2(&priv_key, &cert))?;
    zip.flush();
    Ok(zip.into_buffer())
}

#[wasm_bindgen]
pub fn read_file_contents(zip: &mut ZipFile, name: &str) -> Result<Vec<u8>, String> {
    let mut output = Vec::new();
    res_fix(zip.read_file_contents(name, &mut output))?;
    Ok(output)
}

#[wasm_bindgen]
pub fn entry_names(zip: &mut ZipFile) -> Vec<String> {
    zip.iter_entry_names().map(String::from).collect()
}

#[wasm_bindgen]
pub fn write_file(zip: &mut ZipFile, name: &str, contents: &[u8]) -> Result<(), String>{
    res_fix(zip.write_file(name, &mut Cursor::new(contents), FileCompression::Deflate))
}

#[wasm_bindgen]
pub fn delete_file(zip: &mut ZipFile, name: &str) -> bool {
    zip.delete_file(name)
}
