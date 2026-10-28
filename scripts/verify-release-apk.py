"""Check the downloaded artifact without executing or installing it."""
import hashlib
import json
import sys
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parent.parent
version = sys.argv[1] if len(sys.argv) > 1 else json.loads((root / "app.json").read_text())["expo"]["version"]
build = json.loads((root / "output" / f"release-{version}-build-result.json").read_text())
expected_code = int(build["appBuildVersion"])
artifact = root / "output" / f"RevUpTime-{version}.apk"
result = {"file": str(artifact), "bytes": artifact.stat().st_size}
with artifact.open("rb") as stream:
    result["sha256"] = hashlib.file_digest(stream, "sha256").hexdigest()
with zipfile.ZipFile(artifact) as apk:
    failure = apk.testzip()
    if failure:
        raise RuntimeError(f"Corrupt APK entry: {failure}")
    names = apk.namelist()
    assert "AndroidManifest.xml" in names, "Missing Android manifest"
    assert any(name.endswith(".dex") for name in names), "Missing Android executable"
    # Release resource optimization shortens archive filenames. Verify named
    # launcher resources in the compiled Android resource table instead.
    resources = apk.read("resources.arsc")
    assert b"ic_launcher" in resources, "Missing compiled launcher resources"
    config_name = next((name for name in names if name in ("assets/app.config", "assets/app.manifest")), None)
    if config_name:
        config = json.loads(apk.read(config_name))
        config = config.get("expo", config)
        if config.get("version"):
            assert config["version"] == version, "Unexpected embedded app version"
            result["embeddedVersion"] = config["version"]
        android = config.get("android", {})
        if android.get("package"):
            assert android["package"] == "com.revuptime.mobile", "Unexpected package"
            result["embeddedPackage"] = android["package"]
        if android.get("versionCode"):
            assert android["versionCode"] == expected_code, "Unexpected Android version code"
            result["embeddedVersionCode"] = android["versionCode"]
    result["zipIntegrity"] = "passed"
    result["launcherSymbolCount"] = resources.count(b"ic_launcher")
    result["entryCount"] = len(names)

(root / "output" / f"release-{version}-apk-verification.json").write_text(json.dumps(result, indent=2), encoding="utf8")
print(json.dumps(result, indent=2))
