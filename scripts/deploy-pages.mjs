// Build and publish dist/ to the gh-pages branch (GitHub Pages "Deploy from a branch").
// Works without GitHub Actions. Usage: npm run deploy
import { execFileSync, execSync } from 'node:child_process'
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const git = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim()
// npm is npm.cmd on Windows, so it needs a shell; these command strings are fixed.
const npm = (script, env) => execSync(`npm run ${script}`, { stdio: 'inherit', env: { ...process.env, ...env } })

if (git(['status', '--porcelain'])) {
  console.error('Commit or stash your changes first, so the deploy matches a commit.')
  process.exit(1)
}

const remote = git(['remote', 'get-url', 'origin'])
const repo = remote.replace(/\.git$/, '').split('/').pop()
const sha = git(['rev-parse', '--short', 'HEAD'])
const identity = ['-c', `user.name=${git(['config', 'user.name'])}`, '-c', `user.email=${git(['config', 'user.email'])}`, '-c', 'core.autocrlf=false']

npm('test')
npm('build', { BASE_PATH: `/${repo}/` })

const dir = mkdtempSync(join(tmpdir(), 'pages-'))
try {
  cpSync('dist', dir, { recursive: true })
  writeFileSync(join(dir, '.nojekyll'), '')
  git([...identity, 'init', '-q', '-b', 'gh-pages'], dir)
  git([...identity, 'add', '-A'], dir)
  git([...identity, 'commit', '-q', '-m', `Deploy ${sha}`], dir)
  execFileSync('git', ['push', '-f', remote, 'gh-pages'], { cwd: dir, stdio: 'inherit' })
  console.log(`\nDeployed ${sha} to gh-pages. Live in about a minute.`)
} finally {
  rmSync(dir, { recursive: true, force: true })
}
