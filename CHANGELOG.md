# Changelog

All notable changes are recorded here. Each entry corresponds to a squash-merged PR title (claude.md §6.4).

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and uses [semver](https://semver.org/).

## [Unreleased]
### Added
- feat(quick-share): camera-first capture with direct WhatsApp image share (flagged off by default behind `REACT_APP_FF_QUICK_SHARE_CAMERA_FIRST`). Member taps shutter → photo shared directly via existing shareImageDirectly → navigates Home. No backend required.
- Engineering governance framework: `claude.md`, `/governance/`, PR template, CODEOWNERS, CI workflows, automation scripts.
