use std::io::Cursor;

use mbf_zip::{signing, FileCompression, ZipFile};
use wasm_bindgen::prelude::wasm_bindgen;

#[wasm_bindgen]
pub fn zip_open(buf: &[u8]) -> Result<ZipFile, String> {
    let cursor = Cursor::new(buf.to_vec());
    ZipFile::open(cursor).map_err(|e| e.to_string())
}

#[wasm_bindgen]
pub fn zip_read_file(zip: &mut ZipFile, name: &str) -> Result<Vec<u8>, String> {
    zip.read_file(name).map_err(|e| e.to_string())
}

#[wasm_bindgen]
pub fn zip_extract_file_to(zip: &mut ZipFile, name: &str, to: &str) {
    zip.extract_file_to(name, to).unwrap();
}

#[wasm_bindgen]
pub fn zip_save_and_sign_v2(mut zip: ZipFile, pem_data: &[u8]) -> Vec<u8> {
    let (cert, priv_key) = signing::load_cert_and_priv_key(pem_data);
    zip.save_and_sign_v2(&priv_key, &cert).unwrap();
    zip.flush();
    zip.into_buffer()
}

#[wasm_bindgen]
pub fn read_file_contents(zip: &mut ZipFile, name: &str) -> Vec<u8> {
    let mut output = Vec::new();
    zip.read_file_contents(name, &mut output).unwrap();
    output
}

#[wasm_bindgen]
pub fn entry_names(zip: &mut ZipFile) -> Vec<String> {
    zip.iter_entry_names().map(String::from).collect()
}

#[wasm_bindgen]
pub fn write_file(zip: &mut ZipFile, name: &str, contents: &[u8]) {
    zip.write_file(name, &mut Cursor::new(contents), FileCompression::Deflate)
        .unwrap();
}

#[wasm_bindgen]
pub fn delete_file(zip: &mut ZipFile, name: &str) -> bool {
    zip.delete_file(name)
}
