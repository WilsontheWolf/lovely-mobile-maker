import init, { zip_open, zip_read_file, entry_names, write_file, zip_save_and_sign_v2 } from "../pkg/mbf_zip.js";
import { urlToImg, imgToPNGOfSize } from "./img.js"

const wasmReady = init();
let apkData;
let cert;
const status = document.getElementById("status");
const status2 = document.getElementById("status2");
const imgs = [
    ["mdpi", 48],
    ["hdpi", 72],
    ["xhdpi", 96],
    ["xxhdpi", 144],
    ["xxxhdpi", 192],
];

function asyncTimeout(t) {
    return new Promise((res) => {
	setTimeout(() => res(), t);
    });
}

file.addEventListener("change", handleFile);

function updateStatus(content) {
    status.innerText = content;
    console.log("[Status update]", content);
}
function updateStatus2(content) {
    status2.innerText = content;
}

function handleFile(event) {
    const file = event.target.files[0];

    if (!file) {
	updateStatus("No file selected. Please choose a file.");
	return;
    }

    const reader = new FileReader();
    reader.onload = () => {
	beginProcess(new Uint8Array(reader.result))
	    .catch(e => {
		console.error(e)
		updateStatus("An error occurred: " + e)
		updateStatus2("");
	    });
    };
    reader.onerror = () => {
	updateStatus("Error reading the file. Please try again.");
    };
    reader.readAsArrayBuffer(file);
}

function prepareGame(data) {
    let zip
    try {
    zip = zip_open(data);
    } catch(e) {
	// Fused(?)
	let cdOffset
	for (let i = 0; i < data.length; i++) {
	    if (data[i] === 0x50 && data[i + 1] === 0x4B && data[i + 2] === 0x01 && data[i + 3] === 0x02) {
		cdOffset = i;
		break
	    }
	}
	if (cdOffset === null) throw e;
	let givenOffset;
	for (let i = cdOffset; i < data.length; i++) {
	    if (data[i] === 0x50 && data[i + 1] === 0x4B && data[i + 2] === 0x05 && data[i + 3] === 0x06) {
		const byte1 = data[i + 19];
		const byte2 = data[i + 18];
		const byte3 = data[i + 17];
		const byte4 = data[i + 16];

		const uint32 = ((byte1 << 24) | (byte2 << 16) | (byte3 << 8) | byte4) >>> 0;
		givenOffset = uint32;
		break
	    }
	}
	if (givenOffset === null) throw e;
	const diff = cdOffset - givenOffset;
	data = data.slice(diff)
	zip = zip_open(data)
    }
    const files = entry_names(zip);

    let isLove = false, isBalatro = false;
    for (const f of files) {
	if (f === "main.lua") {
	    isLove = true;
	    if (isBalatro) break;
	} else if (f === "version.jkr") {
	    isBalatro = true;
	    if (isLove) break;
	}
    }
    if (!isLove) throw "Provided file does not appear to be a valid love game (no main.lua)"
    return {
	zip, isBalatro, isLove, files,
    }
}

function downloadURL(data, fileName) {
    const a = document.createElement('a')
    a.href = data
    a.download = fileName
    document.body.appendChild(a)
    a.style.display = 'none'
    a.click()
    a.remove()
}

async function digestBuffer(data) {
    const hash = new Uint8Array(await window.crypto.subtle.digest("SHA-256", data));
    let binary = ''
    for (let i = 0; i < hash.byteLength; i++) {
	binary += String.fromCharCode(hash[i])
    }
    return btoa(binary)
}

const downloadBlob = (data, fileName, mimeType) => {
    const blob = new Blob([data], {
	type: mimeType
    })

    const url = window.URL.createObjectURL(blob)

    downloadURL(url, fileName)

    setTimeout(() => window.URL.revokeObjectURL(url), 1000)
}

async function beginProcess(loveData) {
    updateStatus("Loading WASM...");
    await wasmReady;
    updateStatus("Downloading base APK...");
    if (!apkData) {
	const res = await fetch("/base.apk")
	    .then(async r => {
		if(r.ok) return new Uint8Array(await r.arrayBuffer());
		throw new Error("Failed to fetch base.apk: " + r.status + ": " + r.statusText)
	    });
	apkData = res
    }
    const apk = zip_open(apkData);
    updateStatus("Downloading cert...");
    if (!cert) {
	const res = await fetch("/debug-cert.pem")
	    .then(async r => {
		if(r.ok) return new Uint8Array(await r.arrayBuffer());
		throw new Error("Failed to fetch debug-cert.pem: " + r.status + ": " + r.statusText)
	    });
	cert = res
    }
    updateStatus("Checking game files...");
    await asyncTimeout();
    const { zip, isLove, isBalatro, files } = prepareGame(loveData);
    loveData = null;

    updateStatus("Copying game files...");
    console.time("Copying files");
    for (const f of files) {
	if (f.endsWith("/")) continue;
	updateStatus2(f);
	await asyncTimeout();
	const d = zip_read_file(zip, f);
	const nn = "assets/" + f;
	write_file(apk, nn, d);
    }
    console.timeEnd("Copying files");
    updateStatus2("");

    // updateStatus("Patching image...");
    // const img = await urlToImg("/test.png");
    // imgs.forEach(([type, size]) => write_file(apk, `res/drawable-${type}-v4/love.png`, imgToPNGOfSize(img, size)));

    updateStatus("Signing game...");
    await asyncTimeout();
    const raw = zip_save_and_sign_v2(apk, cert);

    updateStatus("Done");
    downloadBlob(raw, "game.apk", "application/vnd.android.package-archive");
}

function debugRun() {
    fetch("/test.zip")
	.then(async r => new Uint8Array(await r.arrayBuffer()))
	.then(beginProcess)
	.catch(e => {
	    console.error(e)
	    updateStatus("An error occurred: " + e)
	    updateStatus2("");
	});
}

// debugRun();
