## Eval submission checklist

- [ ] This PR creates or updates exactly one `evals/SLUG/` directory, or it is a maintainer-only repository maintenance PR.
- [ ] For a new eval, `AUTHORS` is my GitHub handle. For an update, I am the existing author and did not change `AUTHORS` or the slug.
- [ ] The eval PR does not change `CODEOWNERS`, workflows, validators, dependencies, root documentation, or another slug.
- [ ] I ran `npm ci --ignore-scripts` and `npm run validate` locally.
- [ ] For repository-infrastructure changes only, I also ran `npm run test:maintenance` (not applicable to ordinary eval submissions).
- [ ] I did not add secrets, hidden files, symbolic links, archives, binary executables, or unapproved file types.
- [ ] If this eval has a custom runner, its documentation records the source URL, pinned version, installation and invocation, input/output contract, runtime requirements, and known limitations; I do not claim EvalHub executed or security-reviewed it.

Describe the eval, its scoring rule, and the evidence used to verify it:
