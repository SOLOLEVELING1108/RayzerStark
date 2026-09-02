const fs = require("fs");
const path = require("path");
const ResEdit = require("resedit");

// Embeds our icon + product info into every .exe produced (no wine/rcedit needed).
exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "win32") return;
  const dir = context.appOutDir;
  const icoPath = path.join(__dirname, "build", "icon.ico");
  if (!fs.existsSync(icoPath)) { console.warn("[afterPack] icon.ico missing, skipping"); return; }
  const ico = ResEdit.Data.IconFile.from(fs.readFileSync(icoPath));
  const exes = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".exe"));
  for (const name of exes) {
    const exePath = path.join(dir, name);
    try {
      const exe = ResEdit.NtExecutable.from(fs.readFileSync(exePath));
      const res = ResEdit.NtExecutableResource.from(exe);
      ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
        res.entries, 1, 1033, ico.icons.map((i) => i.data)
      );
      const vi = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0];
      if (vi) {
        vi.setStringValues({ lang: 1033, codepage: 1200 }, {
          ProductName: "Rayzer Stark Game", FileDescription: "Rayzer Stark Game",
          CompanyName: "Rayzer Stark", InternalName: "Rayzer Stark Game", OriginalFilename: name,
        });
        vi.outputToResourceEntries(res.entries);
      }
      res.outputResource(exe);
      fs.writeFileSync(exePath, Buffer.from(exe.generate()));
      console.log(`[afterPack] icon embedded -> ${name}`);
    } catch (e) {
      console.error(`[afterPack] failed on ${name}:`, e.message);
    }
  }
};
