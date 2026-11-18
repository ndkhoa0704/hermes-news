const { existsSync } = require('node:fs')
const { join } = require('node:path')

const homeBun = join(process.env.HOME || '', '.bun', 'bin', 'bun')

module.exports = {
  apps: [
    {
      name: 'hermes-news_3130',
      // chạy thẳng binary bun (pm2 không nạp được module có top-level await)
      script: existsSync(homeBun) ? homeBun : 'bun',
      args: 'src/server.ts',
      interpreter: 'none',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        PORT: '3130',
        HOST: '127.0.0.1',
        // hermes nằm ở ~/.local/bin
        PATH: `${join(process.env.HOME || '', '.local', 'bin')}:${join(process.env.HOME || '', '.bun', 'bin')}:${process.env.PATH}`,
      },
      autorestart: true,
      max_memory_restart: '400M',
      kill_timeout: 5000,
      time: true,
    },
  ],
}
