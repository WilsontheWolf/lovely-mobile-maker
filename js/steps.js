import init, { zip_open, zip_read_file, entry_names, axml_to_xml, xml_to_axml, write_file, zip_save_and_sign_v2 } from "./pkg/mbf_bindgen.js";
import { modifyManifest } from "./manifest.js";

const wasmReady = init();
const liveSteps = [];
const sharedState = {};
const decoder = new TextDecoder();
const identityRegex = /t.identity\s*=\s*['"]([^'"]+)/;
const nameRegex = /^(.+?)(?:\.[^.]+)?$/;
const identityPreprocess = /[^\w\-\~\.\(\)\[\]]/g;
const identityGet = /^[a-z0-9]+/;

const baseID = "systems.shorty.lmm";
const balatroPreset = {
    identity: "balatro",
    name: "Balatro",
};

function nameToIdentity(name) {
    name = name.replaceAll(identityPreprocess, "").toLowerCase();
    return name.match(identityGet)?.[0];
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

const downloadBlob = (data, fileName, mimeType) => {
    const blob = new Blob([data], {
	type: mimeType
    })

    const url = window.URL.createObjectURL(blob)

    downloadURL(url, fileName)

    setTimeout(() => window.URL.revokeObjectURL(url), 1000)
}

class Step {
    constructor(element, index) {
	this.element = element;
	this.resetCollapsed = element.classList.contains("collapsed");
	this.index = index;
	this.status = document.createElement("p");
	this.status.classList.add("status");
	this.element.append(this.status);
    }

    updateStatus(content) {
	this.status.innerText = content;
	console.log("[Status update]", content);
    }

    get next() {
	return liveSteps[this.index + 1];
    }

    done() {
	if (!this.next) return
	this.next.clear();
	this.next.ready();
    }

    clear() {
	this.status.innerText = "";
    }

    reset() {
	this.clear();
	this.next?.reset();
	if (this.resetCollapsed) 
	    this.element.classList.add("collapsed");
    }

    ready() {
	this.element.classList.remove("collapsed");
    }
}

class GameStep extends Step {
    constructor(element, index) {
	super(element, index)
	this.file = element.querySelector("#gamefile");
	this.clear();
	this.file.addEventListener("change", this.handleFile.bind(this));
    }

    clear() {
	this.file.value = "";
	sharedState.gameData = null;
    }

    handleFile(event) {
	const file = event.target.files[0];
	this.next?.reset();

	if (!file) {
	    this.updateStatus("No file selected. Please choose a file.");
	    return;
	}

	this.updateStatus("Checking file...");
	const reader = new FileReader();
	reader.onload = () => {
	    wasmReady.then(() => {
		sharedState.gameData = this.processGame(new Uint8Array(reader.result), file.name);
		this.done();
	    }).catch(e => {
		console.error(e)
		this.updateStatus("An error occurred: " + e)
	    });
	};
	reader.onerror = () => {
	    this.updateStatus("Error reading the file. Please try again.");
	};
	reader.readAsArrayBuffer(file);
    };

    processGame(data, name) {
	let zip
	try {
	    zip = zip_open(data);
	} catch (e) {
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

	let isLove = false, isBalatro = false, hasConf = false;
	for (const f of files) {
	    if (f === "main.lua") {
		isLove = true;
		if (isBalatro && hasConf) break;
	    } else if (f === "version.jkr") {
		isBalatro = true;
		if (isLove && hasConf) break;
	    } else if (f === "conf.lua") {
		hasConf = true;
		if (isLove && isBalatro) break;
	    }
	}
	if (!isLove) throw "Provided file does not appear to be a valid love game (no main.lua)"
	this.updateStatus("Valid File Passed!")
	return {
	    zip, isBalatro, isLove, files, hasConf, name,
	}
    }
}

class DownloadStep extends Step {
    constructor(e, i) {
	super(e,i);
    }
    async ready() {
	super.ready();
	try {
	    if (!sharedState.apkData) {
		this.updateStatus("Downloading base APK...");
		const res = await fetch("/base.apk")
		    .then(async r => {
			if(r.ok) return new Uint8Array(await r.arrayBuffer());
			throw new Error("Failed to fetch base.apk: " + r.status + ": " + r.statusText)
		    });
		sharedState.apkData = res
	    }
	    if (!sharedState.cert) {
		this.updateStatus("Downloading cert...");
		const res = await fetch("/debug-cert.pem")
		    .then(async r => {
			if(r.ok) return new Uint8Array(await r.arrayBuffer());
			throw new Error("Failed to fetch debug-cert.pem: " + r.status + ": " + r.statusText)
		    });
		sharedState.cert = res
	    }
	    this.updateStatus("Downloading Complete");
	    this.done();
	} catch (e) {
	    console.error(e);
	    this.updateStatus("An error ocurred: " + e);
	}
    }
}

class MetaStep extends Step {
    constructor(e,i) {
	super(e,i);
	this.name = document.getElementById("name");
	this.bundle = document.getElementById("bundle");
	this.icon = document.getElementById("icon");
	this.submit = document.getElementById("ready");
	this.submit.addEventListener("click", () => this.doneButton());
    }

    ready() {
	super.ready();
	let varState = {}
	const game = sharedState.gameData;
	if (game.isBalatro) {
	    varState = balatroPreset;
	} else {
	    if(game.hasConf) {
		const conf = decoder.decode(zip_read_file(game.zip, "conf.lua"));
		const identity = conf.match(identityRegex);
		if (identity) varState.identity = identity[1];
	    }
	    varState.name = game.name.match(nameRegex)?.[1];
	    if (!varState.identity && varState.name) varState.identity = nameToIdentity(varState.name);
	}
	console.log(varState);
	this.name.value = varState.name || "Lovely Mobile Maker";
	this.bundle.value = baseID + (varState.identity ? "." + varState.identity : "");
    }

    clear() {
	super.clear();
	sharedState.meta = null;
    }
    doneButton() {
	if (!this.bundle.checkValidity()) return console.info("Cannot continue, invalid bundle");
	const meta = {};
	meta.name = this.name.value || null;
	meta.bundle = this.bundle.value;
	sharedState.meta = meta;
	this.done();
    }
}

class GenerateStep extends Step {
    constructor(e, i) {
	super(e, i);
	this.status2 = document.createElement("p");
	this.status2.classList.add("status");
	this.element.append(this.status);
    }

    ready() {
	super.ready();
	try {
	    this.prepareAPK();
	    this.patchManifest();
	    this.patchIcon();
	    this.copyAssets();
	    this.signAndSave();
	    this.done();
	} catch(e) {
	    console.error(e);
	    this.updateStatus("An error ocurred: " + e);
	    this.updateStatus2("");
	}
    }

    clear() {
	super.clear();
	this.status2.innerText = "";
    }

    updateStatus2(content) {
	this.status2.innerText = content;
    }

    prepareAPK() {
	this.updateStatus("Preparing APK...");
	sharedState.apk = zip_open(sharedState.apkData);
    }

    patchManifest() {
	this.updateStatus("Patching Manifest...");
	let data = zip_read_file(sharedState.apk, "AndroidManifest.xml");
	let xmlString = axml_to_xml(data);
	const p = new DOMParser();
	const xml = p.parseFromString(xmlString, "application/xml");
	const modifed = modifyManifest(xml, sharedState.meta.name, sharedState.meta.bundle);
	if (!modifed) return;
	const s = new XMLSerializer();
	xmlString = s.serializeToString(xml);
	data = xml_to_axml(xmlString);
	console.log(xmlString)
	console.log(data)
	write_file(sharedState.apk, "AndroidManifest.xml", data);
    }

    patchIcon(){} // TODO:

    copyAssets(){
	this.updateStatus("Copying game files...");
	console.time("Copying files");
	const game = sharedState.gameData;
	for (const f of game.files) {
	    if (f.endsWith("/")) continue;
	    this.updateStatus2(f);
	    // await asyncTimeout();
	    const d = zip_read_file(game.zip, f);
	    const nn = "assets/" + f;
	    write_file(sharedState.apk, nn, d);
	}
	console.timeEnd("Copying files");
	this.updateStatus2("");
    }

    signAndSave(){
	this.updateStatus("Signing game...");
	// await asyncTimeout();
	const raw = zip_save_and_sign_v2(sharedState.apk, sharedState.cert);

	this.updateStatus("Done");
	downloadBlob(raw, "game.apk", "application/vnd.android.package-archive");
    }
}


const steps = [
    GameStep,
    DownloadStep,
    MetaStep,
    GenerateStep,
];


function loadSteps() {
    steps.forEach((step, i) => {
	console.log(i);
	const ele = document.getElementById(`step${i + 1}`);
	if (!ele) throw "Hi dad";
	liveSteps.push(new step(ele, i));
    });
}

loadSteps();

console.log(sharedState)
