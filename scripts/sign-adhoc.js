const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

exports.default = async function (context) {
  if (process.platform !== 'darwin') return

  const { appOutDir, packager } = context
  const productName = packager.appInfo.productFilename
  const appPath = path.join(appOutDir, `${productName}.app`)

  if (!fs.existsSync(appPath)) return

  // Ad-hoc signature satisfies Squirrel.Mac's SecStaticCodeCheckValidity
  // without requiring an Apple Developer certificate.
  execSync(`codesign --force --deep -s - "${appPath}"`, { stdio: 'inherit' })
}
