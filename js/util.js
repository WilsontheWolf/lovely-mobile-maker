import { entry_names } from "./pkg/mbf_bindgen.js";

const identityPreprocess = /[^\w\-\~\.\(\)\[\]]/g;
const identityGet = /^[a-z0-9]+/;
const iOSApp = /^Payload\/[^/]+\.app\/$/;

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

function asyncTimeout(t) {
    return new Promise((res) => {
	setTimeout(() => res(), t);
    });
}

function getMainDir(zip, platform) {
    if (platform !== "ios") return "";
    const ls = entry_names(zip);
    const app = ls.find(e => e.match(iOSApp));
    if(!app) throw new Error("Could not find ipa's .app dir!");
    return app;
}

export {
    downloadBlob,
    downloadURL,
    nameToIdentity,
    asyncTimeout,
    getMainDir,
}
