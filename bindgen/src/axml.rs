use std::io::{BufWriter, Cursor};

use mbf_axml::{AxmlReader, AxmlWriter, EventReader, EventWriter};
use wasm_bindgen::prelude::wasm_bindgen;

#[wasm_bindgen]
pub fn axml_to_xml_temp(axml: Vec<u8>) -> String {
    let mut input = Cursor::new(axml);
    let mut reader = AxmlReader::new(&mut input).unwrap();

    let output = BufWriter::new(Vec::new());
    let mut writer = EventWriter::new(output);
    
    mbf_axml::axml_to_xml(&mut writer, &mut reader).expect("Failed to convert axml to xml.");
    String::from_utf8(writer.into_inner().into_inner().unwrap()).unwrap()
}

#[wasm_bindgen]
pub fn xml_to_axml(xml: String) -> String {
    let mut input = Cursor::new(xml);
    let mut reader = EventReader::new(&mut input);

    let mut output = BufWriter::new(Vec::new());
    let mut writer = AxmlWriter::new(&mut output);

    mbf_axml::xml_to_axml(&mut writer, &mut reader).expect("Failed to convert xml to axml.");
    String::from_utf8(output.into_inner().unwrap()).unwrap()
}