## Eval submission checklist

- [ ] This PR creates or updates exactly one `evals/SLUG/` directory, or it is a maintainer-only repository maintenance PR.
- [ ] For a new eval, `AUTHORS` is my GitHub handle. For an update, I am the existing author and did not change `AUTHORS` or the slug.
- [ ] The eval PR does not change `CODEOWNERS`, workflows, validators, dependencies, root documentation, or another slug.
- [ ] I ran `npm ci`, `npm test`, `npm run validate`, and `npm run validate:runner` locally.
- [ ] I did not add secrets, hidden files, symbolic links, archives, executables, or unapproved file types.

Describe the eval, its scoring rule, and the evidence used to verify it:
