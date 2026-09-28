// @ts-check
/**
 * Info.plist for Aria (ARCHITECTURE.md §8.4, §8.5, §8.6):
 *  - usage strings: microphone (NFR-2 wording), Apple Music
 *  - UIBackgroundModes: audio (record with the screen locked, FR-3) + processing (transcription)
 *  - BGTaskSchedulerPermittedIdentifiers (required by iOS whenever `processing` is declared; also used by
 *    BGContinuedProcessingTask on iOS 26+ for long transcriptions)
 *  - document types so "Open in Aria" appears for m4a / wav / mp3 / aiff (FR-5). Files are copied into a
 *    project on import, never edited in place → LSSupportsOpeningDocumentsInPlace = false.
 *
 * Props (all optional): { microphone?: string, appleMusic?: string, bgTaskIdentifiers?: string[] }
 */
const { withInfoPlist } = require('@expo/config-plugins');

const MIC =
  'Aria uses the microphone only while you record yourself playing, to turn your playing into notes. Recordings stay on your phone.';
const APPLE_MUSIC =
  'Aria uses Apple Music to play the songs you are learning and, if you allow it, to suggest songs based on what you listen to. Your listening history stays on your phone.';

const AUDIO_CONTENT_TYPES = [
  'public.mpeg-4-audio', // .m4a (AAC / ALAC)
  'com.apple.m4a-audio',
  'com.microsoft.waveform-audio', // .wav
  'public.mp3',
  'public.aiff-audio',
  'public.aifc-audio',
];

/** @param {string[] | undefined} list @param {string[]} add */
const union = (list, add) => [...new Set([...(list ?? []), ...add])];

/** @type {import('@expo/config-plugins').ConfigPlugin<{ microphone?: string; appleMusic?: string; bgTaskIdentifiers?: string[] } | void>} */
const withAriaInfoPlist = (config, props) => {
  const bundleId = config.ios?.bundleIdentifier ?? 'com.doritlz.arya';
  const bgIds = props?.bgTaskIdentifiers ?? [`${bundleId}.transcribe`, `${bundleId}.transcribe.*`];

  return withInfoPlist(config, (cfg) => {
    const plist = cfg.modResults;
    plist.NSMicrophoneUsageDescription = props?.microphone ?? MIC;
    plist.NSAppleMusicUsageDescription = props?.appleMusic ?? APPLE_MUSIC;
    plist.UIBackgroundModes = union(plist.UIBackgroundModes, ['audio', 'processing']);
    plist.BGTaskSchedulerPermittedIdentifiers = union(plist.BGTaskSchedulerPermittedIdentifiers, bgIds);

    /** @type {Array<Record<string, any>>} */
    const docTypes = Array.isArray(plist.CFBundleDocumentTypes) ? plist.CFBundleDocumentTypes : [];
    const existing = docTypes.find((d) => d.CFBundleTypeName === 'Audio recording');
    const entry = {
      CFBundleTypeName: 'Audio recording',
      CFBundleTypeRole: 'Viewer',
      LSHandlerRank: 'Alternate', // offer "Open in Aria" without claiming to be the default player
      LSItemContentTypes: union(existing?.LSItemContentTypes, AUDIO_CONTENT_TYPES),
    };
    plist.CFBundleDocumentTypes = [...docTypes.filter((d) => d !== existing), entry];
    plist.LSSupportsOpeningDocumentsInPlace = false;
    return cfg;
  });
};

module.exports = withAriaInfoPlist;
