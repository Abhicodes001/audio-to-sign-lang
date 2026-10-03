# SignWave Dataset Coverage Report

Last updated: 2026-10-03

## Summary

- Catalogue file: `data/sign_catalogue.json`
- Catalogue status: developer preview
- Total catalogue entries: 151
- Word/phrase sign entries: 115
- Fingerspelling entries: 36
- Verified release entries: 0
- Required fingerspelling coverage: 36/36 (`a-z`, `0-9`)
- Coverage measures existing file paths, not decoded media or linguistic correctness.
- Validation errors: 0
- Unsupported non-playback file found: `datasets/mic3.png`

## Important Limits

The catalogue was generated from repository filenames and local paths only. A filename is not proof that a video is an Indian Sign Language sign, that it is linguistically correct, or that the project has permission to reuse it.

Every current catalogue entry is marked:

- `language`: `unverified`
- `source`: `bundled repository asset; provenance unknown`
- `reuse_license`: `unknown`
- `linguistic_review`: `unreviewed`
- `release_status`: `developer_preview`

There are no verified release assets yet.

## Assets Requiring Human Help

All 151 catalogue entries need human help before release:

- Confirm the original source of each asset.
- Confirm reuse/licence permission and signer consent where applicable.
- Confirm whether the sign is Indian Sign Language.
- Confirm whether the filename-derived word or phrase is linguistically accurate.
- Promote only reviewed entries to `verified_release`.

Word/phrase assets requiring review:

```text
datasets/after.mp4
datasets/again.mp4
datasets/against.mp4
datasets/age.mp4
datasets/all.mp4
datasets/alone.mp4
datasets/also.mp4
datasets/and.mp4
datasets/ask.mp4
datasets/at.mp4
datasets/be.mp4
datasets/beautiful.mp4
datasets/before.mp4
datasets/best.mp4
datasets/better.mp4
datasets/busy.mp4
datasets/but.mp4
datasets/bye.mp4
datasets/can.mp4
datasets/cannot.mp4
datasets/change.mp4
datasets/college.mp4
datasets/come.mp4
datasets/computer.mp4
datasets/day.mp4
datasets/distance.mp4
datasets/do not.mp4
datasets/do.mp4
datasets/does not.mp4
datasets/eat.mp4
datasets/engineer.mp4
datasets/fight.mp4
datasets/finish.mp4
datasets/from.mp4
datasets/glitter.mp4
datasets/go.mp4
datasets/god.mp4
datasets/gold.mp4
datasets/good.mp4
datasets/great.mp4
datasets/hand.mp4
datasets/hands.mp4
datasets/happy.mp4
datasets/hello.mp4
datasets/help.mp4
datasets/her.mp4
datasets/here.mp4
datasets/his.mp4
datasets/home.mp4
datasets/homepage.mp4
datasets/how.mp4
datasets/invent.mp4
datasets/it.mp4
datasets/keep.mp4
datasets/language.mp4
datasets/laugh.mp4
datasets/learn.mp4
datasets/me.mp4
datasets/more.mp4
datasets/my.mp4
datasets/name.mp4
datasets/next.mp4
datasets/not.mp4
datasets/now.mp4
datasets/of.mp4
datasets/on.mp4
datasets/our.mp4
datasets/out.mp4
datasets/pretty.mp4
datasets/right.mp4
datasets/sad.mp4
datasets/safe.mp4
datasets/see.mp4
datasets/self.mp4
datasets/sign.mp4
datasets/sing.mp4
datasets/so.mp4
datasets/sound.mp4
datasets/stay.mp4
datasets/study.mp4
datasets/talk.mp4
datasets/television.mp4
datasets/thank you.mp4
datasets/thank.mp4
datasets/that.mp4
datasets/they.mp4
datasets/this.mp4
datasets/those.mp4
datasets/time.mp4
datasets/to.mp4
datasets/type.mp4
datasets/us.mp4
datasets/walk.mp4
datasets/wash.mp4
datasets/way.mp4
datasets/we.mp4
datasets/welcome.mp4
datasets/what.mp4
datasets/when.mp4
datasets/where.mp4
datasets/which.mp4
datasets/who.mp4
datasets/whole.mp4
datasets/whose.mp4
datasets/why.mp4
datasets/will.mp4
datasets/with.mp4
datasets/without.mp4
datasets/words.mp4
datasets/work.mp4
datasets/world.mp4
datasets/wrong.mp4
datasets/you.mp4
datasets/your.mp4
datasets/yourself.mp4
```

Fingerspelling assets requiring review:

```text
datasets/a.mp4 through datasets/z.mp4
datasets/0.mp4 through datasets/9.mp4
```

## Validation Commands

Generate the developer-preview catalogue from local `datasets/` media:

```bash
python scripts/manage_catalogue.py generate
```

Validate catalogue metadata and asset coverage:

```bash
python scripts/manage_catalogue.py validate
```

Print a human-readable audit:

```bash
python scripts/manage_catalogue.py audit
```

Dry-run a local dataset import with collision reporting:

```bash
python scripts/manage_catalogue.py import path/to/local_media
```

Apply a local dataset import only after reviewing collisions and permissions:

```bash
python scripts/manage_catalogue.py import path/to/local_media --apply --permission-confirmed
```

Do not download, copy, redistribute, or promote dataset assets without verified permission.

The importer accepts MP4 and WebM, checks collisions among incoming names/IDs as well as existing files/catalogue IDs, and aborts copying on any collision. Generation appends new developer-preview entries while preserving existing metadata. It does not promote assets to verified release. Restart Flask after catalogue edits.

Release eligibility requires `language: isl`, `linguistic_review: reviewed`, a known source/licence, and `release_status: verified_release`. Only a human review with evidence can justify those values. `SIGNWAVE_CATALOGUE_MODE=release` filters API matching to eligible entries; the current eligible count is zero.
