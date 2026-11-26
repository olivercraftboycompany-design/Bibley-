# Bibley community backend foundation (not deployed)

`community.py` is a small, separately tested SQLite persistence layer for friend requests and opt-in sharing. It has no public HTTP routes and does not read the cloud sync database or any existing notes, bookmarks, highlights, or prayers. A recipient can only see a copy composed specifically for them, after accepting a friendship; removing the friendship revokes all shares in both directions. Copies already downloaded by the recipient cannot be recalled.

Mount it in the existing Bibley account service at `https://bibley.sites.tab.bot` or behind a separately authorized identity provider. Before wiring up HTTP, use the server's existing session middleware to resolve the actor from an authenticated request (never a caller-supplied actor); resolve accounts by stable internal ID through an explicitly opted-in directory; add request-size limits, rate limiting, account cleanup, report/block controls, and log metadata only. Keep plaintext share contents out of logs and render them as text. Do not forward Bibley passwords or bearer session tokens to a new provider. Validate permissions with separate test accounts before any public release.

Activation needs the account-server source/deploy workspace; this repository currently publishes only a static GitHub Pages client. Public notes, group plans/discussions and a church hub are not implemented by this module and require separate role and moderation policies.

Run the local persistence tests: `python -m unittest discover -s tests -p test_community.py`.
