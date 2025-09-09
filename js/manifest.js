function modifyManifest(xml, newName, newBundle) {
    const root = xml.documentElement;
    let changed = false;
    if (root.tagName !== "manifest") throw new Error("Non-manifest XML document passed");
    if (newName) {
	const app = root.querySelector("application");
	const old = app.getAttribute("android:label");
	if (newName !== old) {
	    app.setAttribute("android:label", newName) 
	    const activity = app.querySelector("activity");
	    activity.setAttribute("android:label", newName);
	    changed = true;
	}
    }
    if (newBundle) {
	const old = root.getAttribute("package");
	if (old !== newBundle) {
	    changed = true;
	    root.setAttribute("package", newBundle);
	    const permission = root.querySelector("permission");
	    const permName = permission.getAttribute("android:name");
	    updateBundle(permission, "android:name", old, newBundle);
	    updateBundle(permission, "android:name", old, newBundle);
	    const uPermission = Array.from(root.querySelectorAll(`uses-permission`))
		.find(e => e.getAttribute("android:name") === permName); // For some reason I could not look for this attribut in the query selector.
	    updateBundle(uPermission, "android:name", old, newBundle);
	    const providers = Array.from(root.querySelectorAll("provider"));
	    providers.forEach(p => updateBundle(p, "android:authorities", old, newBundle));
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
