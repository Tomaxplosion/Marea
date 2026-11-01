const { execFileSync } = require('node:child_process');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const commits = git('rev-list', '--all').trim().split(/\r?\n/).filter(Boolean);
const seen = new Set();
const findings = [];
const patterns = [
  ['Google API key', /AIza[0-9A-Za-z_-]{35}/],
  ['GitHub token', /(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{30,})/],
  ['AWS access key', /(?:AKIA|ASIA)[A-Z0-9]{16}/],
  ['Private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['Assigned secret', /(?:api[_-]?key|secret|password|token)\s*[:=]\s*["'][A-Za-z0-9_\-/+=]{16,}/i],
  ['Personal email', /[A-Z0-9._%+-]+@(?:hotmail|outlook|gmail|yahoo|live)\.[A-Z.]+/i]
];
for (const commit of commits) {
  const metadata = git('show', '-s', '--format=%ae%n%ce%n%B', commit);
  if (patterns.at(-1)[1].test(metadata)) findings.push(`${commit.slice(0, 8)}: personal email in commit metadata`);
  for (const line of git('ls-tree', '-r', commit).trim().split('\n')) {
    const match = /^\d+ blob ([a-f0-9]+)\t(.+)$/.exec(line);
    if (!match || seen.has(match[1])) continue;
    seen.add(match[1]);
    const buffer = execFileSync('git', ['cat-file', 'blob', match[1]], { maxBuffer: 32 * 1024 * 1024 });
    if (buffer.includes(0)) continue;
    const text = buffer.toString('utf8');
    for (const [kind, pattern] of patterns) if (pattern.test(text)) findings.push(`${commit.slice(0, 8)} ${match[2]}: ${kind}`);
  }
}
if (findings.length) {
  console.error(findings.join('\n')); // Never print matching secret values.
  process.exitCode = 1;
} else console.log(`Reviewed ${commits.length} commits and ${seen.size} blobs: no matches in configured patterns.`);
