/**
 * Minimum documents a fresh SanityPress site needs.
 * Fixed `_id`s + `--missing` on import make re-running safe (never overwrites).
 */

const block = (key, text, style = 'normal') => ({
	_key: key,
	_type: 'block',
	style,
	markDefs: [],
	children: [{ _key: `${key}-span`, _type: 'span', marks: [], text }],
})

const metadata = (slug, title) => ({
	_type: 'metadata',
	slug: { _type: 'slug', current: slug },
	title,
	noIndex: false,
})

/** @param {{ blog: boolean }} options */
export function minimalDocuments({ blog }) {
	const docs = [
		{
			_id: 'site',
			_type: 'site',
			title: 'My SanityPress Website',
		},
		{
			_id: 'page-home',
			_type: 'page',
			title: 'Home',
			metadata: metadata('index', 'Home'),
			modules: [],
		},
	]

	if (blog) {
		docs.push(
			{
				_id: 'page-blog',
				_type: 'page',
				title: 'Blog',
				metadata: metadata('blog', 'Blog'),
				modules: [
					{
						_key: 'blog-index',
						_type: 'blog-index',
						intro: [block('blog-index-intro', 'Blog', 'h1')],
						postsPerPage: 6,
					},
				],
			},
			{
				_id: 'global-module-blog',
				_type: 'global-module',
				identifier: 'Blog post template',
				// `blog/` (trailing slash) = every post under /blog, excluding /blog itself
				path: 'blog/',
				before: [{ _key: 'blog-post-content', _type: 'blog-post-content' }],
			},
		)
	}

	return docs
}

export const toNdjson = (docs) =>
	docs.map((doc) => JSON.stringify(doc)).join('\n') + '\n'
