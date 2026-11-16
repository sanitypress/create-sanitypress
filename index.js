#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { styleText } from 'node:util'
import { minimalDocuments, toNdjson } from './seed.js'
import { telemetryEnabled, track } from './telemetry.js'

const VERSION = JSON.parse(
	readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
).version
const TEMPLATE = 'nuotsu/sanitypress'
const SKILLS_REPO = 'sanitypress/skills'
const SEEDS = ['minimal', 'demo', 'none']
const isWindows = process.platform === 'win32'

const HELP = `
${styleText('bold', 'create-sanitypress')} v${VERSION}

Usage
  npm create sanitypress@latest [directory] -- [options]
  bun create sanitypress [directory] [options]

Options
  --seed=<minimal|demo|none>  Starter content to import (default: minimal)
                                minimal  Site settings, Home page, Blog
                                demo     Sample site with navigation + a post
                                none     Empty dataset
  --no-blog                   Leave out the Blog page and blog post template
  -h, --help                  Show this help

All other options are passed to \`create-sanity\` (e.g. --project, --dataset,
--organization, --package-manager, --template). See \`npm create sanity -- --help\`.
`

// ---------------------------------------------------------------------------
// Args

function parse(argv) {
	const opts = { seed: 'minimal', blog: true, help: false, dryRun: false }
	const passthrough = []
	let dir, outputPath, packageManager, template

	// Directory may only be the first arg, so values of passthrough flags
	// (e.g. `--project abc123`) are never mistaken for it.
	if (argv[0] && !argv[0].startsWith('-')) dir = argv.shift()

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i]
		const [flag, inline] = arg.split(/=(.*)/s)
		const value = () => inline ?? argv[++i]

		switch (flag) {
			case '-h':
			case '--help':
				opts.help = true
				break
			case '--seed':
				opts.seed = value()
				break
			case '--blog':
				opts.blog = true
				break
			case '--no-blog':
				opts.blog = false
				break
			case '--dry-run':
				opts.dryRun = true
				break
			case '--output-path':
				outputPath = value()
				break
			case '--package-manager':
				packageManager = value()
				break
			case '--template':
				template = value()
				break
			default:
				passthrough.push(arg)
		}
	}

	return { ...opts, dir: outputPath ?? dir, packageManager, template, passthrough }
}

// ---------------------------------------------------------------------------
// Helpers

const log = (msg = '') => console.log(msg)
const info = (msg) => log(`${styleText('cyan', '◆')} ${msg}`)
const warn = (msg) => log(`${styleText('yellow', '▲')} ${msg}`)
const fail = (msg) => log(`${styleText('red', '■')} ${msg}`)

function detectPackageManager() {
	const ua = process.env.npm_config_user_agent ?? ''
	return ['bun', 'pnpm', 'yarn'].find((pm) => ua.startsWith(pm)) ?? 'npm'
}

/** Command to run a package binary without installing it */
function dlx(pm) {
	if (pm === 'bun') return ['bunx']
	if (pm === 'pnpm') return ['pnpm', 'dlx']
	return ['npx', '-y']
}

let dryRun = false
function run(cmd, args, cwd) {
	const pretty = [cmd, ...args].join(' ')
	if (dryRun) {
		log(styleText('dim', `$ ${pretty}${cwd ? `  (in ${cwd})` : ''}`))
		return 0
	}
	const { status } = spawnSync(cmd, args, {
		cwd,
		stdio: 'inherit',
		shell: isWindows,
	})
	return status ?? 1
}

async function ask(question, fallback) {
	if (!process.stdin.isTTY) return fallback
	const rl = createInterface({ input: process.stdin, output: process.stdout })
	const answer = await rl.question(
		`${styleText('cyan', '?')} ${question} ${styleText('dim', `(${fallback})`)} `,
	)
	rl.close()
	return answer.trim() || fallback
}

function readEnv(dir) {
	const env = {}
	for (const file of ['.env', '.env.local']) {
		const path = join(dir, file)
		if (!existsSync(path)) continue
		for (const line of readFileSync(path, 'utf8').split('\n')) {
			const match = line.match(/^\s*([\w.]+)\s*=\s*"?([^"#\s]*)"?/)
			if (match) env[match[1]] = match[2]
		}
	}
	return env
}

// ---------------------------------------------------------------------------
// Steps

function seed({ dir, kind, blog, projectId, dataset }) {
	if (kind === 'none') return true

	const sanity = join(dir, 'node_modules', '.bin', isWindows ? 'sanity.cmd' : 'sanity')
	if (!dryRun && !existsSync(sanity)) {
		warn('Dependencies are not installed, so starter content was skipped.')
		return false
	}

	let source
	let tmp
	if (kind === 'demo') {
		source = join(dir, 'demo.tar.gz')
		if (!dryRun && !existsSync(source)) {
			warn('demo.tar.gz not found in the template, so starter content was skipped.')
			return false
		}
	} else {
		tmp = mkdtempSync(join(tmpdir(), 'sanitypress-'))
		source = join(tmp, 'minimal.ndjson')
		writeFileSync(source, toNdjson(minimalDocuments({ blog })))
	}

	info(`Importing ${kind} starter content into "${dataset}"`)
	const status = run(
		sanity,
		['datasets', 'import', source, '--project', projectId, '--dataset', dataset, '--missing'],
		dir,
	)
	if (tmp) rmSync(tmp, { recursive: true, force: true })
	return status === 0
}

function installSkills({ dir, pm }) {
	info(`Installing SanityPress agent skills (${SKILLS_REPO})`)
	const [cmd, ...pre] = dlx(pm)
	return run(cmd, [...pre, 'skills@latest', 'add', SKILLS_REPO, '--skill', '*', '-y'], dir) === 0
}

// ---------------------------------------------------------------------------
// Main

async function main() {
	const args = parse(process.argv.slice(2))
	dryRun = args.dryRun

	if (args.help) return log(HELP)

	if (!SEEDS.includes(args.seed)) {
		fail(`Unknown --seed "${args.seed}". Use one of: ${SEEDS.join(', ')}`)
		process.exit(1)
	}

	const pm = args.packageManager ?? detectPackageManager()
	const props = { version: VERSION, pm, seed: args.seed, blog: args.blog }
	const started = Date.now()
	const done = (event, extra) =>
		track(event, { ...props, ...extra, duration_ms: Date.now() - started })

	log()
	log(styleText('bold', `SanityPress ${styleText('dim', `v${VERSION}`)}`))
	if (telemetryEnabled) {
		log(styleText('dim', 'Anonymous usage stats are on. Opt out with DO_NOT_TRACK=1.'))
	}
	log()

	const dir = resolve(args.dir ?? (await ask('Project directory?', 'sanitypress')))

	await track('cli_create_started', props)

	// 1. Scaffold with Sanity's own initializer (login, project, dataset, env, install)
	const [cmd, ...pre] = dlx(pm)
	const status = run(cmd, [
		...pre,
		'create-sanity@latest',
		`--template=${args.template ?? TEMPLATE}`,
		`--output-path=${dir}`,
		// create-sanity only accepts npm|yarn|pnpm here; it detects bun on its own
		...(pm === 'bun' ? [] : [`--package-manager=${pm}`]),
		...args.passthrough,
	])

	if (status !== 0 || (!dryRun && !existsSync(join(dir, 'package.json')))) {
		await done('cli_create_failed', { step: 'scaffold' })
		process.exit(status || 1)
	}

	// 2. Starter content
	const env = dryRun
		? { NEXT_PUBLIC_SANITY_PROJECT_ID: '<projectId>', NEXT_PUBLIC_SANITY_DATASET: '<dataset>' }
		: readEnv(dir)
	const projectId = env.NEXT_PUBLIC_SANITY_PROJECT_ID
	const dataset = env.NEXT_PUBLIC_SANITY_DATASET

	let seeded = args.seed === 'none'
	if (args.seed !== 'none') {
		if (projectId && dataset) {
			seeded = seed({ dir, kind: args.seed, blog: args.blog, projectId, dataset })
		} else {
			warn('Could not read the project ID/dataset from .env.local, so starter content was skipped.')
		}
		if (!seeded) {
			log(styleText('dim', '  Retry later from the project folder with: npx sanity datasets import demo.tar.gz --missing'))
		}
	}

	// 3. Agent skills
	const skills = installSkills({ dir, pm })
	if (!skills) warn(`Skipped agent skills. Add them later with: npx skills add ${SKILLS_REPO}`)

	await done('cli_create_completed', { seeded, skills })

	log()
	info(styleText('bold', 'Your SanityPress site is ready!'))
	log()
	log(`  cd ${relative(process.cwd(), dir) || '.'}`)
	log(`  ${pm === 'npm' ? 'npm run' : pm} dev`)
	log()
	log(`  Website  http://localhost:3000`)
	log(`  Studio   http://localhost:3000/admin`)
	log()
}

main().catch(async (err) => {
	fail(err?.message ?? String(err))
	await track('cli_create_failed', { step: 'unexpected', version: VERSION })
	process.exit(1)
})
