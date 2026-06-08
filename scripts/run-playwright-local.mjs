import { spawn } from 'node:child_process'

const isWindows = process.platform === 'win32'
const command = isWindows ? 'cmd.exe' : 'npx'
const args = isWindows
  ? ['/d', '/s', '/c', 'npx.cmd', 'playwright', 'test', '--pass-with-no-tests']
  : ['playwright', 'test', '--pass-with-no-tests']

const child = spawn(command, args, {
  env: {
    ...process.env,
    PLAYWRIGHT_START_SERVER: '1',
  },
  stdio: 'inherit',
  shell: false,
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 1)
})
