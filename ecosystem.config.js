module.exports = {
  apps: [
    {
      name: 'clickvibe',
      cwd: process.env.HOME ? process.env.HOME + '/public_html' : '.',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000 -H 127.0.0.1',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      max_memory_restart: '1G',
      time: true,
      autorestart: true,
      watch: false,
    },
  ],
}
