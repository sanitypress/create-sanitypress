/**
 * Anonymous usage events (no names, paths, project IDs or tokens).
 * Opt out: DO_NOT_TRACK=1 or SANITYPRESS_TELEMETRY_DISABLED=1. Off in CI.
 */
import { randomUUID } from 'node:crypto'

// TODO: PostHog project API key (public, write-only "phc_..." token)
const POSTHOG_KEY = ''
const POSTHOG_HOST = 'https://us.i.posthog.com'

const env = process.env
export const telemetryEnabled =
	Boolean(POSTHOG_KEY) &&
	!['1', 'true'].includes(env.DO_NOT_TRACK ?? '') &&
	!['1', 'true'].includes(env.SANITYPRESS_TELEMETRY_DISABLED ?? '') &&
	!env.CI

const distinctId = randomUUID()

/** @param {string} event @param {Record<string, unknown>} properties */
export async function track(event, properties = {}) {
	if (!telemetryEnabled) return
	try {
		await fetch(`${POSTHOG_HOST}/capture/`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				api_key: POSTHOG_KEY,
				event,
				distinct_id: distinctId,
				properties: {
					...properties,
					$process_person_profile: false,
					os: process.platform,
					node: process.versions.node,
				},
			}),
			signal: AbortSignal.timeout(2000),
		})
	} catch {
		// never block or fail the install on telemetry
	}
}
