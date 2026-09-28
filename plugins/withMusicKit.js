// @ts-check
/**
 * MusicKit (ARCHITECTURE.md §8.2).
 *
 * On iOS, MusicKit needs NO entitlement and no developer token in the app: the system mints the token from
 * the App ID. What IS required, outside this repo:
 *   1. Apple developer portal → Certificates, Identifiers & Profiles → Identifiers → com.doritlz.arya →
 *      "App Services" tab → enable **MusicKit**. (Without it, catalog requests fail with a token error.)
 *   2. Regenerate / re-download provisioning profiles is NOT needed for this (it's an App Service, not a
 *      capability), but EAS-managed credentials are unaffected either way.
 *   3. The reco-api worker holds the separate MusicKit private key (.p8) for server-side catalog calls (§9).
 *
 * In the app this plugin only makes sure the usage string exists (withAriaInfoPlist sets the real copy) and
 * allows `canOpenURL("music://…")` for the "Open in Apple Music" fallback (FR-30).
 */
const { withInfoPlist } = require('@expo/config-plugins');

/** @type {import('@expo/config-plugins').ConfigPlugin<{ usageDescription?: string } | void>} */
const withMusicKit = (config, props) =>
  withInfoPlist(config, (cfg) => {
    const plist = cfg.modResults;
    if (props?.usageDescription) plist.NSAppleMusicUsageDescription = props.usageDescription;
    if (!plist.NSAppleMusicUsageDescription) {
      plist.NSAppleMusicUsageDescription = 'Aria uses Apple Music to play the songs you are learning.';
    }
    const schemes = /** @type {string[]} */ (plist.LSApplicationQueriesSchemes ?? []);
    plist.LSApplicationQueriesSchemes = [...new Set([...schemes, 'music'])];
    return cfg;
  });

module.exports = withMusicKit;
