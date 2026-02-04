import init, { zip_open, zip_read_file, entry_names, axml_to_xml, xml_to_axml, write_file, zip_save_and_sign_v2 } from "./pkg/mbf_bindgen.js";
import { modifyManifest, modifyInfoPlist } from "./manifest.js";
import { downloadBlob, nameToIdentity, asyncTimeout, getMainDir } from "./util.js";
import { makeIconList, getImageForIcon, icons, getQualities } from "./icon.js";
import { imgToPNGOfSize } from "./img.js";
import sharedState from "./state.js";
import * as platformValues from "./platform.js";

const wasmReady = init();
const liveSteps = [];
const decoder = new TextDecoder();
const encoder = new TextEncoder();
const identityRegex = /t.identity\s*=\s*['"]([^'"]+)/;
const nameRegex = /^(.+?)(?:\.[^.]+)?$/;

const baseID = "systems.shorty.lmm";
const balatroPreset = {
    identity: "balatro",
    name: "Balatro",
};

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
	if (content)
	    console.log("[Status update]", content);
    }

    get next() {
	return liveSteps[this.index + 1];
    }

    get previous() {
	return liveSteps[this.index - 1];
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
		document.body.classList[sharedState.gameData.isBalatro ? "add" : "remove"]("game-balatro");
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
	    zip, isBalatro, isLove, files, hasConf, name, data,
	}
    }
}

class PlatformStep extends Step {
    constructor(e, i) {
	super(e, i);
	const select = e.querySelector("select");
	this.select = select;
	this.select.value = "";
	select.addEventListener("change", this.updateSelect.bind(this));
    }

    clear() {
	super.clear();
	this.select.selectedIndex = 0;
    }

    updateSelect() {
	const value = this.select.value;
	sharedState.platform = value;
	sharedState.platformValues = platformValues[value];
	sharedState.apk = null;
	const classList = document.body.classList;
	for (const option of this.select.options) {
	    if (option.value === value) classList.add(`platform-${option.value}`);
	    else classList.remove(`platform-${option.value}`);
	}
	this.next?.reset();
	this.done();
    }
}

class DownloadStep extends Step {
    constructor(e, i) {
	super(e,i);
    }
    async ready() {
	super.ready();
	try {
	    const type = sharedState.platform === "ios" ? "ipaData" : "apkData";
	    if (!sharedState[type]) {
		this.updateStatus("Downloading base app...");
		const res = await fetch("/base" + sharedState.platformValues.ext)
		    .then(async r => {
			if(r.ok) return new Uint8Array(await r.arrayBuffer());
			throw new Error("Failed to fetch base" + sharedState.platformValues.ext +": " + r.status + ": " + r.statusText)
		    });
		sharedState[type] = res
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
	    const button = document.createElement("button");
	    button.innerText = "Retry";
	    button.addEventListener("click", () => {
		this.ready();
	    });
	    this.status.appendChild(document.createElement("br"));
	    this.status.appendChild(button);
	}
    }
}

class MetaStep extends Step {
    constructor(e,i) {
	super(e,i);
	this.name = document.getElementById("meta-name");
	this.bundle = document.getElementById("meta-bundle");
	this.icon = document.getElementById("meta-icon");
	this.submit = document.getElementById("meta-ready");
	this.iconList = document.querySelector(".meta-icon-list");
	this.iconPicker = document.querySelector(".meta-icon-picker");
	this.customIcon = document.querySelector(".meta-custom-icon");
	this.submit.addEventListener("click", () => this.doneButton());
	this.icon.addEventListener("click", () => this.toggleIconPicker());
    }

    async ready() {
	try {
	    super.ready();
	    let varState = {}
	    const game = sharedState.gameData;
	    this.iconPicker.classList.add("hidden");
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
	    this.name.value = varState.name || "Lovely Mobile Maker";
	    this.bundle.value = baseID + (varState.identity ? "." + varState.identity : "");
	    this.prepared = this.prepareAPK();
	    await this.prepared;
	    if(game.isBalatro) sharedState.icon = 1;
	    else sharedState.icon = 0;
	    this.iconList.innerHTML = "";
	    makeIconList(this.iconList, this);
	} catch(e) {
	    console.error(e);
	    this.updateStatus("An error occured!?!?!? " + e);
	}
    }

    clear() {
	super.clear();
	this.iconPicker.classList.add("hidden");
	sharedState.meta = null;
    }

    async checkIcon() {
	sharedState.iconImg = null;
	const icon = icons[sharedState.icon];
	if (icon.type === "internal") {
	    return true
	}
	const img = await getImageForIcon(icon).catch(e => {
	    console.error("Error getting icon", e);
	    return null
	});
	if (!img) return;
	sharedState.iconImg = img;
	return true
    }

    async doneButton() {
	if (!sharedState.apk) // It's been consumed
	    await this.prepareAPK();
	this.updateStatus("");
	if (!this.bundle.checkValidity()) return this.updateStatus("Cannot continue, invalid bundle id");
	if (!(await this.checkIcon())) return this.updateStatus("Cannot continue, invalid icon");
	this.iconPicker.classList.add("hidden");
	this.next.reset();
	await this.prepared
	const meta = {};
	meta.name = this.name.value || null;
	meta.bundle = this.bundle.value;
	sharedState.meta = meta;
	this.done();
    }

    async prepareAPK() {
	this.updateStatus(`Preparing ${sharedState.platform === "ios" ? "IPA" : "APK"}...`);
	await asyncTimeout();
	const type = sharedState.platform === "ios" ? "ipaData" : "apkData";
	sharedState.apk = zip_open(sharedState[type]);
	this.updateStatus("");
    }

    async updateSelectedIcon(icon) {
	const img = await getImageForIcon(icon).catch(console.error);
	if (img)
	    this.icon.replaceChildren(img);
	else 
	    this.icon.innerText = ""
    }

    toggleIconPicker() {
	this.iconPicker.classList.toggle("hidden");
    }

}

class GenerateStep extends Step {
    constructor(e, i) {
	super(e, i);
	this.status2 = document.createElement("p");
	this.status2.classList.add("status");
	this.element.append(this.status2);
    }

    async ready() {
	super.ready();
	try {
	    await this.patchManifest();
	    await this.patchIcon();
	    await this.copyAssets();
	    await this.signAndSave();
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

    async patchManifest() {
	this.updateStatus("Patching Manifest...");
	await asyncTimeout();
	if (sharedState.platform === "ios") {
	    await asyncTimeout(100); // iOS doesn't update as much and as such can appear stuck on the metadata step
	    const path = getMainDir(sharedState.apk, sharedState.platform) + "Info.plist";
	    let data = zip_read_file(sharedState.apk, path);
	    let xmlString = decoder.decode(data);
	    const p = new DOMParser();
	    const xml = p.parseFromString(xmlString, "application/xml");
	    const modifed = modifyInfoPlist(xml, sharedState.meta.name, sharedState.meta.bundle);
	    if (!modifed) return;
	    const s = new XMLSerializer();
	    xmlString = s.serializeToString(xml);
	    data = encoder.encode(xmlString);
	    write_file(sharedState.apk, path, data);
	} else {
	    let data = zip_read_file(sharedState.apk, "AndroidManifest.xml");
	    let xmlString = axml_to_xml(data);
	    const p = new DOMParser();
	    const xml = p.parseFromString(xmlString, "application/xml");
	    const modifed = modifyManifest(xml, sharedState.meta.name, sharedState.meta.bundle);
	    if (!modifed) return;
	    const s = new XMLSerializer();
	    xmlString = s.serializeToString(xml);
	    data = xml_to_axml(xmlString);
	    write_file(sharedState.apk, "AndroidManifest.xml", data);
	}
    }

    async patchIcon(){
	if (!sharedState.iconImg) return
	this.updateStatus("Patching icons...");
	await asyncTimeout();
	const img = sharedState.iconImg;
	const qualities = getQualities();
	qualities.all.forEach(([type, size]) => write_file(sharedState.apk, qualities.getPath(type), imgToPNGOfSize(img, size)));
    }

    async copyAssets(){
	this.updateStatus("Copying game files...");
	console.time("Copying files");
	const game = sharedState.gameData;
	if (sharedState.platform === "ios") {
	    write_file(sharedState.apk, getMainDir(sharedState.apk, sharedState.platform) + "game.love", game.data);
	} else {
	    for (const f of game.files) {
		if (f.endsWith("/")) continue;
		this.updateStatus2(f);
		await asyncTimeout();
		const d = zip_read_file(game.zip, f);
		const nn = "assets/" + f;
		write_file(sharedState.apk, nn, d);
	    }
	}
	console.timeEnd("Copying files");
	this.updateStatus2("");
    }

    async signAndSave(){
	this.updateStatus("Signing game...");
	await asyncTimeout();
	const raw = zip_save_and_sign_v2(sharedState.apk, sharedState.cert);
	this.previous.prepareAPK(); // The APK has been consumed

	this.updateStatus("Done");
	sharedState.final = raw;
	downloadBlob(raw, "game" + sharedState.platformValues.ext, sharedState.platformValues.mime);
    }

    reset() {
	super.reset();
	this.final = null;
    }
}

class DoneStep extends Step {
    constructor(e, i) {
	super(e, i);
	const button = document.getElementById("done-download");
	button.addEventListener("click", () => downloadBlob(sharedState.final, "game" + sharedState.platformValues.ext, sharedState.platformValues.mime));
    }

    ready() {
	super.ready();
    }
}

const steps = [
    GameStep,
    PlatformStep,
    DownloadStep,
    MetaStep,
    GenerateStep,
    DoneStep,
];


function loadSteps() {
    steps.forEach((step, i) => {
	const ele = document.getElementById(`step${i + 1}`);
	if (!ele) throw "Hi dad";
	liveSteps.push(new step(ele, i));
    });
}

export {
    loadSteps,
}
