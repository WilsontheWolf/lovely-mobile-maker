function modifyManifest(xml, newName, newBundle) {
    const root = xml.documentElement;
    let changed = false;
    if (root.tagName !== "plist") throw new Error("Non-plist XML document passed");
    const keys = {}
    Array.from(root.querySelectorAll("key")).forEach(k => {
	const n = k.innerHTML
	if (keys[n]) console.warn("Duplicate Key", n);
	keys[n] = k.nextElementSibling
    })
    if (newName) {
	const old = keys.CFBundleDisplayName.innerHTML;
	if (newName !== old) {
	    keys.CFBundleDisplayName.innerHTML = newName;
	    keys.CFBundleName.innerHTML = newName;
	    changed = true;
	}
    }
    if (newBundle) {
	const old = keys.CFBundleIdentifier.innerHTML;
	if (old !== newBundle) {
	    changed = true;
	    keys.CFBundleIdentifier.innerHTML = newBundle;
	}
    }
    return changed
}

function updateBundle(element, attribute, oldBundle, newBundle) {
    element.setAttribute(attribute, element.getAttribute(attribute).replace(oldBundle, newBundle))
}

export {
    modifyManifest,
};
