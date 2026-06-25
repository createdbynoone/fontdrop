const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

exports.default = async function (context) {
  if (process.platform !== 'darwin') return

  // Skip x64 (arch=1) and x64 slice of universal builds (arch=0).
  // Sign arm64-only (arch=3) and universal (arch=4) directly.
  if (context.arch === 0 || context.arch === 1) return

  const { appOutDir, packager } = context
  const productName = packager.appInfo.productFilename
  const appPath = path.join(appOutDir, `${productName}.app`)

  if (!fs.existsSync(appPath)) return

  // Ad-hoc signature satisfies Squirrel.Mac's SecStaticCodeCheckValidity
  // without requiring an Apple Developer certificate.
  execSync(`codesign --force --deep -s - "${appPath}"`, { stdio: 'inherit' })
}
