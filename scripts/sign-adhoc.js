const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

exports.default = async function (context) {
  if (process.platform !== 'darwin') return

  // electron-builder builds x64 and arm64 slices first, then merges them.
  // Signing individual slices causes CodeResources to differ → merge fails.
  // Arch.universal = 4 → only sign the already-merged universal binary.
  if (context.arch !== 4) return

  const { appOutDir, packager } = context
  const productName = packager.appInfo.productFilename
  const appPath = path.join(appOutDir, `${productName}.app`)

  if (!fs.existsSync(appPath)) return

  // Ad-hoc signature satisfies Squirrel.Mac's SecStaticCodeCheckValidity
  // without requiring an Apple Developer certificate.
  execSync(`codesign --force --deep -s - "${appPath}"`, { stdio: 'inherit' })
}
