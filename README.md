# The Matrix Construct Program — GitHub test site

Separate public test deployment of approved Matrix After Dark Version 225.
Original Sites project and MatrixAfterDark/Invite remain unchanged.

## Working website and deployment
The complete lean working website (499 files in dist/, all approved assets and 457 catalogue entries) is in the attached release package:
https://github.com/MatrixAfterDark/the-construct-program/releases/tag/v225-test

Download **matrix-after-dark-github-lean-v225.zip** from Assets, rather than GitHub's automatically generated Source code archives. The custom ZIP contains the complete site; the automatic archives contain only this deployment controller.

The manually triggered GitHub Pages workflow downloads that exact package, checks SHA-256 6ca918207cc9393abd448f952b699920fa7b5067aec53b3daf97b0b6f7495807, verifies every retained file against ASSET-AUDIT.json, and deploys dist/ directly. No rebuild or re-encoding takes place. The workflow has contents: read, pages: write and id-token: write; it cannot push code.

The release asset is authoritative. Partial browser-upload files were removed from the default branch after the archive-based deployment method replaced that transfer attempt. Complete approved source/media are preserved in the release ZIP.

## Provenance and validation
Approved original source commit: f38eaf97e4ef9c72b6eab5b24f75149b2279962f.
499 retained files are unchanged from the lean migration package. Original binary media remain byte-identical to Version 225.
33 automated regression checks passed using the lean dist/ and separate test fixtures. These are VM/static regressions, not complete browser journeys.
Desktop and phone acceptance, real playback/synchronisation, transitions, character selection, personalised reveals and scrolling remain to be reviewed before guest use.

Personalisation: append ?name=Lexi to the published site URL. Without a name, OPERATIVE is shown.

Original approved reference: https://matrix-after-dark-opening.steven106747.chatgpt.site/
