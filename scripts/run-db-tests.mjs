import { spawnSync } from 'node:child_process'

const isWindows = process.platform === 'win32'
const npmCommand = isWindows ? 'npm.cmd' : 'npm'
const npxCommand = isWindows ? 'npx.cmd' : 'npx'

function run(command, args) {
  const spawnCommand = isWindows ? 'cmd.exe' : command
  const spawnArgs = isWindows ? ['/d', '/s', '/c', command, ...args] : args

  const result = spawnSync(spawnCommand, spawnArgs, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
    shell: false,
  })

  if (result.error) {
    console.error(result.error.message)
    return 1
  }
  return result.status ?? 1
}

let exitCode = 0
let seeded = false

exitCode = run(npmCommand, ['run', 'qa:cleanup'])
if (exitCode === 0) {
  exitCode = run(npmCommand, ['run', 'qa:seed'])
  seeded = exitCode === 0
}
if (exitCode === 0) exitCode = run(npxCommand, ['vitest', 'run', '--config', 'vitest.db.config.ts'])

if (seeded) {
  const cleanupCode = run(npmCommand, ['run', 'qa:cleanup'])
  if (exitCode === 0 && cleanupCode !== 0) exitCode = cleanupCode
}

process.exit(exitCode)
