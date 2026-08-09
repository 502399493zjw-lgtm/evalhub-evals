## Eval submission checklist

- [ ] This PR creates, restores, or updates exactly one `evals/SLUG/` directory, or it is a maintainer-only repository maintenance/ownership PR.
- [ ] I checked the slug's complete first-parent `main` history: a never-seen creation uses my GitHub handle (or a maintainer-verified organization), while a restoration preserves the canonical historical `AUTHORS` owner.
- [ ] The active base owner matches the canonical historical owner; otherwise this PR is the standalone maintainer `AUTHORS`-only repair, with no content/deletion/transfer or submission marker. For a normal active update, I am the owner or maintainer proxy and did not change `AUTHORS` or the slug.
- [ ] The eval PR does not change `CODEOWNERS`, workflows, validators, dependencies, root documentation, or another slug.
- [ ] I ran `npm ci --ignore-scripts` and `npm run validate` locally.
- [ ] For repository-infrastructure changes only, I also ran `npm run test:maintenance` (not applicable to ordinary eval submissions).
- [ ] I did not add secrets, hidden files, symbolic links, archives, binary executables, or unapproved file types.
- [ ] If this eval has a custom runner, its documentation records the source URL, pinned version, installation and invocation, input/output contract, runtime requirements, and known limitations; I do not claim EvalHub executed or security-reviewed it.

Describe the eval, its scoring rule, and the evidence used to verify it:
