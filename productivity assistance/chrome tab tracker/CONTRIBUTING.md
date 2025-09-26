# Contribution Guide

If you only want to include changes from specific files in a pull request, stage just those files before committing:

1. Review the files you modified:
   ```bash
   git status
   ```
2. Stage only the files that belong in the pull request:
   ```bash
   git add path/to/file-one.js path/to/file-two.js
   ```
3. Confirm that only the desired files are staged:
   ```bash
   git status
   ```
   The files you listed with `git add` will appear under "Changes to be committed".
4. Commit and push the selective changes:
   ```bash
   git commit -m "Describe your change"
   git push
   ```
5. Open the pull request on your hosting service (e.g., GitHub). It will only show the files included in the commit.

To remove a mistakenly staged file, run `git restore --staged path/to/file.js` before committing.
