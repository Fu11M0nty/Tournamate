import { spawn } from 'node:child_process'

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const child = spawn(command, ['playwright', 'test', '--pass-with-no-tests'], {
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
